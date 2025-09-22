use crate::views::projection::TrainSimulationDetails;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::pathfinding::TrackRange;
use core_client::signal_projection::SignalUpdate;
use core_client::signal_projection::SignalUpdatesRequest;
use core_client::signal_projection::TrainSimulation;
use database::DbConnection;
use schemas::primitives::Identifier;
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::infra::Infra;
use crate::views::projection::ProjectPathInput;
use crate::views::projection::extract_train_details;
use crate::views::timetable::simulation::train_simulation_batch;

/// Occupancy block output is described by time-space points and blocks
pub type OccupancyBlocks = Vec<SignalUpdate>;

#[editoast_derive::openapi_schema]
#[derive(Debug, Deserialize, ToSchema)]
pub(in crate::views) struct OccupancyBlockForm {
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
) -> Result<Vec<Vec<SignalUpdate>>> {
    if trains_details.is_empty() {
        return Ok(vec![]);
    }
    let request = SignalUpdatesRequest {
        infra: infra.id,
        expected_version: infra.version,
        track_section_ranges: path_track_ranges,
        routes: path_routes,
        blocks: path_blocks,
        train_simulations: trains_details
            .iter()
            .map(|train_details| TrainSimulation {
                signal_critical_positions: &train_details.signal_critical_positions,
                zone_updates: &train_details.zone_updates,
                simulation_end_time: train_details.times[train_details.times.len() - 1],
            })
            .collect(),
    };

    let response = request.fetch(&core).await?;

    Ok(response.signal_updates)
}

#[allow(clippy::too_many_arguments)]
pub(super) async fn compute_occupancy_blocks<T: TrainScheduleLike>(
    conn: &mut DbConnection,
    core_client: Arc<CoreClient>,
    valkey_client: Arc<cache::Client>,
    path: ProjectPathInput,
    infra: &Infra,
    trains_schedules: &[T],
    electrical_profile_set_id: Option<i64>,
    app_version: Option<&str>,
) -> Result<Vec<Arc<OccupancyBlocks>>> {
    let mut valkey_conn = valkey_client.get_connection().await?;

    // 1. Get train simulations
    let simulations = train_simulation_batch(
        conn,
        valkey_client.clone(),
        core_client.clone(),
        trains_schedules,
        infra,
        electrical_profile_set_id,
        app_version,
    )
    .await?;

    // 2. Extracts train simulation details and computes unique hashes for projected train paths.
    let trains_details = extract_train_details(simulations).await?;

    let train_hashes_to_idx: HashMap<String, Vec<usize>> = trains_details
        .iter()
        .enumerate()
        .filter_map(|(index, train_details)| {
            train_details.as_ref().map(|train_details| {
                (
                    index,
                    train_details.compute_occupancy_block_hash_with_versioning(
                        infra.id,
                        infra.version,
                        &path.track_section_ranges,
                        &path.routes,
                        &path.blocks,
                        app_version,
                    ),
                )
            })
        })
        .fold(HashMap::new(), |mut map, (index, hash)| {
            map.entry(hash).or_default().push(index);
            map
        });

    let train_hashes: Vec<_> = train_hashes_to_idx.keys().cloned().collect();

    // 3. Retrieve cached occupancy blocks
    let cached_blocks = valkey_conn
        .json_get_bulk(&train_hashes)
        .await?
        .collect::<Vec<Option<OccupancyBlocks>>>();

    let mut occupancy_blocks_result = vec![Arc::default(); trains_schedules.len()];
    let mut occupancy_block_requests = vec![];
    for (hash, occupancy_block) in train_hashes.into_iter().zip(cached_blocks) {
        if let Some(occupancy_block) = occupancy_block {
            let indexes = &train_hashes_to_idx[&hash];
            let occupancy_block = Arc::new(occupancy_block);
            for index in indexes {
                occupancy_blocks_result[*index] = occupancy_block.clone();
            }
        } else {
            let index = train_hashes_to_idx[&hash]
                .first()
                .expect("indexes should not be empty");
            occupancy_block_requests.push((
                hash,
                trains_details[*index]
                    .clone()
                    .expect("train_details must exist if hash is computed"),
            ));
        }
    }

    // 4. Compute space time curves and signal updates for all miss cache
    let train_details_to_requests: Vec<_> = occupancy_block_requests
        .iter()
        .map(|(_, train_details)| train_details.clone())
        .collect();
    let signal_updates = compute_batch_signal_updates(
        core_client.clone(),
        infra,
        &path.track_section_ranges,
        &path.routes,
        &path.blocks,
        &train_details_to_requests,
    )
    .await?;

    // 5. Store block occupancies in the cache
    let occupancy_blocks: Vec<_> = occupancy_block_requests
        .iter()
        .map(|(hash, _)| hash)
        .zip(signal_updates.clone())
        .collect();
    valkey_conn.json_set_bulk(&occupancy_blocks).await?;

    // 6. Build block occupancy response
    for (hash, occupancy_blocks) in occupancy_blocks.into_iter() {
        let indexes = &train_hashes_to_idx[hash];
        let occupancy_blocks = Arc::new(occupancy_blocks);
        for index in indexes {
            occupancy_blocks_result[*index] = occupancy_blocks.clone();
        }
    }

    Ok(occupancy_blocks_result)
}
