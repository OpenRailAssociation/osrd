use std::sync::Arc;

use chrono::DateTime;
use chrono::Utc;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::conflict_detection::ConflictDetectionRequest;
use core_client::conflict_detection::WorkSchedulesRequest;

use crate::error::Result;
use crate::models::train_schedule::TrainSchedule;
use crate::views::timetable::Conflict;
use crate::views::timetable::simulation;
use crate::views::timetable::stdcm::StdcmResponse;
use editoast_models::WorkSchedule;

use super::VirtualTrainRun;
use super::build_train_requirements;

/// `SimulationFailureHandler` is used when a simulation failure occurs,
/// particularly when a train's path cannot be found. It helps detect
/// conflicts between the `virtual_train` and existing train schedules and simulations.
/// `virtual_train` is a simulated train created to detect conflicts
/// when a real train’s path cannot be found during the simulation.
pub(super) struct SimulationFailureHandler {
    pub(super) core_client: Arc<CoreClient>,
    pub(super) infra_id: i64,
    pub(super) infra_version: i64,
    pub(super) train_schedules: Vec<TrainSchedule>,
    pub(super) simulations: Vec<Arc<simulation::Response>>,
    pub(super) work_schedules: Vec<WorkSchedule>,
    pub(super) virtual_train_run: VirtualTrainRun,
    pub(super) earliest_departure_time: DateTime<Utc>,
    pub(super) latest_simulation_end: DateTime<Utc>,
}

impl SimulationFailureHandler {
    pub(super) async fn compute_conflicts(self) -> Result<StdcmResponse> {
        let Self {
            mut train_schedules,
            mut simulations,
            work_schedules,
            virtual_train_run:
                VirtualTrainRun {
                    train_schedule,
                    simulation,
                    pathfinding,
                },
            infra_id,
            infra_version,
            earliest_departure_time,
            latest_simulation_end,
            ..
        } = self;
        let start_time = work_schedules
            .first()
            .map(|ws| ws.start_date_time)
            .unwrap_or(earliest_departure_time);
        let virtual_train_id = train_schedule.id;
        let work_schedules = if work_schedules.is_empty() {
            None
        } else {
            // Filter the provided work schedules to find those that conflict with the given parameters
            // This identifies any work schedules that may overlap with the earliest departure time and latest simulation end.
            let work_schedule_requirements = work_schedules
                .into_iter()
                .filter_map(|ws| {
                    ws.as_core_work_schedule(start_time, latest_simulation_end)
                        .map(|core_ws| (ws.id.to_string(), core_ws))
                })
                .collect();

            Some(WorkSchedulesRequest {
                start_time,
                work_schedule_requirements,
            })
        };

        // Combine the original train schedules with the virtual train schedule.
        train_schedules.push(train_schedule);

        // Combine the original simulations with the virtual train's simulation results.
        simulations.push(Arc::new(simulation));

        // Build train requirements based on the combined train schedules and simulations
        // This prepares the data structure required for conflict detection.
        let trains_requirements = build_train_requirements(
            &train_schedules,
            &simulations,
            earliest_departure_time,
            latest_simulation_end,
        );

        // Prepare the conflict detection request.
        let conflict_detection_request = ConflictDetectionRequest {
            infra: infra_id,
            expected_version: infra_version,
            trains_requirements,
            work_schedules,
        };

        // Send the conflict detection request and await the response.
        let conflict_detection_response =
            conflict_detection_request.fetch(&self.core_client).await?;

        // Filter the conflicts to find those specifically related to the virtual train.
        let virtual_train_id_str = virtual_train_id.to_string();

        let conflicts: Vec<_> = conflict_detection_response
            .conflicts
            .into_iter()
            .filter(|conflict| conflict.train_ids.contains(&virtual_train_id_str))
            .map(|conflict| Conflict {
                train_schedule_ids: conflict
                    .train_ids
                    .iter()
                    .filter(|ts| *ts != &virtual_train_id_str)
                    .map(|ts| {
                        ts.parse::<i64>()
                            .unwrap_or_else(|_| panic!("Failed to parse train_id '{ts}'"))
                    })
                    .collect(),
                paced_train_occurrence_ids: vec![],
                work_schedule_ids: conflict
                    .work_schedule_ids
                    .iter()
                    .map(|ws| {
                        ws.parse::<i64>()
                            .unwrap_or_else(|_| panic!("Failed to parse work_schedule_id '{ws}'"))
                    })
                    .collect(),
                start_time: conflict.start_time,
                end_time: conflict.end_time,
                conflict_type: conflict.conflict_type,
                requirements: conflict.requirements,
            })
            .collect();

        // Return the conflicts found along with the pathfinding result for the virtual train.
        Ok(StdcmResponse::Conflicts {
            pathfinding_result: pathfinding,
            conflicts,
        })
    }
}
