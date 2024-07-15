use std::collections::HashMap;
use std::collections::HashSet;
use std::fmt::Debug;
use std::ops::DerefMut;

use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use editoast_common::rangemap_utils::RangedValue;
use rangemap::RangeMap;
use serde::Deserialize;
use serde::Serialize;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::error::Result;
use crate::models::pathfinding::Pathfinding;
use crate::models::Retrieve;
use crate::modelsv2::electrical_profiles::ElectricalProfileSet;
use crate::modelsv2::LightRollingStockModel;
use crate::views::electrical_profiles::ElectricalProfilesError;
use crate::views::pathfinding::path_rangemap::make_path_range_map;
use crate::views::pathfinding::path_rangemap::TrackMap;
use crate::views::pathfinding::PathfindingError;
use crate::views::pathfinding::PathfindingIdParam;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::ElectricalProfileSetData;

crate::routes! {
    electrical_profiles_on_path
}

editoast_common::schemas! {
    ProfilesOnPathResponse,
}

/// Build a rangemap for each track section, giving the electrical profile for each range
fn map_electrical_profiles(
    electrical_profile_set: ElectricalProfileSetData,
    power_class: String,
    track_ids: HashSet<String>,
) -> (TrackMap<String>, Vec<InternalError>) {
    let mut warnings = Vec::new();

    let mut res = HashMap::new();
    for profile in electrical_profile_set.levels {
        if profile.power_class != power_class {
            continue;
        }
        let mut overlapping_ranges = Vec::new();
        for track_range in &profile.track_ranges {
            if !track_ids.contains(track_range.track.as_str()) {
                continue;
            }
            let res_entry = res
                .entry(track_range.track.to_string())
                .or_insert_with(RangeMap::new);
            let range = track_range.begin.into()..track_range.end.into();
            if res_entry.overlaps(&range) {
                overlapping_ranges.push(track_range.clone());
            }
            res_entry.insert(range, profile.value.clone());
        }
        if !overlapping_ranges.is_empty() {
            warnings
                .push(PathfindingError::ElectricalProfilesOverlap { overlapping_ranges }.into());
        }
    }
    (res, warnings)
}

#[derive(Debug, Deserialize, IntoParams)]
struct ProfilesOnPathQuery {
    rolling_stock_id: i64,
    electrical_profile_set_id: i64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
/// A list of ranges associated to electrical profile values. When a profile overlapping another is found,
/// a warning is added to the list
struct ProfilesOnPathResponse {
    electrical_profile_ranges: Vec<RangedValue>,
    warnings: Vec<InternalError>,
}

#[utoipa::path(
    tag = "electrical_profiles",
    params(PathfindingIdParam, ProfilesOnPathQuery),
    responses(
        (status = 200, body = ProfilesOnPathResponse),
    )
)]
#[get("/electrical_profiles")]
/// Retrieve the electrical profiles along a path, as seen by the rolling stock specified
async fn electrical_profiles_on_path(
    params: Path<PathfindingIdParam>,
    request: Query<ProfilesOnPathQuery>,
    db_pool: Data<DbConnectionPoolV2>,
) -> Result<Json<ProfilesOnPathResponse>> {
    let db_pool = db_pool.into_inner();
    let pathfinding_id = params.pathfinding_id;
    let pathfinding =
        match Pathfinding::retrieve_conn(db_pool.get().await?.deref_mut(), pathfinding_id).await? {
            Some(pf) => pf,
            None => return Err(PathfindingError::NotFound { pathfinding_id }.into()),
        };

    let rs_id = request.rolling_stock_id;
    let rs =
        LightRollingStockModel::retrieve_or_fail(db_pool.get().await?.deref_mut(), rs_id, || {
            PathfindingError::RollingStockNotFound {
                rolling_stock_id: rs_id,
            }
        })
        .await?;

    let eps_id = request.electrical_profile_set_id;
    use crate::modelsv2::Retrieve;
    let eps =
        ElectricalProfileSet::retrieve_or_fail(db_pool.get().await?.deref_mut(), eps_id, || {
            ElectricalProfilesError::NotFound {
                electrical_profile_set_id: eps_id,
            }
        })
        .await?;

    let track_section_ids = pathfinding.track_section_ids();
    let (electrical_profiles_by_track, warnings) =
        map_electrical_profiles(eps.data, rs.base_power_class.unwrap(), track_section_ids);

    let res = make_path_range_map(&electrical_profiles_by_track, &pathfinding);
    Ok(Json(ProfilesOnPathResponse {
        electrical_profile_ranges: RangedValue::list_from_range_map(&res),
        warnings,
    }))
}

#[cfg(test)]
mod tests {
    use actix_http::StatusCode;
    use actix_web::test::TestRequest;
    use editoast_common::range_map;
    use rstest::rstest;
    use std::ops::DerefMut;

    use super::*;
    use crate::modelsv2::fixtures::create_empty_infra;
    use crate::modelsv2::fixtures::create_fast_rolling_stock;
    use crate::modelsv2::fixtures::create_simple_pathfinding_v1;
    use crate::modelsv2::prelude::*;
    use crate::views::test_app::TestAppBuilder;
    use editoast_models::DbConnection;
    use editoast_schemas::infra::ElectricalProfile;
    use editoast_schemas::infra::TrackRange;

    async fn electrical_profile_set(conn: &mut DbConnection) -> ElectricalProfileSet {
        let ep_data = ElectricalProfileSetData {
            levels: vec![
                ElectricalProfile {
                    value: "A".into(),
                    power_class: "1".into(),
                    track_ranges: vec![
                        TrackRange::new("track_1", 0.0, 10.0),
                        TrackRange::new("track_2", 5.0, 10.0),
                    ],
                },
                ElectricalProfile {
                    value: "B".into(),
                    power_class: "1".into(),
                    track_ranges: vec![
                        TrackRange::new("track_2", 0.0, 5.0),
                        TrackRange::new("track_4", 0.0, 5.0),
                        TrackRange::new("track_5", 5.0, 10.0),
                    ],
                },
                ElectricalProfile {
                    value: "B".into(),
                    power_class: "1".into(),
                    track_ranges: vec![TrackRange::new("track_4", 5.0, 10.0)],
                },
                ElectricalProfile {
                    value: "C".into(),
                    power_class: "1".into(),
                    track_ranges: vec![TrackRange::new("track_3", 0.0, 10.0)],
                },
                ElectricalProfile {
                    value: "A".into(),
                    power_class: "2".into(),
                    track_ranges: vec![
                        TrackRange::new("track_1", 0.0, 10.0),
                        TrackRange::new("track_3", 0.0, 10.0),
                    ],
                },
                ElectricalProfile {
                    value: "B".into(),
                    power_class: "2".into(),
                    track_ranges: vec![
                        TrackRange::new("track_2", 0.0, 10.0),
                        TrackRange::new("track_4", 0.0, 10.0),
                    ],
                },
            ],
            level_order: Default::default(),
        };

        let electrical_profile_set = ElectricalProfileSet::changeset()
            .name("Small_ep_test".into())
            .data(ep_data);

        electrical_profile_set
            .create(conn)
            .await
            .expect("Failed to create electrical profile set")
    }

    #[rstest]
    async fn test_map_electrical_profiles() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let ep_data = electrical_profile_set(db_pool.get_ok().deref_mut())
            .await
            .data;
        let track_sections: HashSet<_> =
            vec!["track_1", "track_2", "track_3", "track_4", "track_5"]
                .into_iter()
                .map(|s| s.to_string())
                .collect();

        let (maps_by_track, warnings) =
            map_electrical_profiles(ep_data, "1".into(), track_sections);

        assert_eq!(warnings.len(), 0);

        let expected_maps_by_track: TrackMap<String> = [
            ("track_1".into(), range_map!(0.0, 10.0 => "A")),
            (
                "track_2".into(),
                range_map!(0.0, 5.0 => "B", 5.0, 10.0 => "A"),
            ),
            ("track_3".into(), range_map!(0.0, 10.0 => "C")),
            ("track_4".into(), range_map!(0.0, 10.0 => "B")),
            ("track_5".into(), range_map!(5.0, 10.0 => "B")),
        ]
        .iter()
        .cloned()
        .collect();

        assert_eq!(maps_by_track, expected_maps_by_track);
    }

    #[rstest]
    async fn test_view_electrical_profiles_on_path() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let ep_set = electrical_profile_set(db_pool.get_ok().deref_mut()).await;
        let rolling_stock = create_fast_rolling_stock(
            db_pool.get_ok().deref_mut(),
            "fast_rolling_stock_test_view_electrical_profiles_on_path",
        )
        .await;
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let pathfinding =
            create_simple_pathfinding_v1(db_pool.get_ok().deref_mut(), infra.id).await;

        let request = TestRequest::get()
            .uri(&format!("/pathfinding/{}/electrical_profiles/?electrical_profile_set_id={}&rolling_stock_id={}", 
            pathfinding.id, ep_set.id, rolling_stock.id)
            )
            .to_request();

        // WHEN
        let response: ProfilesOnPathResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // THEN
        assert!(response.warnings.is_empty());
        assert_eq!(
            response.electrical_profile_ranges,
            vec![
                RangedValue {
                    begin: 0.0,
                    end: 15.0,
                    value: "A".into()
                },
                RangedValue {
                    begin: 15.0,
                    end: 20.0,
                    value: "B".into()
                },
                RangedValue {
                    begin: 20.0,
                    end: 30.0,
                    value: "C".into()
                },
                RangedValue {
                    begin: 30.0,
                    end: 40.0,
                    value: "B".into()
                },
                RangedValue {
                    begin: 45.0,
                    end: 48.0,
                    value: "B".into()
                },
            ]
        );
    }
}
