mod inputs;
pub use inputs::*;

mod request;
use request::build_request;

use std::collections::HashMap;
use std::hash::Hash;
use std::sync::Arc;

use dashmap::DashMap;
use futures::stream;
use tokio::sync::Mutex;

use crate::CoreEnv;
use crate::Correlated;
use crate::PathfindingEnv;
use crate::TrainKey;
use crate::TrainSet;
use crate::envs::pathfinding;
use crate::envs::pathfinding::PathfindingEnvInputs;

// ========== Environment public API ==========

/// An environment to compute and cache running simulations asynchronously
///
/// Provides [SimulationEnv::into_stream] to build, run,
/// cache and return simulations computed by Core. Use [SimulationEnv::extend] to add
/// necessary inputs to the environment through [SimulationTrain].
///
/// Paths are required to perform a simulation, so this environment embeds a [PathfindingEnv].
/// Required paths will be fetched from cache when available or be computed otherwise.
/// Any pathfinding failure is forwarded by [SimulationOutput::PathfindingFailure].
///
/// `Train` generic parameter is a correlation key to associate each path to a train.
/// It will be cloned several times over internally, so this operation should be cheap.
pub struct SimulationEnv<Train>
where
    Train: TrainKey + 'static,
{
    pathfinding_env: PathfindingEnv<Train>,
    inputs: SimulationInputs<Train>,
}

/// Success type for [SimulationEnv::into_stream]
///
/// It is necessary to obtain a path to run a simulation, but pathfinding request may fail.
/// The error is forwarded by [SimulationOutput::PathfindingFailure].
#[derive(Debug, Clone)]
#[cfg_attr(test, derive(PartialEq))]
#[expect(clippy::large_enum_variant)] // success is large, we can Box it if it becomes problematic but it's less convenient
pub enum SimulationOutput {
    /// Yay!
    Success(core_client::simulation::SimulationSuccess),
    /// The pathfinding has failed, we are unable to get the path information necessary for simulation
    ///
    /// FIXME: [core_client::pathfinding::PathfindingCoreResult] needs to be reworked, its `Success` variant
    /// cannot happen here.
    PathfindingFailure(core_client::pathfinding::PathfindingCoreResult),
}

impl<Train> SimulationEnv<Train>
where
    Train: TrainKey + 'static,
{
    pub fn new(core_env: CoreEnv) -> Self {
        Self {
            pathfinding_env: PathfindingEnv::new(core_env),
            inputs: SimulationInputs {
                electrical_profile_set_id: None,
                consists: Default::default(),
                parameters: Default::default(),
            },
        }
    }

    pub fn new_with_electrical_profile_set(
        core_env: CoreEnv,
        electrical_profile_set_id: u64,
    ) -> Self {
        Self {
            pathfinding_env: PathfindingEnv::new(core_env),
            inputs: SimulationInputs {
                electrical_profile_set_id: Some(electrical_profile_set_id),
                consists: Default::default(),
                parameters: Default::default(),
            },
        }
    }

    /// Computes running simulations or fetches them from cache asynchronously
    ///
    /// The returned stream yields a [TrainSet] and their corresponding simulation directly.
    ///
    /// TODO: `SimulationEnv::run` to be able to retrieve paths as well.
    pub fn into_stream(
        self,
        vkconn: Arc<Mutex<cache::Connection>>,
    ) -> impl stream::Stream<
        Item = Correlated<TrainSet<Train>, Result<SimulationOutput, core_client::Error>>,
    > {
        use stream::StreamExt as _;
        let runner = Arc::new(Runner::new(self));
        runner.clone().stream(vkconn).map(
            move |Correlated {
                      correlation_key: input,
                      data: sim_output,
                  }| {
                let trains = runner.train_set(&input);
                Correlated::new(trains, sim_output)
            },
        )
    }
}

// ========== Low-level runner ==========

/// Internal context allowing running simulation tasks
///
/// Built from a [SimulationEnv] using [Runner::new] which builds indexes in
/// its internal state. Do not create this struct directly.
pub(in crate::envs) struct Runner<Train>
where
    Train: TrainKey + 'static,
{
    core_env: CoreEnv,
    simulation_inputs: Arc<SimulationInputs<Train>>,
    pathfinding_runner: Arc<pathfinding::Runner<Train>>,

    /// Reverse index grouping all trains that have the same simulation and pathfinding inputs
    rev: DashMap<SimulationKey, TrainSet<Train>>,
}

#[derive(Debug, Hash, PartialEq, Eq)]
pub(in crate::envs) struct SimulationKey(
    Arc<SimulationConsist>,
    Arc<SimulationTrainParameters>,
    pathfinding::PathfindingKey,
);

impl<Train> Runner<Train>
where
    Train: TrainKey + 'static,
{
    pub(in crate::envs) fn new(
        SimulationEnv {
            pathfinding_env,
            inputs,
        }: SimulationEnv<Train>,
    ) -> Self {
        let core_env = pathfinding_env.core_env.clone();
        let pathfinding_runner = Arc::new(pathfinding::Runner::new(pathfinding_env));
        let rev = DashMap::<SimulationKey, TrainSet<Train>>::new();
        for Correlated {
            correlation_key: train,
            data: sim_key,
        } in inputs.iter(&pathfinding_runner.pathfinding_inputs)
        {
            rev.entry(
                sim_key.expect("SimulationEnv and PathfindingEnv should have the same trains"),
            )
            .or_default()
            .insert(train);
        }
        Self {
            core_env,
            simulation_inputs: Arc::new(inputs),
            pathfinding_runner,
            rev,
        }
    }

    fn train_set(&self, key: &SimulationKey) -> TrainSet<Train> {
        self.rev.get(key).expect("Runner::new invariant").clone()
    }

    /// Trains sharing the same pathfinding key (= inputs), therefore having the same path,
    /// do not necessarily share the same simulation key (simulation inputs differ).
    fn simulation_keys_of_pathfinding_key(
        &self,
        pathfinding_key: &pathfinding::PathfindingKey,
    ) -> impl Iterator<Item = SimulationKey> {
        self.pathfinding_runner
            .train_set(pathfinding_key)
            .into_iter()
            .flatten()
            .filter_map(|train| {
                self.simulation_inputs
                    .train_input(&train, &self.pathfinding_runner.pathfinding_inputs)
            })
    }

    pub(in crate::envs) fn stream(
        self: Arc<Self>,
        vkconn: Arc<Mutex<cache::Connection>>,
    ) -> impl stream::Stream<
        Item = Correlated<SimulationKey, Result<SimulationOutput, core_client::Error>>,
    > {
        use stream::StreamExt as _;
        // a channel passing simulation requests
        let (simulate_tx, simulate_rx) = futures::channel::mpsc::unbounded();
        // the channel which receiver is the stream returned by this function
        let (return_tx, return_rx) = futures::channel::mpsc::unbounded::<
            Correlated<SimulationKey, Result<SimulationOutput, core_client::Error>>,
        >();

        tokio::spawn(self.pathfinding_runner.clone().stream(vkconn.clone()).fold(
            // a trick to "move" context into the closure but keeping it AsyncFnMut
            (self.clone(), simulate_tx, return_tx.clone()),
            async |(runner, simulate_tx, return_tx), result| {
                let (trains, path) = match result {
                    Correlated {
                        correlation_key: pf_key,
                        data: Ok(core_client::pathfinding::PathfindingCoreResult::Success(path)),
                    } => {
                        let trains = runner.pathfinding_runner.train_set(&pf_key).expect("input provided by the runner should be valid");
                        (trains, path)
                    }
                    Correlated {
                        correlation_key: pf_key,
                        data: Ok(failure),
                    } => {
                        for sim_key in runner.simulation_keys_of_pathfinding_key(&pf_key)
                        {
                            return_tx
                                .unbounded_send(Correlated::new(
                                    sim_key,
                                    Ok(SimulationOutput::PathfindingFailure(failure.clone())),
                                ))
                                .ok();
                        }
                        return (runner, simulate_tx, return_tx);
                    }
                    Correlated {
                        correlation_key: pf_key,
                        data: Err(err),
                    } => {
                        for sim_key in runner.simulation_keys_of_pathfinding_key(&pf_key)
                        {
                            return_tx
                                .unbounded_send(Correlated::new(sim_key, Err(err.clone())))
                                .ok();
                        }
                        return (runner, simulate_tx, return_tx);
                    }
                };

                let requests = trains
                    .into_iter()
                    .zip(std::iter::repeat(path))
                    .map(|(train, path)| {
                        let sim_key = runner
                            .simulation_inputs
                            .train_input(
                                &train,
                                &runner.pathfinding_runner.pathfinding_inputs,
                            )
                            .expect("provided trains must be ready to simulate");
                        let request = build_request(
                            &runner.core_env,
                            runner.simulation_inputs.electrical_profile_set_id,
                            &sim_key,
                            path,
                        );
                        (sim_key, request)
                    })
                    .collect::<HashMap<_, _>>();

                for (sim_key, request) in requests {
                    if let Ok(request) = request {
                        simulate_tx
                            .unbounded_send(Correlated::new(sim_key, request))
                            .ok();
                    } else {
                        // This error is sent by Core when we provide it with a single path item.
                        // But the semantic still fits for our case and it is probably not worth having a new error variant
                        // for an error we can't do anything about.
                        return_tx
                            .unbounded_send(Correlated::new(
                                sim_key,
                                Ok(SimulationOutput::PathfindingFailure(core_client::pathfinding::PathfindingCoreResult::NotEnoughPathItems))
                            ))
                            .ok();
                    }
                }
                (runner, simulate_tx, return_tx)
            },
        ));

        use crate::TaskStreamExt as _;
        tokio::spawn(
            simulate_rx
                .run(vkconn, self.core_env.client.clone())
                .map(move |result|
                    match result {
                        Correlated {
                            correlation_key: sim_key,
                            data: Ok(core_client::simulation::Response::Success(simulation)),
                        } => {
                            return_tx
                                .unbounded_send(Correlated::new(sim_key, Ok(SimulationOutput::Success(simulation))))
                                .ok();
                        }
                        Correlated {
                            correlation_key: sim_key,
                            data: Ok(core_client::simulation::Response::SimulationFailed { core_error }),
                        } => {
                            return_tx
                                .unbounded_send(Correlated::new(sim_key, Err(core_client::Error::RawError(core_error))))
                                .ok();
                        }
                        Correlated {
                            correlation_key: sim_key,
                            data: Err(err),
                        } => {
                            return_tx.unbounded_send(Correlated::new(sim_key, Err(err))).ok();
                        }
                    })
                .collect::<Vec<_>>()
        );

        return_rx
    }
}

#[cfg(test)]
pub(crate) mod test_data {
    use schemas::infra::TrackOffset;
    use schemas::primitives::NonBlankString;
    use schemas::train_schedule::MarginValue;

    use super::*;

    /// We use the length field to identify it since the content doesn't matter
    pub(crate) fn path(id: usize, positions_count: u64) -> serde_json::Value {
        let response = core_client::pathfinding::PathfindingCoreResult::Success(
            core_client::pathfinding::PathfindingResultSuccess {
                path: core_client::pathfinding::TrainPath {
                    blocks: Vec::new(),
                    routes: Vec::new(),
                    track_section_ranges: Vec::new(),
                },
                length: id as u64,
                path_item_positions: (1..=positions_count).collect(),
                backtrack_positions: Some(vec![]),
            },
        );
        let mut path = serde_json::to_value(response).unwrap();
        path.sort_all_objects();
        path
    }

    /// The id is put in `base.positions[0]`
    pub(crate) fn simulation_success(id: usize) -> serde_json::Value {
        let response = core_client::simulation::Response::Success(
            core_client::simulation::SimulationSuccess {
                base: core_client::simulation::ReportTrain {
                    positions: vec![id as u64],
                    times: vec![],
                    speeds: vec![],
                    energy_consumption: 0.0,
                    path_item_times: vec![0, 10],
                },
                provisional: core_client::simulation::ReportTrain {
                    positions: vec![],
                    times: vec![0, 10],
                    speeds: vec![],
                    energy_consumption: 0.0,
                    path_item_times: vec![0, 10],
                },
                final_output: core_client::simulation::CompleteReportTrain {
                    report_train: core_client::simulation::ReportTrain {
                        positions: vec![],
                        times: vec![],
                        speeds: vec![],
                        energy_consumption: 0.0,
                        path_item_times: vec![0, 10],
                    },
                    signal_critical_positions: vec![],
                    zone_updates: vec![],
                    spacing_requirements: vec![],
                    routing_requirements: vec![],
                },
                mrsp: core_client::simulation::SpeedLimitProperties {
                    boundaries: vec![],
                    values: vec![],
                },
                electrical_profiles: core_client::simulation::ElectricalProfiles {
                    boundaries: vec![],
                    values: vec![],
                },
            },
        );
        let mut json = serde_json::to_value(response).unwrap();
        json.sort_all_objects();
        json
    }

    pub(crate) fn consist(id: usize) -> SimulationConsist {
        use schemas::rolling_stock::*;
        SimulationConsist(core_client::simulation::PhysicsConsist {
            effort_curves: EffortCurves::default(),
            base_power_class: Some(id.to_string()),
            length: Default::default(),
            max_speed: Default::default(),
            startup_time: Default::default(),
            startup_acceleration: Default::default(),
            comfort_acceleration: Default::default(),
            const_gamma: Default::default(),
            etcs_brake_params: Default::default(),
            inertia_coefficient: Default::default(),
            mass: Default::default(),
            rolling_resistance: Default::default(),
            power_restrictions: Default::default(),
            electrical_power_startup_time: Default::default(),
            raise_pantograph_time: Default::default(),
        })
    }

    pub(crate) fn train(id: usize) -> SimulationTrain {
        let mut builder = SimulationTrain::new(
            self::consist(id),
            pathfinding::test_data::consist(id),
            SimulationTrainParameters::new(
                Default::default(),
                Default::default(),
                Default::default(),
                None,
                Default::default(),
            ),
        );
        builder.push_schedule_item(
            pathfinding::PathItemAlternatives::from_iter([TrackOffset::new("id", id as u64)]),
            NonBlankString::from("start"),
            ScheduleItem::PathItem,
        );
        builder.push_schedule_item(
            pathfinding::PathItemAlternatives::from_iter([TrackOffset::new("a", 42)]),
            NonBlankString::from("a"),
            ScheduleItem::ScheduleItem {
                arrival_at: Some(1200),
                stop_for: Some(60),
                reception_signal: Default::default(),
            },
        );
        builder.push_schedule_item(
            pathfinding::PathItemAlternatives::from_iter([
                TrackOffset::new("b", 43),
                TrackOffset::new("bis", 34),
            ]),
            NonBlankString::from("b"),
            ScheduleItem::ScheduleItem {
                arrival_at: None,
                stop_for: Some(120),
                reception_signal: Default::default(),
            },
        );
        builder.push_schedule_item(
            pathfinding::PathItemAlternatives::from_iter([TrackOffset::new("finish", 44)]),
            NonBlankString::from("finish"),
            ScheduleItem::ScheduleItem {
                arrival_at: Some(2400),
                stop_for: Some(0),
                reception_signal: Default::default(),
            },
        );

        builder.set_power_restriction("start", "a", "blackout".to_owned());
        builder.set_margin("start", "finish", MarginValue::Percentage(15.0));
        builder.set_margin("a", "b", MarginValue::MinPer100Km(123.4));

        builder
    }

    impl SimulationEnv<usize> {
        pub(crate) fn cache_key(&self, id: usize) -> String {
            let path = match serde_json::from_value(path(id, 4)) {
                Ok(core_client::pathfinding::PathfindingCoreResult::Success(path)) => path,
                _ => unreachable!("invalid test setup"),
            };
            let key = self
                .inputs
                .train_input(&id, &self.pathfinding_env.inputs)
                .unwrap();
            let request = build_request(
                &self.pathfinding_env.core_env,
                self.inputs.electrical_profile_set_id,
                &key,
                path,
            )
            .unwrap();
            use crate::Task as _;
            request.key("")
        }
    }
}

#[cfg(test)]
mod tests {
    use core_client::mocking::MockingClient;
    use deadpool_redis::redis;
    use http::StatusCode;
    use pretty_assertions::assert_eq;

    use crate::mock_mget;

    use super::test_data::*;
    use super::*;

    #[tokio::test]
    async fn simulation_env_into_stream() {
        common::setup_tracing_for_test();

        let mut mock = MockingClient::new();
        mock.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(path(2, 4))
            .finish();
        mock.stub("/standalone_simulation")
            .response(StatusCode::OK)
            .json(simulation_success(2))
            .finish();

        let mut simenv = SimulationEnv::<usize>::new(CoreEnv::new_mock(mock));
        simenv.extend([(1, train(1)), (2, train(2))]);

        let vk = cache::Client::new_mock(
            vec![
                mock_mget(vec![
                    (simenv.pathfinding_env.key(1), Some(path(1, 4))),
                    (simenv.pathfinding_env.key(2), Some(path(2, 4))),
                ]),
                mock_mget(vec![
                    (simenv.cache_key(1), Some(simulation_success(1))),
                    (simenv.cache_key(2), None),
                ]),
                cache::MockCmd::new(
                    redis::cmd("SET")
                        .arg(simenv.cache_key(2))
                        .arg(simulation_success(2).to_string()),
                    Ok(redis::Value::Nil),
                ),
            ],
            "",
        );

        use futures::StreamExt as _;
        let simulations = simenv
            .into_stream(Arc::new(Mutex::new(vk.get_connection().await.unwrap())))
            .flat_map(
                |Correlated {
                     correlation_key,
                     data,
                 }| {
                    futures::stream::iter(
                        correlation_key
                            .into_iter()
                            .map(move |train| (train, data.clone())),
                    )
                },
            )
            .collect::<HashMap<_, _>>()
            .await;
        assert_eq!(
            *simulations.get(&1).unwrap(),
            Ok(SimulationOutput::Success(
                serde_json::from_value(simulation_success(1)).unwrap()
            )),
        );
        assert_eq!(
            *simulations.get(&2).unwrap(),
            Ok(SimulationOutput::Success(
                serde_json::from_value(simulation_success(2)).unwrap()
            ))
        );
    }
}
