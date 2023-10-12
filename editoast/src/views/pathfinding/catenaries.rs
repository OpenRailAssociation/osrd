use crate::error::{InternalError, Result};
use crate::infra_cache::InfraCache;
use crate::models::{pathfinding::Pathfinding, Infra, Retrieve};
use crate::schema::ObjectType;
use crate::views::pathfinding::PathfindingError;
use crate::views::pathfinding::rangemap_utils::{Float, RangedValue, make_path_range_map};
use crate::DbPool;
use actix_web::{
    dev::HttpServiceFactory,
    get, services,
    web::{Data, Json, Path},
};
use chashmap::CHashMap;
use rangemap::RangeMap;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fmt::Debug;

pub fn routes() -> impl HttpServiceFactory {
    services![catenaries_on_path,]
}

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


#[derive(Debug, Serialize, Deserialize)]
struct CatenariesOnPathResponse {
    catenary_ranges: Vec<RangedValue>,
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

    let mut conn = db_pool.get().await?;

    let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
    let (catenary_mode_map, warnings) = map_catenary_modes(&infra_cache, track_section_ids);

    let res = make_path_range_map(&catenary_mode_map, &pathfinding);
    Ok(Json(CatenariesOnPathResponse {
        catenary_ranges: RangedValue::list_from_range_map(&res),
        warnings,
    }))
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::{
        fixtures::tests::{db_pool, empty_infra, TestFixture},
        models::{
            infra_objects::catenary::Catenary, pathfinding::tests::simple_pathfinding,
            pathfinding::PathfindingChangeset, Create,
        },
        range_map,
        schema::{
            ApplicableDirections, ApplicableDirectionsTrackRange, Catenary as CatenarySchema,
        },
        views::tests::create_test_service,
    };
    use actix_http::StatusCode;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use rstest::*;
    use serde_json::from_value;


    #[fixture]
    fn simple_mode_map() -> HashMap<String, RangeMap<Float, String>> {
        // The mode map associated to the following catenaries
        let mut mode_map = [
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
        db_pool: Data<DbPool>,
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

    #[rstest]
    async fn test_map_catenary_modes(
        db_pool: Data<DbPool>,
        #[future] infra_with_catenaries: TestFixture<Infra>,
        simple_mode_map: HashMap<String, RangeMap<Float, String>>,
    ) {
        let mut conn = db_pool.get().await.unwrap();
        let infra_with_catenaries = infra_with_catenaries.await;
        let infra_cache = InfraCache::load(&mut conn, &infra_with_catenaries.model)
            .await
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
        db_pool: Data<DbPool>,
        #[future] infra_with_catenaries: TestFixture<Infra>,
    ) {
        let mut conn = db_pool.get().await.unwrap();
        let infra_with_catenaries = infra_with_catenaries.await;
        let mut infra_cache = InfraCache::load(&mut conn, &infra_with_catenaries.model)
            .await
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

    #[rstest]
    async fn test_view_catenaries_on_path(
        db_pool: Data<DbPool>,
        #[future] infra_with_catenaries: TestFixture<Infra>,
    ) {
        let infra_with_catenaries = infra_with_catenaries.await;
        let pathfinding = simple_pathfinding(infra_with_catenaries.id());
        let pathfinding: Pathfinding = PathfindingChangeset::from(pathfinding)
            .create(db_pool.clone())
            .await
            .unwrap()
            .into();
        let pathfinding = TestFixture {
            model: pathfinding,
            db_pool,
            infra: None,
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
            RangedValue {
                begin: 0.0,
                end: 25.0,
                value: "25kV".into(),
            }
        );
        assert_eq!(
            response.catenary_ranges[1],
            RangedValue {
                begin: 25.0,
                end: 30.0,
                value: "1.5kV".into(),
            }
        );
        assert_eq!(
            response.catenary_ranges[2],
            RangedValue {
                begin: 40.0,
                end: 48.0,
                value: "1.5kV".into(),
            }
        );
    }
}
