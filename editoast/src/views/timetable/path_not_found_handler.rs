use std::sync::Arc;

use chrono::DateTime;
use chrono::Utc;

use crate::core::conflict_detection::ConflictDetectionRequest;
use crate::core::conflict_detection::WorkSchedulesRequest;
use crate::core::pathfinding::PathfindingResult;
use crate::core::simulation::SimulationResponse;
use crate::core::stdcm::STDCMResponse;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::models::train_schedule::TrainSchedule;
use crate::models::work_schedules::WorkSchedule;

use super::filter_core_work_schedule;
use super::stdcm::build_train_requirements;

pub struct PathNotFoundHandler {
    pub core_client: Arc<CoreClient>,
    pub infra_id: i64,
    pub infra_version: String,
    pub train_schedules: Vec<TrainSchedule>,
    pub simulations: Vec<(SimulationResponse, PathfindingResult)>,
    pub work_schedules: Vec<WorkSchedule>,
    pub virtual_train_schedule: TrainSchedule,
    pub virtual_train_sim_result: SimulationResponse,
    pub virtual_train_pathfinding_result: PathfindingResult,
    pub earliest_departure_time: DateTime<Utc>,
    pub maximum_run_time: u64,
    pub latest_simulation_end: DateTime<Utc>,
}

impl PathNotFoundHandler {
    pub async fn handle(self) -> Result<STDCMResponse> {
        let virtual_train_id = self.virtual_train_schedule.id;

        // Combine the original train schedules with the virtual train schedule.
        let train_schedules = [self.train_schedules, vec![self.virtual_train_schedule]].concat();

        // Combine the original simulations with the virtual train's simulation results.
        let simulations = [
            self.simulations,
            vec![(
                self.virtual_train_sim_result,
                self.virtual_train_pathfinding_result.clone(),
            )],
        ]
        .concat();

        // Build train requirements based on the combined train schedules and simulations
        // This prepares the data structure required for conflict detection.
        let trains_requirements = build_train_requirements(
            train_schedules,
            simulations,
            self.earliest_departure_time,
            self.latest_simulation_end,
        );

        // Filter the provided work schedules to find those that conflict with the given parameters
        // This identifies any work schedules that may overlap with the earliest departure time and maximum run time.
        let conflict_work_schedules = filter_conflict_work_schedules(
            &self.work_schedules,
            self.earliest_departure_time,
            self.maximum_run_time,
        );

        // Prepare the conflict detection request.
        let conflict_detection_request = ConflictDetectionRequest {
            infra: self.infra_id,
            expected_version: self.infra_version,
            trains_requirements,
            work_schedules: conflict_work_schedules,
        };

        // Send the conflict detection request and await the response.
        let conflict_detection_response =
            conflict_detection_request.fetch(&self.core_client).await?;

        // Filter the conflicts to find those specifically related to the virtual train.
        let conflicts: Vec<_> = conflict_detection_response
            .conflicts
            .into_iter()
            .filter(|conflict| conflict.train_ids.contains(&virtual_train_id))
            .map(|mut conflict| {
                conflict.train_ids.retain(|id| id != &virtual_train_id);
                conflict
            })
            .collect();

        // Return the conflicts found along with the pathfinding result for the virtual train.
        Ok(STDCMResponse::Conflicts {
            pathfinding_result: self.virtual_train_pathfinding_result,
            conflicts,
        })
    }
}

fn filter_conflict_work_schedules(
    work_schedules: &[WorkSchedule],
    start_time: DateTime<Utc>,
    maximum_run_time: u64,
) -> Option<WorkSchedulesRequest> {
    if work_schedules.is_empty() {
        return None;
    }

    let work_schedule_requirements = work_schedules
        .iter()
        .map(|ws| (ws.id, filter_core_work_schedule(ws, start_time)))
        .filter(|(_, ws)| ws.end_time > 0 && ws.start_time < maximum_run_time)
        .collect();

    Some(WorkSchedulesRequest {
        start_time,
        work_schedule_requirements,
    })
}
