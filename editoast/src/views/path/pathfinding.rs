use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;
use std::sync::Arc;

use authz;
use authz::Role;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use common::units;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::pathfinding::PathfindingCoreResult;
use core_client::pathfinding::PathfindingInputError;
use core_client::pathfinding::PathfindingNotFound;
use core_client::pathfinding::PathfindingRequest;
use core_client::pathfinding::PathfindingResultSuccess;
use database::DbConnection;
use educe::Educe;
use itertools::Itertools;
use ordered_float::OrderedFloat;
use schemas::rolling_stock::LoadingGaugeType;
use schemas::train_schedule::PathItemLocation;
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use serde::Serialize;
use tracing::debug;
use tracing::info;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::Infra;
use crate::models::RollingStock;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::path::PathfindingError;
use crate::views::path::path_item_cache::PathItemCache;
use editoast_models::prelude::*;

/// Path input is described by some rolling stock information
/// and a list of path waypoints
#[derive(Deserialize, Clone, Debug, Hash, ToSchema)]
pub(in crate::views) struct PathfindingInput {
    /// The loading gauge of the rolling stock
    rolling_stock_loading_gauge: LoadingGaugeType,
    /// Can the rolling stock run on non-electrified tracks
    rolling_stock_is_thermal: bool,
    /// List of supported electrification modes.
    /// Empty if does not support any electrification
    rolling_stock_supported_electrifications: Vec<String>,
    /// List of supported signaling systems
    rolling_stock_supported_signaling_systems: Vec<String>,
    /// List of waypoints given to the pathfinding
    path_items: Vec<PathItemLocation>,
    /// Rolling stock maximum speed
    #[schema(value_type = f64)]
    rolling_stock_maximum_speed: OrderedFloat<f64>,
    /// Rolling stock length
    #[schema(value_type = f64)]
    rolling_stock_length: OrderedFloat<f64>,
    /// Speed limit tag, used to estimate the travel time
    speed_limit_tag: Option<String>,
}

impl PathfindingInput {
    /// Generates a unique hash based on the pathfinding entries.
    /// We need to recalculate the path if:
    ///   - The path entry is different
    ///   - The infrastructure has been modified
    ///   - The application has been updated (the algorithm or payloads may have changed)
    fn compute_path_hash_with_versioning(
        &self,
        infra: i64,
        infra_version: i64,
        app_version: Option<&str>,
    ) -> String {
        // Use provided app version or default
        let osrd_version = app_version.unwrap_or("default");
        let mut hasher = DefaultHasher::new();
        self.hash(&mut hasher);
        let hash_path_input = hasher.finish();
        format!("pathfinding_{osrd_version}.{infra}.{infra_version}.{hash_path_input}")
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum PathfindingResult {
    Success(PathfindingResultSuccess),
    Failure(PathfindingFailure),
}

impl From<PathfindingCoreResult> for PathfindingResult {
    fn from(core_result: PathfindingCoreResult) -> Self {
        match core_result {
            PathfindingCoreResult::Success(success) => match success.length {
                0 => PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                    PathfindingInputError::ZeroLengthPath,
                )),
                _ => PathfindingResult::Success(success),
            },
            PathfindingCoreResult::NotFoundInBlocks {
                track_section_ranges,
                length,
            } => PathfindingResult::Failure(PathfindingFailure::PathfindingNotFound(
                PathfindingNotFound::NotFoundInBlocks {
                    track_section_ranges,
                    length,
                },
            )),
            PathfindingCoreResult::NotFoundInRoutes {
                track_section_ranges,
                length,
            } => PathfindingResult::Failure(PathfindingFailure::PathfindingNotFound(
                PathfindingNotFound::NotFoundInRoutes {
                    track_section_ranges,
                    length,
                },
            )),
            PathfindingCoreResult::NotFoundInTracks => PathfindingResult::Failure(
                PathfindingFailure::PathfindingNotFound(PathfindingNotFound::NotFoundInTracks),
            ),
            PathfindingCoreResult::IncompatibleConstraints {
                relaxed_constraints_path,
                incompatible_constraints,
            } => PathfindingResult::Failure(PathfindingFailure::PathfindingNotFound(
                PathfindingNotFound::IncompatibleConstraints {
                    relaxed_constraints_path,
                    incompatible_constraints,
                },
            )),
            PathfindingCoreResult::InvalidPathItems { items } => {
                PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                    PathfindingInputError::InvalidPathItems { items },
                ))
            }
            PathfindingCoreResult::NotEnoughPathItems => {
                PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                    PathfindingInputError::NotEnoughPathItems,
                ))
            }
            PathfindingCoreResult::RollingStockNotFound { rolling_stock_name } => {
                PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                    PathfindingInputError::RollingStockNotFound { rolling_stock_name },
                ))
            }
            PathfindingCoreResult::InternalError { core_error } => {
                PathfindingResult::Failure(PathfindingFailure::InternalError {
                    core_error: core_error.into(),
                })
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema, Educe)]
#[educe(Default)]
#[serde(tag = "failed_status", rename_all = "snake_case")]
pub enum PathfindingFailure {
    PathfindingInputError(PathfindingInputError),
    #[educe(Default)]
    PathfindingNotFound(PathfindingNotFound),
    InternalError {
        core_error: InternalError,
    },
}

/// Compute a pathfinding
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "pathfinding",
    params(
        ("infra_id" = i64, Path, description = "The infra id"),
    ),
    request_body = PathfindingInput,
    responses(
        (status = 200, description = "Pathfinding Result", body = PathfindingResult),
    ),
)]
pub(in crate::views) async fn post(
    State(AppState {
        db_pool,
        valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(infra_id): Path<i64>,
    Json(path_input): Json<PathfindingInput>,
) -> Result<Json<PathfindingResult>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let mut conn = db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || {
        PathfindingError::InfraNotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    use core_task::Task as _;
    let valkey_conn = valkey_client.get_connection().await?;
    let path_items = path_input.path_items.iter().collect::<Vec<_>>();
    let path_item_cache = PathItemCache::load(&mut conn, infra.id, &path_items).await?;
    let request = match build_pathfinding_request(&path_input, &infra, &path_item_cache) {
        Ok(request) => request,
        Err(result) => return Ok(Json(result)),
    };
    Ok(Json(match request.run(valkey_conn, core_client).await {
        Ok(path) => path.into(),
        Err(core_error) => PathfindingResult::Failure(PathfindingFailure::InternalError {
            core_error: core_error.into(),
        }),
    }))
}

/// Pathfinding batch computation given a list of path inputs
async fn pathfinding_blocks_batch(
    mut conn: DbConnection,
    valkey_conn: &mut cache::Connection,
    core: Arc<CoreClient>,
    infra: &Infra,
    pathfinding_inputs: &[PathfindingInput],
    app_version: Option<&str>,
) -> Result<Vec<Arc<PathfindingResult>>> {
    let mut hash_to_path_indexes: HashMap<String, Vec<usize>> = HashMap::default();
    let mut path_request_map: HashMap<String, PathfindingInput> = HashMap::default();
    let initial_value = Arc::new(PathfindingResult::Failure(PathfindingFailure::default()));
    let mut pathfinding_results = vec![initial_value; pathfinding_inputs.len()];
    for (index, path_input) in pathfinding_inputs.iter().enumerate() {
        let pathfinding_hash =
            path_input.compute_path_hash_with_versioning(infra.id, infra.version, app_version);
        hash_to_path_indexes
            .entry(pathfinding_hash.clone())
            .or_default()
            .push(index);
        path_request_map
            .entry(pathfinding_hash.clone())
            .or_insert(path_input.clone());
    }

    info!(
        nb_pathfindings = pathfinding_inputs.len(),
        nb_unique_pathfindings = hash_to_path_indexes.len()
    );

    // Compute hashes of all path_inputs
    let hashes = hash_to_path_indexes.keys().collect::<Vec<_>>();

    // Try to retrieve the result from Valkey
    let pathfinding_cached_results: Vec<Option<Arc<PathfindingResult>>> = valkey_conn
        .compressed_get_bulk(&hashes)
        .await?
        .map(|result| result.map(Arc::new))
        .collect();
    let pathfinding_cached_results: HashMap<_, _> =
        hashes.into_iter().zip(pathfinding_cached_results).collect();

    // Report number of hit cache
    let nb_hit = pathfinding_cached_results.values().flatten().count();
    let nb_miss = pathfinding_cached_results.len() - nb_hit;
    info!(nb_hit, nb_miss, "Hit cache");

    // Handle miss cache:
    debug!("Extracting locations from path items");
    let path_items: Vec<_> = pathfinding_cached_results
        .iter()
        .filter(|(_, res)| res.is_none())
        .flat_map(|(hash, _)| &path_request_map[*hash].path_items)
        .collect();
    let path_item_cache = PathItemCache::load(&mut conn, infra.id, &path_items).await?;

    debug!(
        nb_path_items = path_items.len(),
        "Preparing pathfinding requests"
    );
    let mut to_cache = vec![];
    let mut pathfinding_requests = vec![];
    let mut to_compute_hashes = vec![];
    for (hash, pathfinding_result) in pathfinding_cached_results.into_iter() {
        if let Some(result) = pathfinding_result {
            hash_to_path_indexes[hash]
                .iter()
                .for_each(|index| pathfinding_results[*index] = result.clone());
            continue;
        }
        let pathfinding_input = &path_request_map[hash];
        match build_pathfinding_request(pathfinding_input, infra, &path_item_cache) {
            Ok(pathfinding_request) => {
                pathfinding_requests.push(pathfinding_request);
                to_compute_hashes.push(hash);
            }
            Err(result) => {
                let arc_result = Arc::new(result.clone());
                hash_to_path_indexes[hash]
                    .iter()
                    .for_each(|index| pathfinding_results[*index] = arc_result.clone());
                to_cache.push((hash, result));
            }
        }
    }

    debug!(
        nb_requests = pathfinding_requests.len(),
        "Sending pathfinding requests to core"
    );
    let mut futures = vec![];
    for request in &pathfinding_requests {
        futures.push(Box::pin(request.fetch(core.as_ref())));
    }
    let computed_paths: Vec<_> = futures::future::join_all(futures)
        .await
        .into_iter()
        .collect();

    for (path_result, hash) in computed_paths.into_iter().zip(to_compute_hashes) {
        let result = match path_result {
            Ok(path) => {
                to_cache.push((hash, path.clone().into()));
                Arc::new(path.into())
            }
            // TODO: only make HTTP status code errors non-fatal
            Err(core_error) => Arc::new(PathfindingResult::Failure(
                PathfindingFailure::InternalError {
                    core_error: core_error.into(),
                },
            )),
        };
        hash_to_path_indexes[hash]
            .iter()
            .for_each(|index| pathfinding_results[*index] = result.clone());
    }

    debug!(nb_cached = to_cache.len(), "Caching pathfinding response");
    valkey_conn.compressed_set_bulk(&to_cache).await?;

    Ok(pathfinding_results)
}

fn build_pathfinding_request(
    pathfinding_input: &PathfindingInput,
    infra: &Infra,
    path_item_cache: &PathItemCache,
) -> std::result::Result<PathfindingRequest, PathfindingResult> {
    let path_items: Vec<_> = pathfinding_input.path_items.iter().collect();
    if path_items.len() <= 1 {
        return Err(PathfindingResult::Failure(
            PathfindingFailure::PathfindingInputError(PathfindingInputError::NotEnoughPathItems),
        ));
    }
    let track_offsets = path_item_cache.extract_location_from_path_items(&path_items)?;

    // Create the pathfinding request
    Ok(PathfindingRequest {
        infra: infra.id,
        expected_version: infra.version,
        path_items: track_offsets,
        rolling_stock_loading_gauge: pathfinding_input.rolling_stock_loading_gauge,
        rolling_stock_is_thermal: pathfinding_input.rolling_stock_is_thermal,
        rolling_stock_supported_electrifications: pathfinding_input
            .rolling_stock_supported_electrifications
            .clone(),
        rolling_stock_supported_signaling_systems: pathfinding_input
            .rolling_stock_supported_signaling_systems
            .clone(),
        rolling_stock_maximum_speed: pathfinding_input.rolling_stock_maximum_speed,
        rolling_stock_length: pathfinding_input.rolling_stock_length,
        speed_limit_tag: pathfinding_input.speed_limit_tag.clone(),
    })
}

/// Compute a path given a train schedule and an infrastructure.
pub async fn pathfinding_from_train<T: TrainScheduleLike>(
    conn: DbConnection,
    valkey: &mut cache::Connection,
    core: Arc<CoreClient>,
    infra: &Infra,
    train_schedule: T,
    app_version: Option<&str>,
) -> Result<PathfindingResult> {
    let rolling_stock: Vec<_> =
        RollingStock::retrieve(conn.clone(), train_schedule.rolling_stock_name().to_owned())
            .await?
            .into_iter()
            .map_into()
            .collect();

    Ok(Arc::unwrap_or_clone(
        pathfinding_from_train_batch(
            conn,
            valkey,
            core,
            infra,
            &[train_schedule],
            &rolling_stock,
            app_version,
        )
        .await?
        .pop()
        .unwrap(),
    ))
}

/// Compute a path given a batch of trainschedule and an infrastructure.
pub async fn pathfinding_from_train_batch<T: TrainScheduleLike>(
    conn: DbConnection,
    valkey: &mut cache::Connection,
    core: Arc<CoreClient>,
    infra: &Infra,
    train_schedules: &[T],
    rolling_stocks: &[schemas::RollingStock],
    app_version: Option<&str>,
) -> Result<Vec<Arc<PathfindingResult>>> {
    let initial_value = Arc::new(PathfindingResult::Failure(
        PathfindingFailure::PathfindingInputError(PathfindingInputError::NotEnoughPathItems),
    ));
    let mut results = vec![initial_value; train_schedules.len()];

    let rolling_stocks: HashMap<_, _> = rolling_stocks
        .iter()
        .map(|rs| (rs.name.as_str(), rs))
        .collect();

    let mut to_compute = vec![];
    let mut to_compute_index = vec![];
    for (index, train_schedule) in train_schedules.iter().enumerate() {
        // Retrieve rolling stock
        let rolling_stock_name = train_schedule.rolling_stock_name();
        let Some(rolling_stock) = rolling_stocks.get(rolling_stock_name) else {
            let rolling_stock_name = rolling_stock_name.into();
            results[index] = Arc::new(PathfindingResult::Failure(
                PathfindingFailure::PathfindingInputError(
                    PathfindingInputError::RollingStockNotFound { rolling_stock_name },
                ),
            ));
            continue;
        };

        // Create the path input
        let path_input = PathfindingInput {
            rolling_stock_loading_gauge: rolling_stock.loading_gauge,
            rolling_stock_is_thermal: rolling_stock.effort_curves.has_thermal_curves(),
            rolling_stock_supported_electrifications: rolling_stock
                .effort_curves
                .supported_electrification(),
            rolling_stock_supported_signaling_systems: rolling_stock
                .supported_signaling_systems
                .0
                .clone(),
            rolling_stock_maximum_speed: OrderedFloat(units::meter_per_second::from(
                rolling_stock.max_speed,
            )),
            rolling_stock_length: OrderedFloat(units::meter::from(rolling_stock.length)),
            path_items: train_schedule
                .path()
                .iter()
                .map(|item| item.location.clone())
                .collect(),
            speed_limit_tag: train_schedule.speed_limit_tag().cloned(),
        };
        to_compute.push(path_input);
        to_compute_index.push(index);
    }

    for (index, res) in
        pathfinding_blocks_batch(conn, valkey, core, infra, &to_compute, app_version)
            .await?
            .into_iter()
            .enumerate()
    {
        results[to_compute_index[index]] = res;
    }
    Ok(results)
}

#[cfg(test)]
pub mod tests {
    use axum::http::StatusCode;
    use core_client::mocking::MockingClient;
    use core_client::pathfinding::InvalidPathItem;
    use core_client::pathfinding::PathfindingInputError;
    use core_client::pathfinding::PathfindingResultSuccess;
    use core_client::pathfinding::TrainPath;
    use pretty_assertions::assert_eq;

    use schemas::train_schedule::OperationalPointIdentifier;
    use schemas::train_schedule::OperationalPointReference;
    use schemas::train_schedule::PathItemLocation;
    use schemas::train_schedule::TrackReference;
    use serde_json::json;

    use crate::models::fixtures::create_small_infra;
    use crate::views::path::pathfinding::PathfindingFailure;
    use crate::views::path::pathfinding::PathfindingResult;
    use crate::views::test_app::TestAppBuilder;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn pathfinding_fails_when_core_responds_with_zero_length_path() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(json!({
                "path": {
                    "blocks":[],
                    "routes": [],
                    "track_section_ranges": [],
                },
                "path_item_positions": [],
                "length": 0,
                "status": "success"
            }))
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/pathfinding/blocks", small_infra.id).as_str())
            .json(&json!({
                "path_items":[
                {"trigram":"WS","secondary_code":"BV"},
                {"trigram":"WS","secondary_code":"BV"}
            ],
                "rolling_stock_is_thermal":true,
                "rolling_stock_loading_gauge":"G1",
                "rolling_stock_supported_electrifications":[],
                "rolling_stock_supported_signaling_systems":["BAL","BAPR"],
                "rolling_stock_maximum_speed":22.00,
                "rolling_stock_length":26.00
            }));

        let pathfinding_result: PathfindingResult = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(
            pathfinding_result,
            PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::ZeroLengthPath,
            ))
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn pathfinding_with_invalid_path_items_returns_invalid_path_items() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/pathfinding/blocks", small_infra.id).as_str())
            .json(&json!({
                "path_items":[
                    {"trigram":"WS","secondary_code":"BV"},
                    {"trigram":"NO_TRIGRAM","secondary_code":null},
                    {"trigram":"SWS","secondary_code":"BV"}
                ],
                "rolling_stock_is_thermal":true,
                "rolling_stock_loading_gauge":"G1",
                "rolling_stock_supported_electrifications":[],
                "rolling_stock_supported_signaling_systems":["BAL","BAPR"],
                "rolling_stock_maximum_speed":22.00,
                "rolling_stock_length":26.00
            }));

        let pathfinding_result: PathfindingResult = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(
            pathfinding_result,
            PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::InvalidPathItems {
                    items: vec![InvalidPathItem {
                        index: 1,
                        path_item: PathItemLocation::OperationalPointReference(
                            OperationalPointReference {
                                reference:
                                    OperationalPointIdentifier::OperationalPointDescription {
                                        trigram: "NO_TRIGRAM".into(),
                                        secondary_code: None
                                    },
                                track_reference: None,
                            }
                        )
                    }]
                }
            ))
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn pathfinding_with_invalid_path_items_due_to_track_reference() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/pathfinding/blocks", small_infra.id).as_str())
            .json(&json!({
                "path_items":[
                    {"uic":8733,"secondary_code":"BV", "track_reference": {"track_name": "V2"}},
                    {"uic":8788 ,"secondary_code":"BV", "track_reference": {"track_name": "V_INVALID"}},
                ],
                "rolling_stock_is_thermal":true,
                "rolling_stock_loading_gauge":"G1",
                "rolling_stock_supported_electrifications":[],
                "rolling_stock_supported_signaling_systems":["BAL","BAPR"],
                "rolling_stock_maximum_speed":22.00,
                "rolling_stock_length":26.00
            }));

        let pathfinding_result: PathfindingResult = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(
            pathfinding_result,
            PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::InvalidPathItems {
                    items: vec![InvalidPathItem {
                        index: 1,
                        path_item: PathItemLocation::OperationalPointReference(
                            OperationalPointReference {
                                reference: OperationalPointIdentifier::OperationalPointUic {
                                    uic: 8788,
                                    secondary_code: Some("BV".into())
                                },
                                track_reference: Some(TrackReference::Name {
                                    track_name: "V_INVALID".into()
                                }),
                            }
                        )
                    }]
                }
            ))
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn pathfinding_with_valid_path_items_returns_successful_result() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(json!({
                "path": {
                    "blocks":[],
                    "routes": [],
                    "track_section_ranges": [],
                },
                "path_item_positions": [],
                "length": 1,
                "status": "success"
            }))
            .finish();
        let app = TestAppBuilder::new().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/pathfinding/blocks", small_infra.id).as_str())
            .json(&json!({
                "path_items":[
                    {"trigram":"WS","secondary_code":"BV"},
                    {"trigram":"SWS","secondary_code":"BV"}
                ],
                "rolling_stock_is_thermal":true,
                "rolling_stock_loading_gauge":"G1",
                "rolling_stock_supported_electrifications":[],
                "rolling_stock_supported_signaling_systems":["BAL","BAPR"],
                "rolling_stock_maximum_speed":22.00,
                "rolling_stock_length":26.00
            }));

        let pathfinding_result: PathfindingResult = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(
            pathfinding_result,
            PathfindingResult::Success(PathfindingResultSuccess {
                path: TrainPath {
                    blocks: vec![],
                    routes: vec![],
                    track_section_ranges: vec![],
                },
                length: 1,
                path_item_positions: vec![]
            })
        );
    }
}
