use crate::error::{InternalError, Result};
use crate::infra_cache::InfraCache;
use crate::models::{pathfinding::Pathfinding, Infra, Retrieve};
use crate::schema::{Direction, ObjectType};
use crate::views::pathfinding::PathfindingError;
use crate::DbPool;
use actix_web::{
    dev::HttpServiceFactory,
    get, services,
    web::{block, Data, Json, Path},
};
use chashmap::CHashMap;
use rangemap::RangeMap;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fmt::Debug;
use std::ops::Range;

pub fn routes() -> impl HttpServiceFactory {
    services![catenaries_on_path,]
}

/// A struct to make f64 Ord, to use in RangeMap
#[derive(Debug, PartialEq, Copy, Clone, Serialize)]
struct Float(f64);

impl Float {
    fn new(f: f64) -> Self {
        assert!(f.is_finite());
        Self(f)
    }
}

impl From<f64> for Float {
    fn from(f: f64) -> Self {
        Self::new(f)
    }
}

impl Ord for Float {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.0.partial_cmp(&other.0).unwrap()
    }
}

impl PartialOrd for Float {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        self.0.partial_cmp(&other.0)
    }
}

impl Eq for Float {}

/// Build a rangemap for each track section, giving the voltage for each range
fn map_catenary_modes(
    infra_cache: &InfraCache,
    track_ids: HashSet<String>,
) -> (HashMap<String, RangeMap<Float, String>>, Vec<InternalError>) {
    let mut warnings = Vec::new();
    let unique_catenary_ids = track_ids
        .iter()
        .flat_map(|track_id| {
            infra_cache
                .get_track_refs_type(track_id, ObjectType::Catenary)
                .into_iter()
        })
        .map(|catenary_ref| &catenary_ref.obj_id)
        .collect::<HashSet<_>>();

    let mut res = HashMap::new();
    for catenary_id in unique_catenary_ids {
        let catenary = infra_cache
            .catenaries()
            .get(catenary_id)
            .expect("catenary not found")
            .unwrap_catenary();
        let mut overlapping_ranges = Vec::new();
        for track_range in &catenary.track_ranges {
            if track_ids.contains(track_range.track.as_str()) {
                let res_entry = res
                    .entry(track_range.track.to_string())
                    .or_insert_with(RangeMap::new);
                let range = track_range.begin.into()..track_range.end.into();
                if res_entry.overlaps(&range) {
                    overlapping_ranges.push(track_range.clone());
                }
                res_entry.insert(range, catenary.voltage.0.clone());
            }
        }
        if !overlapping_ranges.is_empty() {
            warnings.push(
                PathfindingError::CatenaryOverlap {
                    catenary_id: catenary_id.to_string(),
                    overlapping_ranges,
                }
                .into(),
            );
        }
    }
    (res, warnings)
}

fn clip_range_map(
    range_map: &RangeMap<Float, String>,
    clip_range: Range<Float>,
) -> RangeMap<Float, String> {
    let mut res = RangeMap::new();
    for (range, value) in range_map.overlapping(&clip_range) {
        let range = range.start.max(clip_range.start)..range.end.min(clip_range.end);
        res.insert(range, value.clone());
    }
    res
}

/// Extend the pathfinding range map with the other one, as though entering from `range_entry` in the
/// given direction.
fn extend_path_range_map(
    path_range_map: &mut RangeMap<Float, String>,
    other_range_map: &RangeMap<Float, String>,
    range_entry: f64,
    offset: f64,
    direction: Direction,
) {
    for (range, value) in other_range_map.iter() {
        let (start, end) = match direction {
            Direction::StartToStop => (range.start.0, range.end.0),
            Direction::StopToStart => (range.end.0, range.start.0),
        };

        let range = ((start - range_entry).abs() + offset).into()
            ..((end - range_entry).abs() + offset).into();
        assert!(!path_range_map.overlaps(&range), "range overlap");
        path_range_map.insert(range, value.clone());
    }
}

fn make_path_range_map(
    catenary_mode_map: &HashMap<String, RangeMap<Float, String>>,
    pathfinding: &Pathfinding,
) -> RangeMap<Float, String> {
    let mut res = RangeMap::new();
    let mut offset = 0.;

    for track_range in pathfinding.merged_track_ranges() {
        let mode_range_map_option = catenary_mode_map.get(&track_range.track as &str);
        if let Some(mode_range_map) = mode_range_map_option {
            let mode_range_map = clip_range_map(
                mode_range_map,
                track_range.begin.into()..track_range.end.into(),
            );
            let range_entry = match track_range.direction {
                Direction::StartToStop => track_range.begin,
                Direction::StopToStart => track_range.end,
            };
            extend_path_range_map(
                &mut res,
                &mode_range_map,
                range_entry,
                offset,
                track_range.direction,
            );
        }
        offset += track_range.end - track_range.begin;
    }

    res
}

/// A struct used for the result of the catenaries_on_path endpoint
#[derive(Debug, Deserialize, PartialEq, Serialize)]
struct CatenaryRange {
    begin: f64,
    end: f64,
    mode: String,
}

impl CatenaryRange {
    fn list_from_range_map(range_map: &RangeMap<Float, String>) -> Vec<CatenaryRange> {
        range_map
            .iter()
            .map(|(range, mode)| CatenaryRange {
                begin: range.start.0,
                end: range.end.0,
                mode: mode.to_string(),
            })
            .collect()
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct CatenariesOnPathResponse {
    catenary_ranges: Vec<CatenaryRange>,
    warnings: Vec<InternalError>,
}

#[get("/{path_id}/catenaries")]
async fn catenaries_on_path(
    pathfinding_id: Path<i64>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<Json<CatenariesOnPathResponse>> {
    let pathfinding_id = *pathfinding_id;
    let pathfinding = match Pathfinding::retrieve(db_pool.clone(), pathfinding_id).await? {
        Some(pf) => pf,
        None => return Err(PathfindingError::NotFound { pathfinding_id }.into()),
    };

    let infra = Infra::retrieve(db_pool.clone(), pathfinding.infra_id)
        .await?
        .expect("Foreign key constraint not respected");

    let track_section_ids = pathfinding.track_section_ids();

    let (catenary_mode_map, warnings) = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra)?;
        Ok(map_catenary_modes(&infra_cache, track_section_ids))
    })
    .await
    .unwrap()?;

    let res = make_path_range_map(&catenary_mode_map, &pathfinding);
    Ok(Json(CatenariesOnPathResponse {
        catenary_ranges: CatenaryRange::list_from_range_map(&res),
        warnings,
    }))
}

#[cfg(test)]
pub mod tests {
    use crate::{
        fixtures::tests::{db_pool, empty_infra, TestFixture},
        models::{
            infra_objects::catenary::Catenary, pathfinding::tests::simple_pathfinding, Create,
        },
        schema::{
            ApplicableDirections, ApplicableDirectionsTrackRange, Catenary as CatenarySchema,
        },
        views::tests::create_test_service,
    };
    use actix_http::StatusCode;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use diesel::r2d2::ConnectionManager;
    use r2d2::Pool;
    use rstest::*;
    use serde_json::from_value;

    use super::*;

    macro_rules! range_map {
        ($( $begin: expr , $end: expr => $value: expr ),*) => {{
             let mut map: RangeMap<Float, String> = ::rangemap::RangeMap::new();
             $( map.insert(($begin.into()..$end.into()), $value.into()); )*
             map
        }}
    }

    #[fixture]
    fn simple_mode_map() -> HashMap<String, RangeMap<Float, String>> {
        // The mode map associated to the following catenaries
        let mut mode_map = vec![
            ("track_1", "25kV"),
            ("track_2", "25kV"),
            ("track_5", "1.5kV"),
        ]
        .iter()
        .map(|(track, voltage)| (track.to_string(), range_map!(0.0, 10.0 => *voltage)))
        .collect::<HashMap<_, _>>();
        mode_map.insert(
            "track_3".to_string(),
            range_map!(0.0, 5.0 => "25kV", 5.0, 10.0 => "1.5kV"),
        );
        mode_map
    }

    #[fixture]
    async fn infra_with_catenaries(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] empty_infra: TestFixture<Infra>,
    ) -> TestFixture<Infra> {
        let infra = empty_infra.await;

        // See the diagram in `models::pathfinding::tests::simple_path` to see how the track sections are connected.
        let catenary_schemas = vec![
            CatenarySchema {
                track_ranges: vec![
                    ApplicableDirectionsTrackRange {
                        track: "track_1".into(),
                        begin: 0.0,
                        end: 10.0,
                        applicable_directions: ApplicableDirections::Both,
                    },
                    ApplicableDirectionsTrackRange {
                        track: "track_2".into(),
                        begin: 5.0,
                        end: 10.0,
                        applicable_directions: ApplicableDirections::Both,
                    },
                ],
                voltage: "25kV".into(),
                id: "catenary_1".into(),
            },
            CatenarySchema {
                track_ranges: vec![
                    ApplicableDirectionsTrackRange {
                        track: "track_2".into(),
                        begin: 0.0,
                        end: 5.0,
                        applicable_directions: ApplicableDirections::Both,
                    },
                    ApplicableDirectionsTrackRange {
                        track: "track_3".into(),
                        begin: 0.0,
                        end: 5.0,
                        applicable_directions: ApplicableDirections::Both,
                    },
                ],
                voltage: "25kV".into(),
                ..Default::default()
            },
            CatenarySchema {
                track_ranges: vec![
                    ApplicableDirectionsTrackRange {
                        track: "track_3".into(),
                        begin: 5.0,
                        end: 10.0,
                        applicable_directions: ApplicableDirections::Both,
                    },
                    ApplicableDirectionsTrackRange {
                        track: "track_5".into(),
                        begin: 0.0,
                        end: 10.0,
                        applicable_directions: ApplicableDirections::Both,
                    },
                ],
                voltage: "1.5kV".into(),
                ..Default::default()
            },
        ];
        for (i, catenary_schema) in catenary_schemas.into_iter().enumerate() {
            Catenary::new(catenary_schema, infra.id(), i.to_string())
                .create(db_pool.clone())
                .await
                .expect("Could not create catenary");
        }
        infra
    }

    #[test]
    fn test_clip_range_map() {
        let range_map = range_map!(0.0, 10.0 => "a", 10.0, 20.0 => "b", 20.0, 30.0 => "c");

        let clipped = clip_range_map(&range_map, 5.0.into()..20.0.into());
        assert_eq!(clipped, range_map!(5.0, 10.0 => "a", 10.0, 20.0 => "b"));
    }

    #[rstest]
    async fn test_map_catenary_modes(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] infra_with_catenaries: TestFixture<Infra>,
        simple_mode_map: HashMap<String, RangeMap<Float, String>>,
    ) {
        let mut conn = db_pool.get().unwrap();
        let infra_with_catenaries = infra_with_catenaries.await;
        let infra_cache = InfraCache::load(&mut conn, &infra_with_catenaries.model)
            .expect("Could not load infra_cache");
        let track_sections: HashSet<_> =
            vec!["track_1", "track_2", "track_3", "track_4", "track_5"]
                .into_iter()
                .map(|s| s.to_string())
                .collect();

        let (mode_map, warnings) = map_catenary_modes(&infra_cache, track_sections);
        assert_eq!(mode_map, simple_mode_map);
        assert!(warnings.is_empty());
    }

    #[rstest]
    async fn test_map_catenary_modes_with_warnings(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] infra_with_catenaries: TestFixture<Infra>,
    ) {
        let mut conn = db_pool.get().unwrap();
        let infra_with_catenaries = infra_with_catenaries.await;
        let mut infra_cache = InfraCache::load(&mut conn, &infra_with_catenaries.model)
            .expect("Could not load infra_cache");
        infra_cache.add(CatenarySchema {
            track_ranges: vec![ApplicableDirectionsTrackRange {
                track: "track_1".into(),
                begin: 0.0,
                end: 10.0,
                applicable_directions: ApplicableDirections::Both,
            }],
            voltage: "25kV".into(),
            id: "catenary_that_overlaps".into(),
        });
        let track_sections: HashSet<_> =
            vec!["track_1", "track_2", "track_3", "track_4", "track_5"]
                .into_iter()
                .map(|s| s.to_string())
                .collect();

        let (_, warnings) = map_catenary_modes(&infra_cache, track_sections);
        assert_eq!(warnings.len(), 1);
        let warning = &warnings[0];

        assert!(warning.get_context().contains_key("catenary_id"));
        let catenary_id: String =
            from_value(warning.get_context().get("catenary_id").unwrap().clone()).unwrap();

        assert!(catenary_id == "catenary_that_overlaps" || catenary_id == "catenary_1");

        assert!(warning.get_context().contains_key("overlapping_ranges"));
        let overlapping_ranges: Vec<ApplicableDirectionsTrackRange> = from_value(
            warning
                .get_context()
                .get("overlapping_ranges")
                .unwrap()
                .clone(),
        )
        .unwrap();
        assert_eq!(overlapping_ranges.len(), 1);
        assert_eq!(
            overlapping_ranges[0],
            ApplicableDirectionsTrackRange {
                track: "track_1".into(),
                begin: 0.0,
                end: 10.0,
                applicable_directions: ApplicableDirections::Both,
            }
        );
    }

    #[test]
    fn test_extend_path_range_map_reversed() {
        let mut path_range_map = range_map!(0.0, 10.0 => "A");

        let mode_range_map = range_map!(10.0, 20.0 => "B", 20.0, 30.0 => "C");

        extend_path_range_map(
            &mut path_range_map,
            &mode_range_map,
            40.0,
            20.0,
            Direction::StopToStart,
        );

        let expected_range_map = range_map!(
            0.0, 10.0 => "A",
            30.0, 40.0 => "C",
            40.0, 50.0 => "B"
        );
        assert_eq!(path_range_map, expected_range_map);
    }

    #[test]
    fn test_extend_path_range_map_close() {
        let mut path_range_map = range_map!(0.0, 10.0 => "A");

        let mode_range_map = range_map!(10.0, 20.0 => "A", 20.0, 30.0 => "B");

        extend_path_range_map(
            &mut path_range_map,
            &mode_range_map,
            10.0,
            10.0,
            Direction::StartToStop,
        );

        let expected_range_map = range_map!(0.0, 20.0 => "A", 20.0, 30.0 => "B");
        assert_eq!(path_range_map, expected_range_map);
    }

    #[test]
    fn test_extend_path_range_map_from_the_beginning() {
        let mut path_range_map = range_map!(0.0, 10.0 => "A");

        let mode_range_map = range_map!(10.0, 20.0 => "A", 20.0, 30.0 => "B");

        extend_path_range_map(
            &mut path_range_map,
            &mode_range_map,
            0.0,
            10.0,
            Direction::StartToStop,
        );

        let expected_range_map = range_map!(
            0.0, 10.0 => "A",
            20.0, 30.0 => "A",
            30.0, 40.0 => "B"
        );
        assert_eq!(path_range_map, expected_range_map);
    }

    #[rstest]
    fn test_make_path_range_map(simple_mode_map: HashMap<String, RangeMap<Float, String>>) {
        let pathfinding = simple_pathfinding(0);

        let path_range_map = make_path_range_map(&simple_mode_map, &pathfinding);
        assert_eq!(
            path_range_map,
            range_map!(
                0.0, 25.0 => "25kV",
                25.0, 30.0 => "1.5kV",
                40.0, 48.0 => "1.5kV"
            )
        );
    }

    #[rstest]
    async fn test_view_catenaries_on_path(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] infra_with_catenaries: TestFixture<Infra>,
    ) {
        let infra_with_catenaries = infra_with_catenaries.await;
        let pathfinding = simple_pathfinding(infra_with_catenaries.id());
        let pathfinding = TestFixture {
            model: pathfinding.create(db_pool.clone()).await.unwrap(),
            db_pool,
        };

        let app = create_test_service().await;
        let req = TestRequest::get()
            .uri(&format!("/pathfinding/{}/catenaries/", pathfinding.id()))
            .to_request();

        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let response: CatenariesOnPathResponse = read_body_json(response).await;
        assert!(response.warnings.is_empty());
        assert_eq!(response.catenary_ranges.len(), 3);
        assert_eq!(
            response.catenary_ranges[0],
            CatenaryRange {
                begin: 0.0,
                end: 25.0,
                mode: "25kV".into(),
            }
        );
        assert_eq!(
            response.catenary_ranges[1],
            CatenaryRange {
                begin: 25.0,
                end: 30.0,
                mode: "1.5kV".into(),
            }
        );
        assert_eq!(
            response.catenary_ranges[2],
            CatenaryRange {
                begin: 40.0,
                end: 48.0,
                mode: "1.5kV".into(),
            }
        );
    }
}
