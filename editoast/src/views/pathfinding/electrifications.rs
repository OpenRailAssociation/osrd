use std::collections::HashMap;
use std::collections::HashSet;
use std::fmt::Debug;

use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use chashmap::CHashMap;
use editoast_common::rangemap_utils::RangedValue;
use rangemap::RangeMap;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::models::pathfinding::Pathfinding;
use crate::models::Retrieve;
use crate::modelsv2::Infra;
use crate::modelsv2::Retrieve as RetrieveV2;
use crate::views::pathfinding::path_rangemap::make_path_range_map;
use crate::views::pathfinding::path_rangemap::TrackMap;
use crate::views::pathfinding::PathfindingError;
use crate::views::pathfinding::PathfindingIdParam;
use editoast_models::DbConnectionPool;
use editoast_schemas::primitives::ObjectType;

crate::routes! {
    electrifications_on_path,
}

editoast_common::schemas! {
    ElectrificationsOnPathResponse,
    &editoast_common::rangemap_utils::RangedValue,
}

/// Build a rangemap for each track section, giving the voltage for each range
fn map_electrification_modes(
    infra_cache: &InfraCache,
    track_ids: HashSet<String>,
) -> (TrackMap<String>, Vec<InternalError>) {
    let mut warnings = Vec::new();
    let unique_electrification_ids = track_ids
        .iter()
        .flat_map(|track_id| {
            infra_cache
                .get_track_refs_type(track_id, ObjectType::Electrification)
                .into_iter()
        })
        .map(|electrification_ref| &electrification_ref.obj_id)
        .collect::<HashSet<_>>();

    let mut res = HashMap::new();
    for electrification_id in unique_electrification_ids {
        let electrification = infra_cache
            .electrifications()
            .get(electrification_id)
            .expect("electrification not found")
            .unwrap_electrification();
        let mut overlapping_ranges = Vec::new();
        for track_range in &electrification.track_ranges {
            if track_ids.contains(track_range.track.as_str()) {
                let res_entry = res
                    .entry(track_range.track.to_string())
                    .or_insert_with(RangeMap::new);
                let range = track_range.begin.into()..track_range.end.into();
                if res_entry.overlaps(&range) {
                    overlapping_ranges.push(track_range.clone());
                }
                res_entry.insert(range, electrification.voltage.0.clone());
            }
        }
        if !overlapping_ranges.is_empty() {
            warnings.push(
                PathfindingError::ElectrificationOverlap {
                    electrification_id: electrification_id.to_string(),
                    overlapping_ranges,
                }
                .into(),
            );
        }
    }
    (res, warnings)
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
/// A list of ranges associated to electrification modes. When a profile overlapping another is found,
/// a warning is added to the list
struct ElectrificationsOnPathResponse {
    electrification_ranges: Vec<RangedValue>,
    warnings: Vec<InternalError>,
}

#[utoipa::path(
    tag = "infra",
    params(PathfindingIdParam),
    responses(
        (status = 200, body = ElectrificationsOnPathResponse),
    )
)]
#[get("/electrifications")]
/// Retrieve the electrification modes along a path, as seen by the rolling stock specified
async fn electrifications_on_path(
    params: Path<PathfindingIdParam>,
    db_pool: Data<DbConnectionPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<Json<ElectrificationsOnPathResponse>> {
    let mut conn = db_pool.get().await?;

    let pathfinding_id = params.pathfinding_id;
    let pathfinding = match Pathfinding::retrieve_conn(&mut conn, pathfinding_id).await? {
        Some(pf) => pf,
        None => return Err(PathfindingError::NotFound { pathfinding_id }.into()),
    };

    let infra = <Infra as RetrieveV2<_>>::retrieve(&mut conn, pathfinding.infra_id)
        .await?
        .expect("Foreign key constraint not respected");

    let track_section_ids = pathfinding.track_section_ids();

    let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
    let (electrification_mode_map, warnings) =
        map_electrification_modes(&infra_cache, track_section_ids);

    let res = make_path_range_map(&electrification_mode_map, &pathfinding);
    Ok(Json(ElectrificationsOnPathResponse {
        electrification_ranges: RangedValue::list_from_range_map(&res),
        warnings,
    }))
}

#[cfg(test)]
pub mod tests {
    use actix_http::StatusCode;
    use actix_web::test::call_service;
    use actix_web::test::read_body_json;
    use actix_web::test::TestRequest;
    use editoast_common::range_map;
    use rstest::*;
    use serde_json::from_value;
    use std::sync::Arc;
    use ApplicableDirections::*;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::empty_infra;
    use crate::fixtures::tests::TestFixture;
    use crate::models::pathfinding::tests::simple_pathfinding_fixture;
    use crate::modelsv2::prelude::*;
    use crate::modelsv2::ElectrificationModel;
    use crate::views::tests::create_test_service;
    use editoast_schemas::infra::ApplicableDirections;
    use editoast_schemas::infra::ApplicableDirectionsTrackRange;
    use editoast_schemas::infra::Electrification as ElectrificationSchema;

    #[fixture]
    fn simple_mode_map() -> TrackMap<String> {
        // The mode map associated to the following electrifications
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
    async fn infra_with_electrifications(
        db_pool: Arc<DbConnectionPool>,
        #[future] empty_infra: TestFixture<Infra>,
    ) -> TestFixture<Infra> {
        let infra = empty_infra.await;

        // See the diagram in `models::pathfinding::tests::simple_path` to see how the track sections are connected.
        let electrification_schemas = vec![
            ElectrificationSchema {
                track_ranges: vec![
                    ApplicableDirectionsTrackRange::new("track_1", 0.0, 10.0, Both),
                    ApplicableDirectionsTrackRange::new("track_2", 5.0, 10.0, Both),
                ],
                voltage: "25kV".into(),
                id: "electrification_1".into(),
            },
            ElectrificationSchema {
                track_ranges: vec![
                    ApplicableDirectionsTrackRange::new("track_2", 0.0, 5.0, Both),
                    ApplicableDirectionsTrackRange::new("track_3", 0.0, 5.0, Both),
                ],
                voltage: "25kV".into(),
                ..Default::default()
            },
            ElectrificationSchema {
                track_ranges: vec![
                    ApplicableDirectionsTrackRange::new("track_3", 5.0, 10.0, Both),
                    ApplicableDirectionsTrackRange::new("track_5", 0.0, 10.0, Both),
                ],
                voltage: "1.5kV".into(),
                ..Default::default()
            },
        ];
        ElectrificationModel::create_batch::<_, Vec<_>>(
            &mut db_pool.get().await.unwrap(),
            ElectrificationModel::from_infra_schemas(infra.id(), electrification_schemas),
        )
        .await
        .expect("Could not create electrifications");
        infra
    }

    #[rstest]
    async fn test_map_electrification_modes(
        db_pool: Arc<DbConnectionPool>,
        #[future] infra_with_electrifications: TestFixture<Infra>,
        simple_mode_map: TrackMap<String>,
    ) {
        let mut conn = db_pool.get().await.unwrap();
        let infra_with_electrifications = infra_with_electrifications.await;
        let infra_cache = InfraCache::load(&mut conn, &infra_with_electrifications.model)
            .await
            .expect("Could not load infra_cache");
        let track_sections: HashSet<_> =
            vec!["track_1", "track_2", "track_3", "track_4", "track_5"]
                .into_iter()
                .map(|s| s.to_string())
                .collect();

        let (mode_map, warnings) = map_electrification_modes(&infra_cache, track_sections);
        assert_eq!(mode_map, simple_mode_map);
        assert!(warnings.is_empty());
    }

    #[rstest]
    async fn test_map_electrification_modes_with_warnings(
        db_pool: Arc<DbConnectionPool>,
        #[future] infra_with_electrifications: TestFixture<Infra>,
    ) {
        let mut conn = db_pool.get().await.unwrap();
        let infra_with_electrifications = infra_with_electrifications.await;
        let mut infra_cache = InfraCache::load(&mut conn, &infra_with_electrifications.model)
            .await
            .expect("Could not load infra_cache");
        infra_cache
            .add(ElectrificationSchema {
                track_ranges: vec![ApplicableDirectionsTrackRange::new(
                    "track_1", 0.0, 10.0, Both,
                )],
                voltage: "25kV".into(),
                id: "electrification_that_overlaps".into(),
            })
            .unwrap();
        let track_sections: HashSet<_> =
            vec!["track_1", "track_2", "track_3", "track_4", "track_5"]
                .into_iter()
                .map(|s| s.to_string())
                .collect();

        let (_, warnings) = map_electrification_modes(&infra_cache, track_sections);
        assert_eq!(warnings.len(), 1);
        let warning = &warnings[0];

        assert!(warning.get_context().contains_key("electrification_id"));
        let electrification_id: String = from_value(
            warning
                .get_context()
                .get("electrification_id")
                .unwrap()
                .clone(),
        )
        .unwrap();

        assert!(
            electrification_id == "electrification_that_overlaps"
                || electrification_id == "electrification_1"
        );

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
            ApplicableDirectionsTrackRange::new("track_1", 0.0, 10.0, Both)
        );
    }

    #[rstest]
    async fn test_view_electrifications_on_path(
        db_pool: Arc<DbConnectionPool>,
        #[future] infra_with_electrifications: TestFixture<Infra>,
    ) {
        let infra_with_electrifications = infra_with_electrifications.await;
        let pathfinding =
            simple_pathfinding_fixture(infra_with_electrifications.id(), db_pool.clone()).await;

        let app = create_test_service().await;
        let req = TestRequest::get()
            .uri(&format!(
                "/pathfinding/{}/electrifications/",
                pathfinding.id()
            ))
            .to_request();

        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let response: ElectrificationsOnPathResponse = read_body_json(response).await;
        assert!(response.warnings.is_empty());
        assert_eq!(response.electrification_ranges.len(), 3);
        assert_eq!(
            response.electrification_ranges[0],
            RangedValue {
                begin: 0.0,
                end: 25.0,
                value: "25kV".into(),
            }
        );
        assert_eq!(
            response.electrification_ranges[1],
            RangedValue {
                begin: 25.0,
                end: 30.0,
                value: "1.5kV".into(),
            }
        );
        assert_eq!(
            response.electrification_ranges[2],
            RangedValue {
                begin: 40.0,
                end: 48.0,
                value: "1.5kV".into(),
            }
        );
    }
}
