use core_client::CoreClient;
use core_client::pathfinding::TrainPath;
use core_client::signal_projection::SignalUpdate;
use core_client::signal_projection::SignalUpdatesRequest;
use core_client::signal_projection::TrainSimulation;
use core_client::simulation::SignalCriticalPosition;
use core_client::simulation::ZoneUpdate;
use core_task::Task;
use database::DbConnection;
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use std::collections::HashSet;
use std::hash::Hash;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::timetable::simulation;
use crate::views::timetable::simulation::train_simulation_ordered_batch;
use models::Infra;

/// Occupancy block output is described by time-space points and blocks
pub type OccupancyBlocks = Vec<SignalUpdate>;

#[derive(Debug, Clone, Hash)]
pub struct TrainBlockOccupancyDetails {
    pub signal_critical_positions: Vec<SignalCriticalPosition>,
    pub zone_updates: Vec<ZoneUpdate>,
    pub simulation_end_time: u64,
}

fn extract_block_occupancy_details<T: TrainScheduleLike>(
    simulations: Vec<Arc<simulation::Response>>,
    train_schedules: &[T],
) -> Vec<Option<TrainBlockOccupancyDetails>> {
    assert_eq!(train_schedules.len(), simulations.len());

    simulations
        .into_iter()
        .zip(train_schedules)
        .map(|(sim, train_schedule)| {
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
            })
        })
        .collect()
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
pub(super) async fn compute_batch_signal_updates<'a>(
    core: Arc<CoreClient>,
    infra: &Infra,
    path: &'a TrainPath,
    trains_details: &'a [TrainBlockOccupancyDetails],
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

    let response = request.compute(core).await?;

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
    let trains_details = extract_block_occupancy_details(simulations, trains_schedules);

    // train_details might contain None. We will send to core only valid trains_details
    // This Vec allows to associate the train with the position in the array sent to core
    let train_index_to_core_request_index: Vec<_> = trains_details
        .iter()
        .enumerate()
        .flat_map(|(idx, details)| details.as_ref().map(|_| idx))
        .collect();

    // 3. Compute space time curves and signal updates
    // The results are cached through core_task
    let train_details_to_requests: Vec<_> = trains_details
        .into_iter()
        .flat_map(|train_details| train_details)
        .collect();

    let signal_updates = compute_batch_signal_updates(
        core_client.clone(),
        infra,
        &path,
        &train_details_to_requests,
    )
    .await?;

    // 4. Build block occupancy response
    let mut occupancy_blocks_result = vec![Arc::default(); trains_schedules.len()];
    for (index, occupancy_blocks) in signal_updates.into_iter().enumerate() {
        occupancy_blocks_result[train_index_to_core_request_index[index]] =
            Arc::new(occupancy_blocks);
    }

    Ok(occupancy_blocks_result)
}
