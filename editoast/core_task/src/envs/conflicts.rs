use common::units::quantities::Offset;
use core_client::AsCoreRequest as _;
use core_client::conflict_detection::TrainRequirements;
use core_client::conflict_detection::WorkSchedulesRequest;
use dashmap::DashMap;
use futures::StreamExt;
use std::str::FromStr;
use std::sync::Arc;

use crate::SimulationEnv;
use crate::SimulationOutput;
use crate::TrainKey;

pub struct ConflictsEnv<Train>
where
    Train: TrainKey + FromStr + ToString + 'static, // The string representation is needed here because core expects the train keys to be strings
{
    simulation: SimulationEnv<Train>,
    start_times: DashMap<Train, Offset>,
    work_schedules: Option<WorkSchedulesRequest>,
}

impl<Train> ConflictsEnv<Train>
where
    Train: TrainKey + FromStr + ToString + 'static,
{
    pub fn from_simulation_env(
        simulation: SimulationEnv<Train>,
        start_times: DashMap<Train, Offset>,
        work_schedules: Option<WorkSchedulesRequest>,
    ) -> Self {
        Self {
            simulation,
            start_times,
            work_schedules,
        }
    }

    pub async fn find_conflicts(
        self,
        vk_client: Arc<cache::Client>,
    ) -> Result<core_client::conflict_detection::ConflictDetectionResponse, core_client::Error>
    {
        let core_client = self.simulation.pathfinding_env.core_env.client.clone();
        let infra = self.simulation.pathfinding_env.core_env.infra_id as i64;
        let expected_version = self.simulation.pathfinding_env.core_env.infra_version;
        let start_times = Arc::new(self.start_times);
        let trains_requirements = self
            .simulation
            .into_stream(vk_client)
            .filter_map(async |correlated| {
                let SimulationOutput::Success(success) = correlated.data.ok()? else {
                    return None;
                };
                let requirements = TrainRequirements {
                    spacing_requirements: success.final_output.spacing_requirements,
                    routing_requirements: success.final_output.routing_requirements,
                };
                Some((correlated.correlation_key, requirements))
            })
            .flat_map(|(keys, requirements)| {
                let start_times = start_times.clone();
                futures::stream::iter(keys).map(move |key| {
                    let start_time = *start_times.get(&key).expect("FIXME");
                    (key.to_string(), requirements.shifted_by(start_time))
                })
            })
            .collect()
            .await;

        let request: core_client::conflict_detection::ConflictDetectionRequest =
            core_client::conflict_detection::ConflictDetectionRequest {
                infra,
                expected_version,
                trains_requirements,
                work_schedules: self.work_schedules,
            };
        request.fetch(&core_client).await
    }
}
