use std::collections::BTreeSet;
use std::collections::HashMap;
use std::hash::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher as _;
use std::sync::Arc;
use std::task::Poll;

use core_client::AsCoreRequest as _;
use core_client::CoreClient;
use dashmap::DashMap;
use futures::stream;
use itertools::Itertools;
use ordered_float::OrderedFloat;
use schemas::infra::TrackOffset;
use schemas::rolling_stock::LoadingGaugeType;

use crate::CoreEnv;
use crate::Correlated;
use crate::Task;
use crate::TrainKey;
use crate::TrainSet;

// ========== Environment public API ==========

/// An environment to compute and cache paths asynchronously
///
/// Provides [PathfindingEnv::run] and [PathfindingEnv::into_stream] to build, run,
/// cache and return paths computed by Core. Use [PathfindingEnv::extend] to add train
/// consist information and pathfinding constraints in the environment. See [PathfindingTrain].
///
/// `Train` generic parameter is a correlation key to associate each path to a train.
/// It will be cloned several times over internally, so this operation should be cheap.
pub struct PathfindingEnv<Train>
where
    Train: TrainKey + 'static,
{
    pub(in crate::envs) core_env: CoreEnv,
    pub(in crate::envs) inputs: PathfindingEnvInputs<Train>,
}

impl<Train> PathfindingEnv<Train>
where
    Train: TrainKey + 'static,
{
    pub fn new(core_env: CoreEnv) -> Self {
        Self {
            core_env,
            inputs: PathfindingEnvInputs::default(),
        }
    }

    /// Computes paths or fetches them from cache asynchronously
    ///
    /// Returns a [PathfindingRun] containing the calculated paths (or errors)
    /// of each [TrainSet]. They are pushed in the object progressively as the results
    /// arrive. Hence why [fn PathfindingRun::get_path] returns a [Poll].
    ///
    /// To follow what's been calculated, this function accepts a channel sender
    /// to notify each time a [TrainSet] is done processing.
    /// Note that the receivers implement [trait futures::stream::Stream].
    pub fn run(
        self,
        vk_client: Arc<cache::Client>,
        ready_trains_tx: Option<futures::channel::mpsc::UnboundedSender<TrainSet<Train>>>,
    ) -> PathfindingRun<Train> {
        use stream::StreamExt as _;
        let runner = Arc::new(Runner::new(self));
        let run = PathfindingRun::new(&runner);
        let paths = run.paths.clone();
        tokio::spawn(runner.clone().stream(vk_client).fold(
            (paths, runner, ready_trains_tx),
            async |(paths, runner, ready_trains_tx),
                   Correlated {
                       correlation_key: input,
                       data,
                   }| {
                if let Some(tx) = ready_trains_tx.as_ref() {
                    let trains = runner
                        .train_set(&input)
                        .expect("input provided by the Runner should be valid");
                    tx.unbounded_send(trains).ok();
                }
                paths.insert(input, Poll::Ready(data.map(Arc::new)));
                (paths, runner, ready_trains_tx)
            },
        ));
        run
    }

    /// Computes paths or fetches them from cache asynchronously
    ///
    /// Doesn't store the paths unlike [PathfindingEnv::run].
    /// The returned stream yields a [TrainSet] and their corresponding path directly,
    /// avoiding the caller to deal with the `Arc` returned by [PathfindingEnv::get_path],
    /// thus transferring ownership and allow easy path mutations.
    pub fn into_stream(
        self,
        vk_client: Arc<cache::Client>,
    ) -> impl stream::Stream<
        Item = Correlated<
            TrainSet<Train>,
            Result<core_client::pathfinding::PathfindingCoreResult, core_client::Error>,
        >,
    > {
        use stream::StreamExt as _;
        let runner = Arc::new(Runner::new(self));
        runner.clone().stream(vk_client).map(
            move |Correlated {
                      correlation_key: input,
                      data: path,
                  }| {
                let trains = runner
                    .train_set(&input)
                    .expect("input provided by the Runner should be valid");
                Correlated::new(trains, path)
            },
        )
    }
}

// ========== Input management ==========

/// Necessary inputs of a train to provide [PathfindingEnv]
#[derive(Debug)]
pub struct PathfindingTrain {
    pub consist: PathfindingConsist,
    pub constraints: PathfindingConstraints,
}

#[derive(Debug)]
#[cfg_attr(test, derive(Clone))]
pub(crate) struct PathfindingEnvInputs<Train>
where
    Train: TrainKey + 'static,
{
    // TODO: deduplicate values
    consists: HashMap<Train, Arc<PathfindingConsist>>,
    constraints: HashMap<Train, Arc<PathfindingConstraints>>,
}

impl<Train> Default for PathfindingEnvInputs<Train>
where
    Train: TrainKey + 'static,
{
    fn default() -> Self {
        Self {
            consists: HashMap::default(),
            constraints: HashMap::default(),
        }
    }
}

#[derive(Debug, Hash, PartialEq, Eq)]
#[cfg_attr(test, derive(Clone))]
pub struct PathfindingConsist {
    pub loading_gauge: LoadingGaugeType,
    /// Can the consist run on non-electrified tracks
    pub thermal: bool,
    /// Supported electrification modes (leave empty for unelectrified consists)
    pub supported_electrifications: BTreeSet<String>,
    /// A list of supported signaling systems
    pub supported_signaling_systems: BTreeSet<String>,
    pub maximum_speed: OrderedFloat<f64>,
    /// Consist length in millimeters
    pub length: u64,
    /// Speed limit tag to estimate maximum speed and travel time
    pub speed_limit_tag: Option<String>,
}

#[derive(Debug, Hash, PartialEq, Eq)]
#[cfg_attr(test, derive(Clone))]
pub struct PathfindingConstraints {
    /// An ordered list of waypoints the resulting path must pass through
    pub path_items: Vec<PathItemConstraint>,
    /// Set of authorized track section ids, empty means no restriction
    pub allowed_track_sections: BTreeSet<String>,
}

/// A waypoint the resulting path must pass through
///
/// The waypoint is given as a set of [TrackOffset] alternatives: the resulting
/// path can cross any of these.
#[derive(Debug, Hash, PartialEq, Eq)]
#[cfg_attr(test, derive(Clone))]
pub struct PathItemConstraint {
    pub path_item_alternatives: Vec<TrackOffset>,
    /// Whether the train is allowed to backtrack at this waypoint
    pub can_backtrack: bool,
}

#[cfg(test)]
impl PathItemConstraint {
    /// Reserved to tests: everywhere else, build the struct with named fields so that the origin
    /// of `can_backtrack` stays explicit at the call site
    pub(crate) fn new(
        path_item_alternatives: impl IntoIterator<Item = TrackOffset>,
        can_backtrack: bool,
    ) -> Self {
        Self {
            path_item_alternatives: path_item_alternatives.into_iter().collect(),
            can_backtrack,
        }
    }
}

impl<Train> Extend<(Train, PathfindingTrain)> for PathfindingEnv<Train>
where
    Train: TrainKey + 'static,
{
    fn extend<T: IntoIterator<Item = (Train, PathfindingTrain)>>(&mut self, iter: T) {
        let iter = iter.into_iter().map(
            |(
                train,
                PathfindingTrain {
                    consist,
                    constraints,
                },
            )| {
                (
                    (train.clone(), Arc::new(consist)),
                    (train, Arc::new(constraints)),
                )
            },
        );
        let (consists, constraints): (Vec<_>, Vec<_>) = iter.into_iter().unzip();
        self.inputs.consists.extend(consists);
        self.inputs.constraints.extend(constraints);
    }
}

impl<Train> PathfindingEnvInputs<Train>
where
    Train: TrainKey + 'static,
{
    fn iter(&self) -> impl Iterator<Item = Correlated<Train, PathfindingKey>> {
        self.consists.keys().map(|train| {
            let pf_key = self
                .train_input(train)
                .expect("PathfindingEnv::extend invariant");
            Correlated::new(train.clone(), pf_key)
        })
    }

    pub(in crate::envs) fn train_input(&self, train: &Train) -> Option<PathfindingKey> {
        let consist = self.consists.get(train)?;
        let constraints = self.constraints.get(train)?;
        Some(PathfindingKey(consist.clone(), constraints.clone()))
    }
}

// ========== Low-level runner ==========

/// Internal context allowing running pathfinding tasks
///
/// Built from a [PathfindingEnv] using [Runner::new] which builds indexes in
/// its internal state. Do not create this struct directly.
pub(in crate::envs) struct Runner<Train>
where
    Train: TrainKey + 'static,
{
    core_env: CoreEnv,
    pub(in crate::envs) pathfinding_inputs: Arc<PathfindingEnvInputs<Train>>,
    rev: DashMap<PathfindingKey, TrainSet<Train>>,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub(in crate::envs) struct PathfindingKey(
    pub(in crate::envs) Arc<PathfindingConsist>,
    pub(in crate::envs) Arc<PathfindingConstraints>,
);

impl<Train> Runner<Train>
where
    Train: TrainKey + 'static,
{
    pub(in crate::envs) fn new(PathfindingEnv { core_env, inputs }: PathfindingEnv<Train>) -> Self {
        let rev = DashMap::<PathfindingKey, TrainSet<Train>>::new();
        for Correlated {
            correlation_key: train,
            data: input,
        } in inputs.iter()
        {
            rev.entry(input).or_default().insert(train);
        }
        Self {
            core_env: core_env.clone(),
            pathfinding_inputs: Arc::new(inputs),
            rev,
        }
    }

    pub(in crate::envs) fn train_set(&self, input: &PathfindingKey) -> Option<TrainSet<Train>> {
        self.rev.get(input).as_deref().cloned()
    }

    fn iter_keys(&self) -> impl Iterator<Item = PathfindingKey> {
        self.rev.iter().map(|set| set.key().clone())
    }

    pub(in crate::envs) fn stream(
        self: Arc<Self>,
        vk_client: Arc<cache::Client>,
    ) -> impl stream::Stream<
        Item = Correlated<
            PathfindingKey,
            Result<core_client::pathfinding::PathfindingCoreResult, core_client::Error>,
        >,
    > {
        use crate::TaskStreamExt as _;

        let requests = self
            .iter_keys()
            .map(|input| {
                let request = build_request(&self.core_env, &input);
                Correlated::new(input, request)
            })
            .collect_vec();

        stream::iter(requests).run(vk_client, self.core_env.client.clone())
    }
}

// ========== Stateful run ==========

/// The result of [PathfindingEnv::run]
///
/// Stores each pathfinding result as they arrive. So [fn PathfindingRun::get_path]
/// might return that a result is still pending. The [TrainSet]s done being calculated
/// can be tracked by providing a channel sender to [PathfindingEnv::run].
///
/// Cheap to clone.
#[derive(Debug, Clone)]
pub struct PathfindingRun<Train>
where
    Train: TrainKey + 'static,
{
    inputs: Arc<PathfindingEnvInputs<Train>>,
    // optionally deduplicate similar outputs of different inputs
    paths: Arc<DashMap<PathfindingKey, PendingPathfindingResult>>,
}

/// Ready when the pathfinding result is available and stored in [PathfindingRun], pending if the task is not yet completed
type PendingPathfindingResult =
    Poll<Result<Arc<core_client::pathfinding::PathfindingCoreResult>, core_client::Error>>;

impl<Train> PathfindingRun<Train>
where
    Train: TrainKey + 'static,
{
    fn new(runner: &Runner<Train>) -> Self {
        let paths = DashMap::from_iter(
            runner
                .iter_keys()
                .zip(std::iter::repeat_with(|| Poll::Pending)),
        );
        Self {
            inputs: runner.pathfinding_inputs.clone(),
            paths: Arc::new(paths),
        }
    }

    /// Returns the path for a given train
    ///
    /// A `None` value can either mean that:
    ///
    /// - the train is not in the [PathfindingEnv]
    /// - the train is not ready (either missing consist or constraints)
    pub fn get_path(&self, train: &Train) -> Option<PendingPathfindingResult> {
        let input = self.inputs.train_input(train)?;
        let value_ref = self.paths.get(&input)?;
        let value = value_ref.value().clone();
        Some(value)
    }
}

// ========== Core requests ==========
pub fn pathfinding_request_from_consist_constraints(
    infra: i64,
    expected_version: i64,
    consist: &PathfindingConsist,
    constraints: &PathfindingConstraints,
) -> core_client::pathfinding::PathfindingRequest {
    core_client::pathfinding::PathfindingRequest {
        infra,
        expected_version,
        path_items: constraints
            .path_items
            .iter()
            .map(
                |PathItemConstraint {
                     path_item_alternatives: tracks,
                     can_backtrack,
                 }| core_client::pathfinding::PathItem {
                    locations: tracks.clone(),
                    can_backtrack: *can_backtrack,
                },
            )
            .collect(),
        rolling_stock_loading_gauge: consist.loading_gauge,
        rolling_stock_is_thermal: consist.thermal,
        rolling_stock_supported_electrifications: consist.supported_electrifications.clone(),
        rolling_stock_supported_signaling_systems: consist.supported_signaling_systems.clone(),

        rolling_stock_maximum_speed: consist.maximum_speed,
        rolling_stock_length: consist.length,
        speed_limit_tag: consist.speed_limit_tag.clone(),
        stops_at_end_of_block: Some(false),
        allowed_track_sections: constraints.allowed_track_sections.clone(),
    }
}

fn build_request(
    core_env: &CoreEnv,
    PathfindingKey(consist, constraints): &PathfindingKey,
) -> core_client::pathfinding::PathfindingRequest {
    let infra_id = core_env.infra_id as i64;
    let version = core_env.infra_version;
    pathfinding_request_from_consist_constraints(infra_id, version, consist, constraints)
}

impl Task for core_client::pathfinding::PathfindingRequest {
    type Output = core_client::pathfinding::PathfindingCoreResult;
    type Error = core_client::Error;
    type Context = Arc<CoreClient>;

    // The compressed size of a pathfinding is:
    // - Mean: 3.5kB
    // - 50th percentile: 1.9kB
    // - Max: 28.8kB
    // Therefore, we can safely batch 250 to have around 1MB of data per request.
    const CACHE_READS_BATCH_SIZE: usize = 250;

    fn key(&self, app_version: &str) -> String {
        let mut hasher = DefaultHasher::new();
        self.hash(&mut hasher);
        let req_hash = hasher.finish().to_string();
        format!("editoast.{app_version}.pathfinding.{req_hash}")
    }

    async fn compute(self, ctx: Self::Context) -> Result<Self::Output, Self::Error> {
        self.fetch(ctx.as_ref()).await
    }
}

#[cfg(test)]
pub(crate) mod test_data {
    use super::*;

    /// We use the length field to identify it since the content doesn't matter
    pub(super) fn path(id: usize) -> serde_json::Value {
        let mut path = serde_json::json!({
            "status": "success",
            "length": id,
            "path_item_positions": [],
            "path": {
                "blocks": [],
                "routes": [],
                "track_section_ranges": []
            }
        });
        path.sort_all_objects();
        path
    }

    pub(crate) fn constraints(id: usize) -> PathfindingConstraints {
        PathfindingConstraints {
            path_items: vec![
                PathItemConstraint::new([TrackOffset::new("id", id as u64)], false),
                PathItemConstraint::new(
                    [
                        TrackOffset::new("tr1", 100),
                        TrackOffset::new("tr1bis", 100),
                    ],
                    false,
                ),
                PathItemConstraint::new([TrackOffset::new("tr2", 200)], false),
            ],
            allowed_track_sections: BTreeSet::new(),
        }
    }

    pub(crate) fn consist(id: usize) -> PathfindingConsist {
        PathfindingConsist {
            loading_gauge: LoadingGaugeType::GB,
            thermal: true,
            supported_electrifications: BTreeSet::new(),
            supported_signaling_systems: BTreeSet::from(["BAPR".to_owned()]),
            maximum_speed: OrderedFloat::from(100.0),
            length: id as u64,
            speed_limit_tag: Some("MA100".to_owned()),
        }
    }

    pub(crate) fn train(id: usize) -> PathfindingTrain {
        PathfindingTrain {
            consist: consist(id),
            constraints: constraints(id),
        }
    }

    impl PathfindingEnv<usize> {
        pub(crate) fn key(&self, id: usize) -> String {
            let input = self.inputs.train_input(&id).unwrap();
            let request = build_request(&self.core_env, &input);
            use crate::Task as _;
            request.key("")
        }
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use core_client::mocking::MockingClient;
    use deadpool_redis::redis;
    use http::StatusCode;

    use crate::compress_json;
    use crate::mock_mget;

    use super::test_data::*;
    use super::*;

    // TODO: Adapt this test so we mock `json_get_bulk` instead of `MGET` and avoid dealing with compressed values in the test.
    #[tokio::test]
    async fn pathfinding_env() {
        common::setup_tracing_for_test();

        let mut mock = MockingClient::new();
        mock.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(path(2))
            .finish();

        let mut pfenv = PathfindingEnv::<usize>::new(CoreEnv::new_mock(mock));
        pfenv.extend([(1, train(1)), (2, train(2))]);

        let vk = Arc::new(cache::Client::new_mock(
            vec![
                mock_mget(vec![
                    (pfenv.key(1), Some(compress_json(&path(1)))),
                    (pfenv.key(2), None),
                ]),
                cache::MockCmd::new(
                    redis::cmd("MSET")
                        .arg(pfenv.key(2))
                        .arg(compress_json(&path(2))),
                    Ok(redis::Value::Nil),
                ),
            ],
            "",
        ));

        let (tx, rx) = futures::channel::mpsc::unbounded();
        let pfrun = pfenv.run(vk, Some(tx));

        // timeout to avoid blocking the CI if something goes wrong
        let trains = tokio::time::timeout(Duration::from_secs(1), async move {
            use stream::StreamExt as _;
            rx.map(stream::iter)
                .flatten()
                .collect::<TrainSet<_>>()
                .await
        })
        .await
        .unwrap();
        assert_eq!(trains, TrainSet::from([1, 2]));

        assert_eq!(
            pfrun.get_path(&1),
            Some(Poll::Ready(Ok(serde_json::from_value(path(1)).unwrap())))
        );
        assert_eq!(
            pfrun.get_path(&2),
            Some(Poll::Ready(Ok(serde_json::from_value(path(2)).unwrap())))
        );
        assert_eq!(pfrun.get_path(&3), None);
    }

    // PathfindingEnv::run applies another deduplication to the results, this test
    // ensures into_stream deduplicates correctly as well.
    #[tokio::test]
    async fn pathfinding_env_into_stream() {
        common::setup_tracing_for_test();

        // A unique train seed to generate twice the same inputs
        const TRAIN: usize = 123456789;

        let mut mock = MockingClient::new();
        mock.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(path(TRAIN))
            .finish();
        mock.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(path(TRAIN))
            .finish();

        let mut pfenv = PathfindingEnv::<usize>::new(CoreEnv::new_mock(mock));
        pfenv.extend([(1, train(TRAIN)), (2, train(TRAIN))]);

        let vk = Arc::new(cache::Client::new(cache::Config::NoCache, ""));

        use futures::StreamExt as _;
        let results = tokio::time::timeout(Duration::from_secs(1), async move {
            pfenv.into_stream(vk).collect::<Vec<_>>().await
        })
        .await
        .unwrap();

        assert_eq!(results.len(), 1);
        assert_eq!(
            results,
            vec![Correlated::new(
                TrainSet::from([1, 2]),
                Ok(serde_json::from_value(path(TRAIN)).unwrap()),
            )]
        );
    }
}
