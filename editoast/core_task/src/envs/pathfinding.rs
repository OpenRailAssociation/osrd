use std::collections::HashMap;
use std::collections::HashSet;
use std::hash::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher as _;
use std::sync::Arc;

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

/// An environment to compute and cache paths asynchronously
///
/// Provides [PathfindingEnv::run] and [PathfindingEnv::into_stream] to build, run,
/// cache and return paths computed by Core. Use [PathfindingEnv::extend] to add train
/// consist information and pathfinding constraints in the environment.
///
/// `Train` generic parameter is a correlation key to associate each path to a train.
/// It will be cloned several times over internally, so this operation should be cheap.
pub struct PathfindingEnv<Train>
where
    Train: Clone + Hash + Eq + Send + Sync + 'static,
{
    // Inputs
    core_env: CoreEnv,
    // TODO: deduplicate values
    consists: HashMap<Train, Arc<PathfindingConsist>>,
    constraints: HashMap<Train, Arc<PathfindingConstraints>>,

    // Generated
    trains: HashMap<Input, HashSet<Train>>, // inverse index: unique input set => trains

    // Outputs
    // optionally deduplicate similar outputs of different inputs
    paths: DashMap<Input, Arc<core_client::pathfinding::PathfindingCoreResult>>,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
struct Input(Arc<PathfindingConsist>, Arc<PathfindingConstraints>);

#[derive(Debug, Hash, PartialEq, Eq)]
#[cfg_attr(test, derive(Clone))]
pub struct PathfindingConsist {
    pub loading_gauge: LoadingGaugeType,
    /// Can the consist run on non-electrified tracks
    pub thermal: bool,
    /// Supported electrification modes (leave empty for unelectrified consists)
    pub supported_electrifications: Vec<String>,
    /// A list of supported signaling systems
    pub supported_signaling_systems: Vec<String>,
    pub maximum_speed: OrderedFloat<f64>,
    /// Consist length in meters
    pub length: OrderedFloat<f64>,
    /// Speed limit tag to estimate maximum speed and travel time
    pub speed_limit_tag: Option<String>,
}

#[derive(Debug, Hash, PartialEq, Eq)]
#[cfg_attr(test, derive(Clone))]
pub struct PathfindingConstraints {
    /// An ordered list of waypoints the resulting path must pass through
    pub path_items: Vec<PathWaypointAlternatives>,
}

/// A set of [TrackOffset]
///
/// The resulting path can cross any of these.
#[derive(Debug, Hash, PartialEq, Eq)]
#[cfg_attr(test, derive(Clone))]
pub struct PathWaypointAlternatives(Vec<TrackOffset>);

impl FromIterator<TrackOffset> for PathWaypointAlternatives {
    fn from_iter<T: IntoIterator<Item = TrackOffset>>(iter: T) -> Self {
        Self(iter.into_iter().collect())
    }
}

impl IntoIterator for PathWaypointAlternatives {
    type Item = TrackOffset;
    type IntoIter = <Vec<TrackOffset> as IntoIterator>::IntoIter;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}

impl<Train> PathfindingEnv<Train>
where
    Train: Clone + Hash + Eq + Send + Sync + 'static,
{
    pub fn new(core_env: CoreEnv) -> Self {
        Self {
            core_env,
            consists: HashMap::new(),
            constraints: HashMap::new(),
            trains: HashMap::new(),
            paths: DashMap::new(),
        }
    }
}

impl<Train> Extend<(Train, PathfindingConsist)> for PathfindingEnv<Train>
where
    Train: Clone + Hash + Eq + Send + Sync + 'static,
{
    fn extend<T: IntoIterator<Item = (Train, PathfindingConsist)>>(&mut self, iter: T) {
        self.consists.extend(
            iter.into_iter()
                .map(|(train, consist)| (train, Arc::new(consist))),
        );
        self.build_input_map();
    }
}

impl<Train> Extend<(Train, PathfindingConstraints)> for PathfindingEnv<Train>
where
    Train: Clone + Hash + Eq + Send + Sync + 'static,
{
    fn extend<T: IntoIterator<Item = (Train, PathfindingConstraints)>>(&mut self, iter: T) {
        self.constraints.extend(
            iter.into_iter()
                .map(|(train, constraints)| (train, Arc::new(constraints))),
        );
        self.build_input_map();
    }
}

impl Task for core_client::pathfinding::PathfindingRequest {
    type Output = core_client::pathfinding::PathfindingCoreResult;
    type Error = core_client::Error;
    type Context = Arc<CoreClient>;

    // Please adjust if you have more educated information (and adjust the comment 😉).
    const CACHE_READS_BATCH_SIZE: usize = 50; // This value has been chosen this way: 🫳🎩

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

impl<Train> PathfindingEnv<Train>
where
    Train: Clone + Hash + Eq + Send + Sync + 'static,
{
    /// Computes paths or fetches them from cache asynchronously
    ///
    /// Returns a stream of trains that have been processed. Stream items are
    /// a set of trains because similar requests are deduplicated to avoid
    /// unnecessary computations. All the trains in the set have the same path.
    ///
    /// The path itself can be fetched using [PathfindingEnv::get_path].
    ///
    /// Note that while the paths are stored in the environment, the latter does **not**
    /// act as a cache layer. If we `run([1, 2, 3])` and then `run([1, 2])`, the
    /// environment will try to fetch the path for `1` and `2` from cache *even though*
    /// they are already stored in the environment. Paths are stored in the environment
    /// only for API ergonomics.
    pub fn run<'a>(
        &'a self,
        vkconn: cache::Connection,
        trains: HashSet<Train>,
    ) -> impl stream::TryStream<Ok = HashSet<Train>, Error = core_client::Error> + use<'a, Train>
    {
        use stream::TryStreamExt as _;
        self.paths_stream(vkconn, trains).map_ok(
            move |Correlated {
                      correlation_key: input,
                      data: path,
                  }| {
                let trains = self
                    .trains
                    .get(&input)
                    .expect("deduplicate_inputs invariant")
                    .clone();
                self.paths.insert(input, Arc::new(path));
                trains
            },
        )
    }

    /// Computes paths or fetches them from cache asynchronously
    ///
    /// Doesn't store the paths in the environment unlike [PathfindingEnv::run].
    /// The returned stream yields a set of trains and their corresponding path directly,
    /// avoiding the caller to deal with the `Arc` returned by [PathfindingEnv::get_path],
    /// thus transferring ownership and allow easy path mutations.
    pub fn into_stream(
        &self,
        vkconn: cache::Connection,
        trains: HashSet<Train>,
    ) -> impl stream::TryStream<
        Ok = (
            HashSet<Train>,
            core_client::pathfinding::PathfindingCoreResult,
        ),
        Error = core_client::Error,
    > {
        use stream::TryStreamExt as _;
        self.paths_stream(vkconn, trains).map_ok(
            move |Correlated {
                      correlation_key: input,
                      data: path,
                  }| {
                let trains = self
                    .trains
                    .get(&input)
                    .expect("deduplicate_inputs invariant")
                    .clone();
                (trains, path)
            },
        )
    }

    /// Returns all trains in the environment for which all needed information is configured
    pub fn all_trains(&self) -> HashSet<Train> {
        self.consists
            .keys()
            .collect::<HashSet<_>>()
            .intersection(&self.constraints.keys().collect())
            .cloned()
            .cloned() // not an error, it's an &&Train originally
            .collect()
    }

    /// Returns the path for a given train
    ///
    /// A `None` value can indicate several things:
    ///
    /// - The train is not in the environment
    /// - The train is not ready (either missing consist or constraints)
    /// - The train's path is being computed but its path is not yet available
    ///
    /// NOTE: we should probably expose a better result type for these three cases
    pub fn get_path(
        &self,
        train: &Train,
    ) -> Option<Arc<core_client::pathfinding::PathfindingCoreResult>> {
        let input = self.train_input(train)?;
        let value_ref = self.paths.get(&input)?;
        Some(value_ref.value().clone())
    }

    /// Builds the [Self::trains] map using trains from both [Self::consists] and [Self::constraints]
    ///
    /// TODO: we should build it incrementally to avoid unnecessary complexity
    fn build_input_map(&mut self) {
        self.trains.clear();
        for train in self.all_trains() {
            let consist = self.consists.get(&train).expect("all_trains invariant");
            let constraints = self.constraints.get(&train).expect("all_trains invariant");
            let input = Input(consist.clone(), constraints.clone());
            self.trains.entry(input).or_default().insert(train);
        }
    }

    fn paths_stream(
        &self,
        vkconn: cache::Connection,
        trains: HashSet<Train>,
    ) -> impl stream::TryStream<
        Ok = Correlated<Input, core_client::pathfinding::PathfindingCoreResult>,
        Error = core_client::Error,
    > + use<Train> {
        use crate::TaskStreamExt as _;

        let inputs = trains.iter().map(|train| {
            self.train_input(train)
                .expect("train map should have been built by now")
        });
        let requests = inputs
            .map(|input| {
                let request = self.build_request(&input);
                Correlated::new(input, request)
            })
            .collect_vec();

        stream::iter(requests).run(vkconn, self.core_env.client.clone())
    }

    fn build_request(
        &self,
        Input(consist, constraints): &Input,
    ) -> core_client::pathfinding::PathfindingRequest {
        core_client::pathfinding::PathfindingRequest {
            infra: self.core_env.infra_id as i64,
            expected_version: self.core_env.infra_version,
            path_items: constraints
                .path_items
                .iter()
                .map(|PathWaypointAlternatives(track_alternatives)| {
                    track_alternatives.clone().into_iter().collect()
                })
                .collect(),
            rolling_stock_loading_gauge: consist.loading_gauge,
            rolling_stock_is_thermal: consist.thermal,
            rolling_stock_supported_electrifications: consist.supported_electrifications.clone(),
            rolling_stock_supported_signaling_systems: consist.supported_signaling_systems.clone(),
            rolling_stock_maximum_speed: consist.maximum_speed,
            rolling_stock_length: consist.length,
            speed_limit_tag: consist.speed_limit_tag.clone(),
        }
    }

    fn train_input(&self, train: &Train) -> Option<Input> {
        let consist = self.consists.get(train)?;
        let constraints = self.constraints.get(train)?;
        Some(Input(consist.clone(), constraints.clone()))
    }
}

#[cfg(test)]
mod tests {
    use core_client::mocking::MockingClient;
    use deadpool_redis::redis;
    use futures::TryStreamExt as _;
    use http::StatusCode;
    use serde_json::json;

    use crate::mock_mget;

    use super::*;

    /// We use the length field to identify it since the content doesn't matter
    fn path(id: usize) -> serde_json::Value {
        let mut path = json!({
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

    fn constraints(id: usize) -> PathfindingConstraints {
        PathfindingConstraints {
            path_items: vec![
                PathWaypointAlternatives::from_iter([TrackOffset::new("id", id as u64)]),
                PathWaypointAlternatives::from_iter([
                    TrackOffset::new("tr1", 100),
                    TrackOffset::new("tr1bis", 100),
                ]),
                PathWaypointAlternatives::from_iter([TrackOffset::new("tr2", 200)]),
            ],
        }
    }

    fn consist(id: usize) -> PathfindingConsist {
        PathfindingConsist {
            loading_gauge: LoadingGaugeType::GB,
            thermal: true,
            supported_electrifications: vec![],
            supported_signaling_systems: vec!["BAPR".to_owned()],
            maximum_speed: OrderedFloat::from(100.0),
            length: OrderedFloat::from(id as f64),
            speed_limit_tag: Some("MA100".to_owned()),
        }
    }

    impl PathfindingEnv<usize> {
        fn key(&self, id: usize) -> String {
            let input = self.train_input(&id).unwrap();
            let request = self.build_request(&input);
            use crate::Task as _;
            request.key("")
        }
    }

    #[tokio::test]
    async fn pathfinding_env() {
        common::setup_tracing_for_test();
        let mut mock = MockingClient::new();
        mock.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(path(2))
            .finish();
        let mut pfenv = PathfindingEnv::<usize>::new(CoreEnv::new_mock(mock));
        pfenv.extend([(1, constraints(1)), (2, constraints(2))]);
        pfenv.extend([(1, consist(1)), (2, consist(2))]);
        let vk = cache::Client::new_mock(
            vec![
                mock_mget(vec![(pfenv.key(1), Some(path(1))), (pfenv.key(2), None)]),
                cache::MockCmd::new(
                    redis::cmd("SET").arg(pfenv.key(2)).arg(path(2).to_string()),
                    Ok(redis::Value::Nil),
                ),
            ],
            "",
        );
        let all_trains = pfenv.all_trains();
        assert_eq!(all_trains, HashSet::from([1, 2]));
        let _trains = pfenv
            .run(vk.get_connection().await.unwrap(), all_trains)
            .try_collect::<Vec<_>>()
            .await
            .expect("should go well");
        assert_eq!(
            pfenv.get_path(&1),
            Some(serde_json::from_value(path(1)).unwrap())
        );
        assert_eq!(
            pfenv.get_path(&2),
            Some(serde_json::from_value(path(2)).unwrap())
        );
    }
}
