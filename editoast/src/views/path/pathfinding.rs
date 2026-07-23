use std::collections::BTreeSet;
use std::hash::Hash;
use std::sync::Arc;

use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use common::units;
use core_client::CoreClient;
use core_client::pathfinding::PathfindingCoreResult;
use core_client::pathfinding::PathfindingInputError;
use core_client::pathfinding::PathfindingNotFound;
use core_client::pathfinding::PathfindingResultSuccess;
use database::DbConnection;
use educe::Educe;
use futures::StreamExt;
use ordered_float::OrderedFloat;
use schemas::rolling_stock::LoadingGaugeType;
use schemas::train_schedule::PathItemLocation;
use schemas::train_schedule::TrainScheduleLike;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::path::PathfindingError;
use crate::views::path::operational_point_cache::OperationalPointCache;
use crate::views::timetable::PhysicsConsistParameters;
use editoast_models::Infra;
use editoast_models::prelude::*;

/// Path input is described by some rolling stock information
/// and a list of path waypoints
#[derive(Deserialize, Clone, Debug, Hash, ToSchema)]
#[cfg_attr(test, derive(Serialize))]
pub(in crate::views) struct PathfindingInput {
    /// The loading gauge of the rolling stock
    rolling_stock_loading_gauge: LoadingGaugeType,
    /// Can the rolling stock run on non-electrified tracks
    rolling_stock_is_thermal: bool,
    /// List of supported electrification modes.
    /// Empty if does not support any electrification
    rolling_stock_supported_electrifications: BTreeSet<String>,
    /// List of supported signaling systems
    rolling_stock_supported_signaling_systems: BTreeSet<String>,
    /// List of waypoints given to the pathfinding
    path_items: Vec<PathItemLocation>,
    /// Rolling stock maximum speed
    #[schema(value_type = f64)]
    rolling_stock_maximum_speed: OrderedFloat<f64>,
    /// Rolling stock length in millimeters
    rolling_stock_length: u64,
    /// Speed limit tag, used to estimate the travel time
    speed_limit_tag: Option<String>,
    /// Stop the train at the next block-delimiting signal,
    /// staying in the same block and keeping the tail on the initial position
    stops_at_end_of_block: Option<bool>,
    /// Set of authorized track section ids, empty means no restriction
    #[serde(default)]
    allowed_track_sections: BTreeSet<String>,
}

impl PathfindingInput {
    pub fn from(
        consist: &PhysicsConsistParameters,
        train_schedule: &impl TrainScheduleLike,
    ) -> Self {
        Self {
            rolling_stock_loading_gauge: consist.compute_loading_gauge(),
            rolling_stock_is_thermal: consist.traction_engine.effort_curves.has_thermal_curves(),
            rolling_stock_supported_electrifications: consist
                .traction_engine
                .effort_curves
                .supported_electrification(),
            rolling_stock_supported_signaling_systems: consist
                .traction_engine
                .supported_signaling_systems(),
            rolling_stock_maximum_speed: OrderedFloat(units::meter_per_second::from(
                consist.compute_max_speed(),
            )),
            rolling_stock_length: units::millimeter::from(consist.compute_length()).round() as u64,
            path_items: train_schedule.locations(),
            speed_limit_tag: train_schedule.speed_limit_tag().cloned(),
            stops_at_end_of_block: Some(train_schedule.options().stops_at_end_of_block()),
            allowed_track_sections: BTreeSet::new(),
        }
    }
}

impl From<&PathfindingInput> for core_task::PathfindingConsist {
    fn from(val: &PathfindingInput) -> Self {
        core_task::PathfindingConsist {
            loading_gauge: val.rolling_stock_loading_gauge,
            thermal: val.rolling_stock_is_thermal,
            supported_electrifications: val.rolling_stock_supported_electrifications.clone(),
            supported_signaling_systems: val.rolling_stock_supported_signaling_systems.clone(),
            maximum_speed: val.rolling_stock_maximum_speed,
            length: val.rolling_stock_length,
            speed_limit_tag: val.speed_limit_tag.clone(),
        }
    }
}

impl From<PathfindingInput> for core_task::PathfindingConsist {
    fn from(val: PathfindingInput) -> Self {
        (&val).into()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
#[schema(title_variants)]
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
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema, Educe)]
#[educe(Default)]
#[serde(tag = "failed_status", rename_all = "snake_case")]
#[schema(title_variants)]
pub enum PathfindingFailure {
    PathfindingInputError(PathfindingInputError),
    #[educe(Default)]
    PathfindingNotFound(PathfindingNotFound),
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
    let conn = db_pool.get().await?;
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

    let op_cache =
        OperationalPointCache::load_path_items(conn, infra.id, &path_input.path_items).await?;
    let pathfinding_train = match build_pathfinding_train(&path_input, &op_cache) {
        Ok(pathfinding_train) => pathfinding_train,
        Err(result) => return Ok(Json(*result)),
    };
    let result =
        single_pathfinding_request(pathfinding_train, &infra, valkey_client, core_client).await?;
    Ok(Json(result))
}

fn build_pathfinding_train(
    pathfinding_input: &PathfindingInput,
    op_cache: &OperationalPointCache,
) -> std::result::Result<core_task::PathfindingTrain, Box<PathfindingResult>> {
    if pathfinding_input.path_items.len() <= 1 {
        return Err(Box::from(PathfindingResult::Failure(
            PathfindingFailure::PathfindingInputError(PathfindingInputError::NotEnoughPathItems),
        )));
    }
    let track_offsets: Vec<Vec<schemas::infra::TrackOffset>> = op_cache
        .extract_location_from_path_items(&pathfinding_input.path_items)
        .map_err(PathfindingResult::Failure)?;

    let constraints = core_task::PathfindingConstraints {
        path_items: track_offsets
            .into_iter()
            .map(core_task::PathItemAlternatives::from_iter)
            .collect(),
        allowed_track_sections: pathfinding_input.allowed_track_sections.clone(),
    };

    Ok(core_task::PathfindingTrain {
        consist: pathfinding_input.into(),
        constraints,
    })
}

pub(in crate::views) async fn single_pathfinding_request(
    pathfinding_train: core_task::PathfindingTrain,
    infra: &Infra,
    valkey_client: Arc<cache::Client>,
    core_client: Arc<CoreClient>,
) -> Result<PathfindingResult> {
    let mut pathfinding_env = core_task::PathfindingEnv::new(core_task::CoreEnv {
        infra_id: infra.id as u64,
        infra_version: infra.version,
        client: core_client,
    });
    pathfinding_env.extend([((), pathfinding_train)]);

    let result = match pathfinding_env.into_stream(valkey_client).next().await {
        Some(path) => path.data,
        None => Err(core_client::Error::BrokenPipe),
    };
    Ok(result?.into())
}

#[derive(Debug, Clone)]
pub struct TrainScheduleWithConsist<T: TrainScheduleLike> {
    pub train_schedule: T,
    pub consist: PhysicsConsistParameters,
}

/// Compute a path given a batch of trainschedule and an infrastructure.
pub async fn pathfinding_from_train_batch<T: TrainScheduleLike>(
    conn: DbConnection,
    valkey_client: Arc<cache::Client>,
    core: Arc<CoreClient>,
    infra: &Infra,
    train_schedules_with_consists: &[TrainScheduleWithConsist<T>],
    _app_version: Option<&str>, // question: this was used before for the cache, we are changing the invalidation
) -> Result<Vec<Arc<PathfindingResult>>> {
    let mut pathfinding_env = core_task::PathfindingEnv::new(core_task::CoreEnv {
        infra_id: infra.id as u64,
        infra_version: infra.version,
        client: core,
    });

    // Question: before we computed the op_cache only for requests that were cache miss
    // Could this have a performance impact?
    let path_items: Vec<_> = train_schedules_with_consists
        .iter()
        .flat_map(|pf_input| pf_input.train_schedule.locations())
        .collect();
    let op_cache = OperationalPointCache::load_path_items(conn, infra.id, &path_items).await?;

    let mut results = Vec::new();
    let valid_pathfinding_trains = train_schedules_with_consists
        .iter()
        .map(|ts| PathfindingInput::from(&ts.consist, &ts.train_schedule))
        .map(|path_input| build_pathfinding_train(&path_input, &op_cache))
        .enumerate()
        .filter_map(|(index, pathfinding_train)| match pathfinding_train {
            Ok(pathfinding_train) => Some((index, pathfinding_train)),
            Err(err) => {
                results.push((index, err.into()));
                None
            }
        });
    pathfinding_env.extend(valid_pathfinding_trains);

    let mut stream = pathfinding_env.into_stream(valkey_client);
    while let Some(correlated) = stream.next().await {
        // An error in the pathfinding (bad input, no route found...) is a valid PathfindingResult
        // So `?` corresponds to a technical error
        // QUESTION: should we drop everything in such a situation?
        let pf_result: Arc<PathfindingResult> = Arc::new(correlated.data?.into());
        for index in correlated.correlation_key {
            // Only the Arc is cloned: the actualy path data isn’t
            results.push((index, pf_result.clone()));
        }
    }

    // Question: the previous implementation had a lot of tracing informations, mostly to watch over the cache
    // Is is ok if we don’t have them?

    // We re-order all the results in the same order as in the input
    results.sort_by_key(|(index, _result)| *index);
    Ok(results.into_iter().map(|(_index, result)| result).collect())
}

#[cfg(test)]
pub mod tests {
    use std::collections::BTreeSet;

    use axum::http::StatusCode;
    use core_client::mocking::MockingClient;
    use core_client::pathfinding::InvalidPathItem;
    use core_client::pathfinding::PathfindingInputError;
    use core_client::pathfinding::PathfindingResultSuccess;
    use core_client::pathfinding::TrainPath;
    use pretty_assertions::assert_eq;
    use schemas::rolling_stock::LoadingGaugeType;
    use schemas::train_schedule::OperationalPointPartReference;
    use schemas::train_schedule::OperationalPointReference;
    use schemas::train_schedule::PathItemLocation;

    use crate::fixtures::create_small_infra;
    use crate::views::path::pathfinding::PathfindingFailure;
    use crate::views::path::pathfinding::PathfindingInput;
    use crate::views::path::pathfinding::PathfindingResult;
    use crate::views::test_app;

    fn pathfinding_input(path_items: Vec<PathItemLocation>) -> PathfindingInput {
        PathfindingInput {
            rolling_stock_loading_gauge: LoadingGaugeType::G1,
            rolling_stock_is_thermal: true,
            rolling_stock_supported_electrifications: BTreeSet::new(),
            rolling_stock_supported_signaling_systems: BTreeSet::from([
                "BAL".into(),
                "BAPR".into(),
            ]),
            rolling_stock_maximum_speed: 22.0.into(),
            rolling_stock_length: 26_000,
            speed_limit_tag: None,
            stops_at_end_of_block: None,
            allowed_track_sections: BTreeSet::new(),
            path_items,
        }
    }

    fn pathfinding_result(length: u64) -> PathfindingResult {
        PathfindingResult::Success(PathfindingResultSuccess {
            path: TrainPath {
                blocks: vec![],
                routes: vec![],
                track_section_ranges: vec![],
            },
            length,
            path_item_positions: vec![],
            backtrack_path_items: Some(vec![]),
        })
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn pathfinding_fails_when_core_responds_with_zero_length_path() {
        let mut core = MockingClient::new();
        core.stub("/pathfinding/blocks")
            .response(StatusCode::OK)
            .json(pathfinding_result(0))
            .finish();
        let app = test_app!().skip_authz().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let path_items = vec![
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Trigram {
                    trigram: "WS".into(),
                    secondary_code: Some("BV".into()),
                },
                local_track_name: None,
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Trigram {
                    trigram: "WS".into(),
                    secondary_code: Some("BV".into()),
                },
                local_track_name: None,
            }),
        ];

        let pathfinding_result: PathfindingResult = app
            .post(format!("/infra/{}/pathfinding/blocks", small_infra.id).as_str())
            .json(&pathfinding_input(path_items))
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            pathfinding_result,
            PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::ZeroLengthPath,
            ))
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn pathfinding_with_invalid_path_items_returns_invalid_path_items() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let path_items = vec![
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Trigram {
                    trigram: "WS".into(),
                    secondary_code: Some("BV".into()),
                },
                local_track_name: None,
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Trigram {
                    trigram: "NO_TRIGRAM".into(),
                    secondary_code: None,
                },
                local_track_name: None,
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Trigram {
                    trigram: "SWS".into(),
                    secondary_code: Some("BV".into()),
                },
                local_track_name: None,
            }),
        ];

        let pathfinding_result: PathfindingResult = app
            .post(format!("/infra/{}/pathfinding/blocks", small_infra.id).as_str())
            .json(&pathfinding_input(path_items))
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            pathfinding_result,
            PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::InvalidPathItems {
                    items: vec![InvalidPathItem {
                        index: 1,
                        path_item: PathItemLocation::OperationalPointPartReference(
                            OperationalPointPartReference {
                                operational_point: OperationalPointReference::Trigram {
                                    trigram: "NO_TRIGRAM".into(),
                                    secondary_code: None
                                },
                                local_track_name: None,
                            }
                        )
                    }]
                }
            ))
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn pathfinding_with_invalid_path_items_due_to_local_track_name() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let path_items = vec![
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Uic {
                    uic: 8733,
                    secondary_code: Some("BV".into()),
                },
                local_track_name: Some("V2".into()),
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Uic {
                    uic: 8788,
                    secondary_code: Some("BV".into()),
                },
                local_track_name: Some("V_INVALID".into()),
            }),
        ];

        let pathfinding_result: PathfindingResult = app
            .post(format!("/infra/{}/pathfinding/blocks", small_infra.id).as_str())
            .json(&pathfinding_input(path_items))
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            pathfinding_result,
            PathfindingResult::Failure(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::InvalidPathItems {
                    items: vec![InvalidPathItem {
                        index: 1,
                        path_item: PathItemLocation::OperationalPointPartReference(
                            OperationalPointPartReference {
                                operational_point: OperationalPointReference::Uic {
                                    uic: 8788,
                                    secondary_code: Some("BV".into())
                                },
                                local_track_name: Some("V_INVALID".into()),
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
            .json(pathfinding_result(1))
            .finish();
        let app = test_app!().skip_authz().core_client(core.into()).build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let path_items = vec![
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Trigram {
                    trigram: "WS".into(),
                    secondary_code: Some("BV".into()),
                },
                local_track_name: None,
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Trigram {
                    trigram: "SWS".into(),
                    secondary_code: Some("BV".into()),
                },
                local_track_name: None,
            }),
        ];

        let pathfinding_res: PathfindingResult = app
            .post(format!("/infra/{}/pathfinding/blocks", small_infra.id).as_str())
            .json(&pathfinding_input(path_items))
            .await
            .assert_status_ok()
            .json();
        assert_eq!(pathfinding_res, pathfinding_result(1));
    }
}
