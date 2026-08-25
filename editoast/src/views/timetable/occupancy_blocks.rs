use crate::error::Result;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::train_simulation_ordered_batch;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::pathfinding::TrainPath;
use core_client::signal_projection::SignalUpdate;
use core_client::signal_projection::SignalUpdatesRequest;
use core_client::signal_projection::TrainSimulation;
use core_client::simulation::SignalCriticalPosition;
use core_client::simulation::ZoneUpdate;
use core_task::Cachable;
use database::DbConnection;
use itertools::Itertools;
use models::Infra;
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use std::collections::HashSet;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;
use std::sync::Arc;
use utoipa::ToSchema;

/// Occupancy block output is described by time-space points and blocks
pub type OccupancyBlocks = Vec<SignalUpdate>;

#[derive(Debug, Clone, Hash)]
pub struct TrainBlockOccupancyDetails {
    pub signal_critical_positions: Vec<SignalCriticalPosition>,
    pub zone_updates: Vec<ZoneUpdate>,
    pub simulation_end_time: u64,
    pub train_path: Arc<TrainPath>,
}

async fn extract_block_occupancy_details<T: TrainScheduleLike>(
    simulations: Vec<Arc<simulation::Response>>,
    train_schedules: &[T],
    train_path: Arc<TrainPath>,
) -> Vec<TrainBlockOccupancyDetails> {
    assert_eq!(train_schedules.len(), simulations.len());

    simulations
        .into_iter()
        .zip(train_schedules)
        .filter_map(|(sim, train_schedule)| {
            let simulation::Response::Success(sim) = sim.as_ref() else {
                // TODO: We should project as input mode
                return None;
            };
            let respect_times = simulation::path_item_respect_times(
                &sim.final_output.report_train.path_item_times,
                train_schedule,
            )
            .into_iter()
            .all(|path_item| path_item);

            if !respect_times {
                return None;
            }
            // We have a simulation and we respect times
            Some(TrainBlockOccupancyDetails {
                simulation_end_time: *sim.final_output.report_train.times.last().unwrap(),
                signal_critical_positions: sim.final_output.signal_critical_positions.clone(),
                zone_updates: sim.final_output.zone_updates.clone(),
                train_path: train_path.clone(),
            })
        })
        .collect()
}

impl Cachable for TrainBlockOccupancyDetails {
    // Compute hash input of the occupancy block of a train schedule on a path
    fn key(&self, app_version: &str) -> String {
        let mut hasher = DefaultHasher::new();
        self.signal_critical_positions.hash(&mut hasher);
        self.zone_updates.hash(&mut hasher);
        self.train_path.hash(&mut hasher);
        let hash_simulation_input = hasher.finish();
        format!("occupancy_block_{app_version}.{hash_simulation_input}")
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub(in crate::views) struct OccupancyBlockForm {
    pub(super) infra_id: i64,
    pub(super) timetable_id: i64,
    pub(super) electrical_profile_set_id: Option<i64>,
    pub(super) ids: HashSet<i64>,
    pub(super) path: TrainPath,
}

/// Compute the signal updates of a list of train schedules
pub(super) async fn compute_batch_signal_updates(
    core: Arc<CoreClient>,
    infra: &Infra,
    path: &TrainPath,
    trains_details: &[TrainBlockOccupancyDetails],
) -> Result<Vec<Vec<SignalUpdate>>> {
    if trains_details.is_empty() {
        return Ok(vec![]);
    }
    let request = SignalUpdatesRequest {
        infra: infra.id,
        expected_version: infra.version,
        path,
        train_simulations: trains_details
            .iter()
            .map(|train_details| TrainSimulation {
                signal_critical_positions: &train_details.signal_critical_positions,
                zone_updates: &train_details.zone_updates,
                simulation_end_time: train_details.simulation_end_time,
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
    path: TrainPath,
    infra: &Infra,
    trains_schedules: &[T],
    electrical_profile_set_id: Option<i64>,
    app_version: Option<&str>,
) -> Result<Vec<Arc<OccupancyBlocks>>> {
    // 1. Get train simulations
    let simulations = train_simulation_ordered_batch(
        conn,
        valkey_client.clone(),
        core_client.clone(),
        trains_schedules,
        infra,
        electrical_profile_set_id,
        app_version,
    )
    .await?
    .into_iter()
    .map(|(sim, _)| sim)
    .collect();

    // 2. Extracts train simulation details and computes unique hashes for projected train paths.
    let filtered =
        extract_block_occupancy_details(simulations, trains_schedules, Arc::new(path.clone()))
            .await;

    // 3. Retrieve cached occupancy blocks
    let cache = core_task::Cache::new(valkey_client.clone(), filtered.len());
    // NOTE: little change of semantics here
    // Before, we optimized deduplicate parameters to be queried if they shared the same hash_key
    let (cached_blocks, cache_keys) = cache.fetch_by_keys::<_, OccupancyBlocks>(&filtered).await;
    let train_hashes_to_idx = cache_keys
        .iter()
        .enumerate()
        .map(|(index, hash)| (hash, index))
        .into_group_map();

    // Will hold
    let mut occupancy_blocks_result = vec![Arc::default(); trains_schedules.len()];
    let mut occupancy_block_requests = vec![];
    for (index, occupancy_block) in cached_blocks.into_iter().enumerate() {
        let hash = &cache_keys[index];
        if let Some(occupancy_block) = occupancy_block {
            let occupancy_block = Arc::new(occupancy_block);
            for index in &train_hashes_to_idx[hash] {
                occupancy_blocks_result[*index] = occupancy_block.clone();
            }
        } else {
            occupancy_block_requests.push((hash, filtered[index].clone()));
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
        &path,
        &train_details_to_requests,
    )
    .await?;

    // 5. Store block occupancies in the cache
    // 6. Build block occupancy response
    for ((hash, _), signal_updates) in occupancy_block_requests.iter().zip(signal_updates) {
        cache.batched_write((*hash).to_owned(), serde_json::to_value(&signal_updates)?);
        let indexes = &train_hashes_to_idx[*hash];
        let occupancy_blocks = Arc::new(signal_updates);
        for index in indexes {
            occupancy_blocks_result[*index] = occupancy_blocks.clone();
        }
    }

    Ok(occupancy_blocks_result)
}
