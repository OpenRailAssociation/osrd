use std::collections::HashMap;
use std::collections::HashSet;
use std::fmt::Debug;
use std::ops::DerefMut;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::Extension;
use editoast_authz::BuiltinRole;
use editoast_common::rangemap_utils::RangedValue;
use editoast_models::DbConnectionPoolV2;
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
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use editoast_schemas::infra::ElectricalProfileSetData;

crate::routes! {
    "/electrical_profiles" => electrical_profiles_on_path,
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
#[into_params(parameter_in = Query)]
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
    get, path = "",
    tag = "electrical_profiles",
    params(PathfindingIdParam, ProfilesOnPathQuery),
    responses(
        (status = 200, body = ProfilesOnPathResponse),
    )
)]
/// Retrieve the electrical profiles along a path, as seen by the rolling stock specified
async fn electrical_profiles_on_path(
    Path(params): Path<PathfindingIdParam>,
    Query(request): Query<ProfilesOnPathQuery>,
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
) -> Result<Json<ProfilesOnPathResponse>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::PathfindingRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

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
pub mod tests {
    // There used to be tests here. They were removed because this TSV1 module will be removed soon.
    // These tests were using actix's test API, but we switched to axum, so they were removed instead
    // of being ported.
}
