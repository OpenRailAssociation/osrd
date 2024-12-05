use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::Hash;
use std::hash::Hasher;
use std::sync::Arc;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::Extension;
use editoast_authz::BuiltinRole;
use editoast_common::units;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::train_schedule::PathItemLocation;
use itertools::Itertools;
use ordered_float::OrderedFloat;
use serde::Deserialize;
use serde::Serialize;
use tracing::debug;
use tracing::info;
use utoipa::ToSchema;

use crate::core::pathfinding::PathfindingCoreResult;
use crate::core::pathfinding::PathfindingInputError;
use crate::core::pathfinding::PathfindingNotFound;
use crate::core::pathfinding::PathfindingRequest;
use crate::core::pathfinding::PathfindingResultSuccess;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::train_schedule::TrainSchedule;
use crate::models::Infra;
use crate::models::Retrieve;
use crate::models::RollingStockModel;
use crate::valkey_utils::ValkeyConnection;
use crate::views::get_app_version;
use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::PathfindingError;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::AppState;
use editoast_models::DbConnection;

crate::routes! {
    "/infra/{infra_id}/pathfinding/blocks" => post,
}

editoast_common::schemas! {
    PathfindingInput,
    PathfindingFailure,
    PathfindingResult,
}

/// Path input is described by some rolling stock information
/// and a list of path waypoints
#[derive(Deserialize, Clone, Debug, Hash, ToSchema)]
struct PathfindingInput {
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
                PathfindingResult::Failure(PathfindingFailure::InternalError { core_error })
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
#[serde(tag = "failed_status", rename_all = "snake_case")]
pub enum PathfindingFailure {
    PathfindingInputError(PathfindingInputError),
    PathfindingNotFound(PathfindingNotFound),
    InternalError { core_error: InternalError },
}

/// Compute a pathfinding
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
async fn post(
    State(AppState {
        db_pool,
        valkey,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(infra_id): Path<i64>,
    Json(path_input): Json<PathfindingInput>,
) -> Result<Json<PathfindingResult>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let mut valkey_conn = valkey.get_connection().await?;
    let infra = Infra::retrieve_or_fail(conn, infra_id, || PathfindingError::InfraNotFound {
        infra_id,
    })
    .await?;

    Ok(Json(
        pathfinding_blocks(conn, &mut valkey_conn, core_client, &infra, path_input).await?,
    ))
}

/// Pathfinding computation given a path input
async fn pathfinding_blocks(
    conn: &mut DbConnection,
    valkey_conn: &mut ValkeyConnection,
    core: Arc<CoreClient>,
    infra: &Infra,
    path_input: PathfindingInput,
) -> Result<PathfindingResult> {
    let mut path = pathfinding_blocks_batch(conn, valkey_conn, core, infra, &[path_input]).await?;
    Ok(path.pop().unwrap())
}

/// Pathfinding batch computation given a list of path inputs
async fn pathfinding_blocks_batch(
    conn: &mut DbConnection,
    valkey_conn: &mut ValkeyConnection,
    core: Arc<CoreClient>,
    infra: &Infra,
    pathfinding_inputs: &[PathfindingInput],
) -> Result<Vec<PathfindingResult>> {
    // Compute hashes of all path_inputs
    let hashes: Vec<_> = pathfinding_inputs
        .iter()
        .map(|input| path_input_hash(infra.id, &infra.version, input))
        .collect();

    // Try to retrieve the result from Valkey
    let mut pathfinding_results: Vec<Option<PathfindingResult>> =
        valkey_conn.json_get_bulk(&hashes).await?;

    // Report number of hit cache
    let nb_hit = pathfinding_results.iter().flatten().count();
    info!(
        nb_hit,
        nb_miss = pathfinding_inputs.len() - nb_hit,
        "Hit cache"
    );

    // Handle miss cache:
    debug!("Extracting locations from path items");
    let path_items: Vec<_> = pathfinding_results
        .iter()
        .zip(pathfinding_inputs)
        .filter(|(res, _)| res.is_none())
        .flat_map(|(_, input)| &input.path_items)
        .collect();
    let path_item_cache = PathItemCache::load(conn, infra.id, &path_items).await?;

    debug!(
        nb_path_items = path_items.len(),
        "Preparing pathfinding requests"
    );
    let mut to_cache = vec![];
    let mut pathfinding_requests = vec![];
    let mut pathfinding_requests_index = vec![];
    for (index, (pathfinding_result, pathfinding_input)) in pathfinding_results
        .iter_mut()
        .zip(pathfinding_inputs)
        .enumerate()
    {
        if pathfinding_result.is_some() {
            continue;
        }

        match build_pathfinding_request(pathfinding_input, infra, &path_item_cache) {
            Ok(pathfinding_request) => {
                pathfinding_requests.push(pathfinding_request);
                pathfinding_requests_index.push(index);
            }
            Err(result) => {
                *pathfinding_result = Some(result.clone());
                to_cache.push((&hashes[index], result));
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

    for (index, path_result) in computed_paths.into_iter().enumerate() {
        let path_index = pathfinding_requests_index[index];
        let path = match path_result {
            Ok(path) => {
                to_cache.push((&hashes[path_index], path.clone().into()));
                path.into()
            }
            // TODO: only make HTTP status code errors non-fatal
            Err(core_error) => {
                PathfindingResult::Failure(PathfindingFailure::InternalError { core_error })
            }
        };
        pathfinding_results[path_index] = Some(path);
    }

    debug!(nb_results = to_cache.len(), "Caching pathfinding response");
    valkey_conn.json_set_bulk(&to_cache).await?;

    Ok(pathfinding_results.into_iter().flatten().collect())
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
        expected_version: infra.version.clone(),
        path_items: track_offsets,
        rolling_stock_loading_gauge: pathfinding_input.rolling_stock_loading_gauge,
        rolling_stock_is_thermal: pathfinding_input.rolling_stock_is_thermal,
        rolling_stock_supported_electrifications: pathfinding_input
            .rolling_stock_supported_electrifications
            .clone(),
        rolling_stock_supported_signaling_systems: pathfinding_input
            .rolling_stock_supported_signaling_systems
            .clone(),
        rolling_stock_maximum_speed: pathfinding_input.rolling_stock_maximum_speed.0,
        rolling_stock_length: pathfinding_input.rolling_stock_length.0,
    })
}

/// Compute a path given a train schedule and an infrastructure.
pub async fn pathfinding_from_train(
    conn: &mut DbConnection,
    valkey: &mut ValkeyConnection,
    core: Arc<CoreClient>,
    infra: &Infra,
    train_schedule: TrainSchedule,
) -> Result<PathfindingResult> {
    let rolling_stock: Vec<RollingStock> =
        RollingStockModel::retrieve(conn, train_schedule.rolling_stock_name.clone())
            .await?
            .into_iter()
            .map_into()
            .collect();

    Ok(
        pathfinding_from_train_batch(conn, valkey, core, infra, &[train_schedule], &rolling_stock)
            .await?
            .pop()
            .unwrap(),
    )
}

/// Compute a path given a batch of trainschedule and an infrastructure.
pub async fn pathfinding_from_train_batch(
    conn: &mut DbConnection,
    valkey: &mut ValkeyConnection,
    core: Arc<CoreClient>,
    infra: &Infra,
    train_schedules: &[TrainSchedule],
    rolling_stocks: &[RollingStock],
) -> Result<Vec<PathfindingResult>> {
    let mut results = vec![
        PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
            PathfindingInputError::NotEnoughPathItems
        ));
        train_schedules.len()
    ];

    let rolling_stocks: HashMap<_, _> = rolling_stocks.iter().map(|rs| (&rs.name, rs)).collect();

    let mut to_compute = vec![];
    let mut to_compute_index = vec![];
    for (index, train_schedule) in train_schedules.iter().enumerate() {
        // Retrieve rolling stock
        let rolling_stock_name = &train_schedule.rolling_stock_name;
        let Some(rolling_stock) = rolling_stocks.get(rolling_stock_name) else {
            let rolling_stock_name = rolling_stock_name.clone();
            results[index] = PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::RollingStockNotFound { rolling_stock_name },
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
                .path
                .clone()
                .into_iter()
                .map(|item| item.location)
                .collect(),
        };
        to_compute.push(path_input);
        to_compute_index.push(index);
    }

    for (index, res) in pathfinding_blocks_batch(conn, valkey, core, infra, &to_compute)
        .await?
        .into_iter()
        .enumerate()
    {
        results[to_compute_index[index]] = res;
    }
    Ok(results)
}

/// Generates a unique hash based on the pathfinding entries.
/// We need to recalculate the path if:
///   - The path entry is different
///   - The infrastructure has been modified
///   - The application has been updated (the algorithm or payloads may have changed)
fn path_input_hash(infra: i64, infra_version: &String, path_input: &PathfindingInput) -> String {
    // Retrieve OSRD Version
    let osrd_version = get_app_version().unwrap_or_default();
    let mut hasher = DefaultHasher::new();
    path_input.hash(&mut hasher);
    let hash_path_input = hasher.finish();
    format!("pathfinding_{osrd_version}.{infra}.{infra_version}.{hash_path_input}")
}

#[cfg(test)]
pub mod tests {
    use axum::http::StatusCode;
    use editoast_models::DbConnectionPoolV2;
    use editoast_schemas::train_schedule::OperationalPointIdentifier;
    use editoast_schemas::train_schedule::OperationalPointReference;
    use editoast_schemas::train_schedule::PathItemLocation;
    use editoast_schemas::train_schedule::TrackReference;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use crate::core::mocking::MockingClient;
    use crate::core::pathfinding::InvalidPathItem;
    use crate::core::pathfinding::PathfindingInputError;
    use crate::core::pathfinding::PathfindingResultSuccess;
    use crate::models::fixtures::create_small_infra;
    use crate::views::path::pathfinding::PathfindingFailure;
    use crate::views::path::pathfinding::PathfindingResult;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn pathfinding_fails_when_core_responds_with_zero_length_path() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = MockingClient::new();
        core.stub("/v2/pathfinding/blocks")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(json!({
                "blocks":[],
                "routes": [],
                "track_section_ranges": [],
                "path_item_positions": [],
                "length": 0,
                "status": "success"
            }))
            .finish();
        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
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

        let pathfinding_result: PathfindingResult =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(
            pathfinding_result,
            PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::ZeroLengthPath,
            ))
        );
    }

    #[rstest]
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

        let pathfinding_result: PathfindingResult =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
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

    #[rstest]
    async fn pathfinding_with_invalid_path_items_due_to_track_reference() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;

        let request = app
            .post(format!("/infra/{}/pathfinding/blocks", small_infra.id).as_str())
            .json(&json!({
                "path_items":[
                    {"uic":3,"secondary_code":"BV", "track_reference": {"track_name": "V2"}},
                    {"uic":8 ,"secondary_code":"BV", "track_reference": {"track_name": "V_INVALID"}},
                ],
                "rolling_stock_is_thermal":true,
                "rolling_stock_loading_gauge":"G1",
                "rolling_stock_supported_electrifications":[],
                "rolling_stock_supported_signaling_systems":["BAL","BAPR"],
                "rolling_stock_maximum_speed":22.00,
                "rolling_stock_length":26.00
            }));

        let pathfinding_result: PathfindingResult =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(
            pathfinding_result,
            PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::InvalidPathItems {
                    items: vec![InvalidPathItem {
                        index: 1,
                        path_item: PathItemLocation::OperationalPointReference(
                            OperationalPointReference {
                                reference: OperationalPointIdentifier::OperationalPointUic {
                                    uic: 8,
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

    #[rstest]
    async fn pathfinding_with_valid_path_items_returns_successful_result() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = MockingClient::new();
        core.stub("/v2/pathfinding/blocks")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(json!({
                "blocks":[],
                "routes": [],
                "track_section_ranges": [],
                "path_item_positions": [],
                "length": 1,
                "status": "success"
            }))
            .finish();
        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
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

        let pathfinding_result: PathfindingResult =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert_eq!(
            pathfinding_result,
            PathfindingResult::Success(PathfindingResultSuccess {
                blocks: vec![],
                routes: vec![],
                track_section_ranges: vec![],
                length: 1,
                path_item_positions: vec![]
            })
        );
    }
}
