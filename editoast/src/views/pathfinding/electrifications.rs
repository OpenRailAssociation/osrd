use std::collections::HashMap;
use std::collections::HashSet;
use std::fmt::Debug;
use std::ops::DerefMut;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
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
use crate::AppState;
use editoast_schemas::primitives::ObjectType;

crate::routes! {
    "/electrifications" => electrifications_on_path,
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
    get, path = "",
    tag = "infra",
    params(PathfindingIdParam),
    responses(
        (status = 200, body = ElectrificationsOnPathResponse),
    )
)]
/// Retrieve the electrification modes along a path, as seen by the rolling stock specified
async fn electrifications_on_path(
    Path(params): Path<PathfindingIdParam>,
    State(AppState {
        db_pool_v2: db_pool,
        infra_caches,
        ..
    }): State<AppState>,
) -> Result<Json<ElectrificationsOnPathResponse>> {
    let pathfinding_id = params.pathfinding_id;
    let pathfinding =
        match Pathfinding::retrieve_conn(db_pool.get().await?.deref_mut(), pathfinding_id).await? {
            Some(pf) => pf,
            None => return Err(PathfindingError::NotFound { pathfinding_id }.into()),
        };

    let infra =
        <Infra as RetrieveV2<_>>::retrieve(db_pool.get().await?.deref_mut(), pathfinding.infra_id)
            .await?
            .expect("Foreign key constraint not respected");

    let track_section_ids = pathfinding.track_section_ids();

    let infra_cache =
        InfraCache::get_or_load(db_pool.get().await?.deref_mut(), &infra_caches, &infra).await?;
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
    // There used to be tests here. They were removed because this TSV1 module will be removed soon.
    // These tests were using actix's test API, but we switched to axum, so they were removed instead
    // of being ported.
}
