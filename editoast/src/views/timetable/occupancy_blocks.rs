use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::pathfinding::TrackRange;
use core_client::signal_projection::SignalUpdate;
use core_client::signal_projection::SignalUpdatesRequest;
use core_client::signal_projection::TrainSimulation;
use editoast_models::DbConnection;
use editoast_schemas::primitives::Identifier;
use itertools::izip;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;
use tracing::info;
use utoipa::ToSchema;

use crate::ValkeyClient;
use crate::ValkeyConnection;
use crate::error::Result;
use crate::models;
use crate::models::infra::Infra;
use crate::views::projection::ProjectPathInput;
use crate::views::projection::TrainSimulationDetails;
use crate::views::projection::extract_train_details;
use crate::views::timetable::simulation::train_simulation_batch;

editoast_common::schemas! {
    OccupancyBlockForm,
    OccupancyBlocks,
}

/// Occupancy block output is described by time-space points and blocks
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub(super) struct OccupancyBlocks {
    /// list of signal updates along the path
    pub(super) signal_updates: Vec<SignalUpdate>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub(super) struct OccupancyBlockForm {
    pub(super) infra_id: i64,
    pub(super) electrical_profile_set_id: Option<i64>,
    pub(super) ids: HashSet<i64>,
    #[schema(inline)]
    pub(super) path: ProjectPathInput,
}

/// Compute the signal updates of a list of train schedules
pub(super) async fn compute_batch_signal_updates<'a>(
    core: Arc<CoreClient>,
    infra: &Infra,
    path_track_ranges: &'a [TrackRange],
    path_routes: &'a [Identifier],
    path_blocks: &'a [Identifier],
    trains_details: &'a [TrainSimulationDetails],
) -> Result<HashMap<i64, Vec<SignalUpdate>>> {
    if trains_details.is_empty() {
        return Ok(HashMap::new());
    }
    let request = SignalUpdatesRequest {
        infra: infra.id,
        expected_version: infra.version,
        track_section_ranges: path_track_ranges,
        routes: path_routes,
        blocks: path_blocks,
        train_simulations: trains_details
            .iter()
            .map(|detail| {
                (
                    detail.train_id,
                    TrainSimulation {
                        signal_critical_positions: &detail.signal_critical_positions,
                        zone_updates: &detail.zone_updates,
                        simulation_end_time: detail.times[detail.times.len() - 1],
                    },
                )
            })
            .collect(),
    };
    let response = request.fetch(&core).await?;
    Ok(response.signal_updates)
}

pub(super) async fn compute_occupancy_blocks(
    conn: &mut DbConnection,
    core_client: Arc<CoreClient>,
    valkey_client: Arc<ValkeyClient>,
    path: ProjectPathInput,
    infra: &Infra,
    trains_schedules: Vec<models::TrainSchedule>,
    electrical_profile_set_id: Option<i64>,
) -> Result<HashMap<i64, OccupancyBlocks>> {
    let mut valkey_conn = valkey_client.get_connection().await?;

    // 1. Get train simulations
    let simulations = train_simulation_batch(
        conn,
        valkey_client.clone(),
        core_client.clone(),
        &trains_schedules,
        infra,
        electrical_profile_set_id,
    )
    .await?;

    // 2. Extracts train simulation details and computes unique hashes for projected train paths.
    let trains_details = extract_train_details(&trains_schedules, simulations).await?;

    let mut trains_hash_values = vec![];

    trains_hash_values.extend(trains_details.iter().map(|t| {
        t.compute_occupancy_block_hash_with_versioning(
            infra.id,
            infra.version,
            &path.track_section_ranges,
            &path.routes,
            &path.blocks,
        )
    }));

    // 3. Retrieve cached projection
    let (miss_cache, mut hit_cache) =
        retrieve_cached_occupancy_blocks(&mut valkey_conn, &trains_hash_values, &trains_details)
            .await?;

    // 4. Compute space time curves and signal updates for all miss cache
    let signal_updates = compute_batch_signal_updates(
        core_client.clone(),
        infra,
        &path.track_section_ranges,
        &path.routes,
        &path.blocks,
        &miss_cache,
    )
    .await?;

    // 5. Store occupancy blocks in the cache (using pipeline)
    let trains_hash_values: HashMap<_, _> = trains_details
        .iter()
        .map(|t| t.train_id)
        .zip(trains_hash_values)
        .collect();
    let mut new_items = vec![];
    for train_id in miss_cache.iter().map(|t| t.train_id) {
        let hash = &trains_hash_values[&train_id];
        let cached_value: OccupancyBlocks = OccupancyBlocks {
            signal_updates: signal_updates
                .get(&train_id)
                .expect("Signal update not available for train")
                .clone(),
        };
        hit_cache.push((cached_value.clone(), train_id));
        new_items.push((hash, cached_value));
    }
    valkey_conn.json_set_bulk(&new_items).await?;

    // 6. Build the projection response
    let mut occupancy_blocks_result = HashMap::new();
    for (cached, train_id) in hit_cache {
        occupancy_blocks_result.insert(
            train_id,
            OccupancyBlocks {
                signal_updates: cached.signal_updates,
            },
        );
    }

    Ok(occupancy_blocks_result)
}

async fn retrieve_cached_occupancy_blocks(
    valkey_conn: &mut ValkeyConnection,
    trains_hash_values: &[String],
    trains_details: &[TrainSimulationDetails],
) -> Result<(Vec<TrainSimulationDetails>, Vec<(OccupancyBlocks, i64)>)> {
    let cached_projections: Vec<Option<OccupancyBlocks>> =
        valkey_conn.json_get_bulk(trains_hash_values).await?;

    let mut hit_cache = vec![];
    let mut miss_cache = vec![];

    for (train_details, projection) in izip!(trains_details, cached_projections) {
        if let Some(cached) = projection {
            hit_cache.push((cached, train_details.train_id));
        } else {
            miss_cache.push(train_details.clone());
        }
    }

    info!(
        nb_hit = hit_cache.len(),
        nb_miss = miss_cache.len(),
        "Hit cache"
    );

    Ok((miss_cache, hit_cache))
}
