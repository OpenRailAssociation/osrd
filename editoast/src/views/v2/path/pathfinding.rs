use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::Hash;
use std::hash::Hasher;
use std::sync::Arc;

use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use editoast_schemas::infra::TrackOffset;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use tracing::info;
use utoipa::ToSchema;

use crate::core::v2::pathfinding::PathfindingRequest;
use crate::core::v2::pathfinding::PathfindingResult;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::modelsv2::train_schedule::TrainSchedule;
use crate::modelsv2::Infra;
use crate::modelsv2::OperationalPointModel;
use crate::modelsv2::Retrieve;
use crate::modelsv2::RetrieveBatch;
use crate::modelsv2::RetrieveBatchUnchecked;
use crate::modelsv2::RollingStockModel;
use crate::modelsv2::TrackSectionModel;
use crate::redis_utils::RedisClient;
use crate::redis_utils::RedisConnection;
use crate::views::get_app_version;
use crate::views::v2::path::PathfindingError;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::OperationalPoint;

type TrackOffsetResult = std::result::Result<Vec<Vec<TrackOffset>>, TrackOffsetExtractionError>;

crate::routes! {
    "/v2/infra/{infra_id}/pathfinding/blocks" => {
       post,
    },
}

editoast_common::schemas! {
    PathfindingInput,
}

/// Path input is described by some rolling stock information
/// and a list of path waypoints
#[derive(Deserialize, Clone, Debug, Hash, ToSchema)]
#[schema(as = PathfindingInputV2)]
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
    #[schema(inline)]
    path_items: Vec<PathItemLocation>,
}

/// Compute a pathfinding
#[utoipa::path(
    tag = "pathfindingv2",
    params(
        ("infra_id" = i64, Path, description = "The infra id"),
    ),
    request_body = PathfindingInputV2,
    responses(
        (status = 200, description = "Pathfinding Result", body = PathfindingResult),
    ),
)]
#[post("")]
pub async fn post(
    db_pool: Data<DbConnectionPoolV2>,
    redis_client: Data<RedisClient>,
    core: Data<CoreClient>,
    infra_id: Path<i64>,
    data: Json<PathfindingInput>,
) -> Result<Json<PathfindingResult>> {
    let path_input = data.into_inner();
    let conn = &mut db_pool.get().await?;
    let mut redis_conn = redis_client.get_connection().await?;
    let core = core.into_inner();
    let infra = Infra::retrieve_or_fail(conn, *infra_id, || PathfindingError::InfraNotFound {
        infra_id: *infra_id,
    })
    .await?;

    Ok(Json(
        pathfinding_blocks(conn, &mut redis_conn, core, &infra, path_input).await?,
    ))
}

/// Pathfinding computation given a path input
async fn pathfinding_blocks(
    conn: &mut DbConnection,
    redis_conn: &mut RedisConnection,
    core: Arc<CoreClient>,
    infra: &Infra,
    path_input: PathfindingInput,
) -> Result<PathfindingResult> {
    let mut path = pathfinding_blocks_batch(conn, redis_conn, core, infra, &[path_input]).await?;
    Ok(path.pop().unwrap())
}

/// Pathfinding batch computation given a list of path inputs
async fn pathfinding_blocks_batch(
    conn: &mut DbConnection,
    redis_conn: &mut RedisConnection,
    core: Arc<CoreClient>,
    infra: &Infra,
    pathfinding_inputs: &[PathfindingInput],
) -> Result<Vec<PathfindingResult>> {
    // Compute hashes of all path_inputs
    let hashes: Vec<_> = pathfinding_inputs
        .iter()
        .map(|input| path_input_hash(infra.id, &infra.version, input))
        .collect();

    // Try to retrieve the result from Redis
    let mut pathfinding_results: Vec<Option<PathfindingResult>> =
        redis_conn.json_get_bulk(&hashes).await?;

    // Report number of hit cache
    let nb_hit = pathfinding_results.iter().flatten().count();
    info!(
        nb_hit,
        nb_miss = pathfinding_inputs.len() - nb_hit,
        "Hit cache"
    );

    // Handle miss cache:
    // 1) extract locations from path items
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

        match build_pathfinding_request(pathfinding_input, conn, infra).await? {
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

    // 2) Send pathfinding requests to core
    let mut futures = vec![];
    for request in &pathfinding_requests {
        futures.push(Box::pin(request.fetch(core.as_ref())));
    }
    let computed_paths: Vec<_> = futures::future::join_all(futures)
        .await
        .into_iter()
        .collect::<Result<_>>()?;

    for (index, computed_path) in computed_paths.into_iter().enumerate() {
        let path_index = pathfinding_requests_index[index];
        to_cache.push((&hashes[path_index], computed_path.clone()));
        pathfinding_results[path_index] = Some(computed_path);
    }

    // 3) Put in cache
    redis_conn.json_set_bulk(&to_cache).await?;

    Ok(pathfinding_results.into_iter().flatten().collect())
}

async fn build_pathfinding_request(
    pathfinding_input: &PathfindingInput,
    conn: &mut DbConnection,
    infra: &Infra,
) -> Result<std::result::Result<PathfindingRequest, PathfindingResult>> {
    let path_items = &pathfinding_input.path_items;
    if path_items.len() <= 1 {
        return Ok(Err(PathfindingResult::NotEnoughPathItems));
    }
    let track_offsets = match extract_location_from_path_items(conn, infra.id, path_items).await? {
        Ok(track_offsets) => track_offsets,
        Err(e) => return Ok(Err(e.into())),
    };

    // Check if tracks exist
    if let Err(err) = check_tracks_from_path_items(conn, infra.id, &track_offsets).await? {
        return Ok(Err(err));
    }

    // Create the pathfinding request
    Ok(Ok(PathfindingRequest {
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
    }))
}

/// Compute a path given a train schedule and an infrastructure.
pub async fn pathfinding_from_train(
    conn: &mut DbConnection,
    redis: &mut RedisConnection,
    core: Arc<CoreClient>,
    infra: &Infra,
    train_schedule: TrainSchedule,
) -> Result<PathfindingResult> {
    let rolling_stocks =
        RollingStockModel::retrieve(conn, train_schedule.rolling_stock_name.clone())
            .await?
            .into_iter()
            .map(|rs| (rs.name.clone(), rs))
            .collect();

    Ok(
        pathfinding_from_train_batch(conn, redis, core, infra, &[train_schedule], &rolling_stocks)
            .await?
            .pop()
            .unwrap(),
    )
}

/// Compute a path given a batch of trainschedule and an infrastructure.
pub async fn pathfinding_from_train_batch(
    conn: &mut DbConnection,
    redis: &mut RedisConnection,
    core: Arc<CoreClient>,
    infra: &Infra,
    train_schedules: &[TrainSchedule],
    rolling_stocks: &HashMap<String, RollingStockModel>,
) -> Result<Vec<PathfindingResult>> {
    let mut results = vec![PathfindingResult::NotEnoughPathItems; train_schedules.len()];
    let mut to_compute = vec![];
    let mut to_compute_index = vec![];
    for (index, train_schedule) in train_schedules.iter().enumerate() {
        // Retrieve rolling stock
        let rolling_stock_name = &train_schedule.rolling_stock_name;
        let Some(rolling_stock) = rolling_stocks.get(rolling_stock_name).cloned() else {
            let rolling_stock_name = rolling_stock_name.clone();
            results[index] = PathfindingResult::RollingStockNotFound { rolling_stock_name };
            continue;
        };

        // Create the path input
        let path_input = PathfindingInput {
            rolling_stock_loading_gauge: rolling_stock.loading_gauge,
            rolling_stock_is_thermal: rolling_stock.has_thermal_curves(),
            rolling_stock_supported_electrifications: rolling_stock.supported_electrification(),
            rolling_stock_supported_signaling_systems: rolling_stock.supported_signaling_systems.0,
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

    for (index, res) in pathfinding_blocks_batch(conn, redis, core, infra, &to_compute)
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

fn collect_path_item_ids(path_items: &[PathItemLocation]) -> (Vec<String>, Vec<i64>, Vec<String>) {
    let mut trigrams: Vec<String> = Vec::new();
    let mut ops_uic: Vec<i64> = Vec::new();
    let mut ops_id: Vec<String> = Vec::new();

    for item in path_items {
        match item {
            PathItemLocation::OperationalPointDescription { trigram, .. } => {
                trigrams.push(trigram.clone().0);
            }
            PathItemLocation::OperationalPointUic { uic, .. } => {
                ops_uic.push(*uic as i64);
            }
            PathItemLocation::OperationalPointId {
                operational_point, ..
            } => {
                ops_id.push(operational_point.clone().0);
            }
            _ => {}
        }
    }
    (trigrams, ops_uic, ops_id)
}

async fn retrieve_op_from_locations(
    conn: &mut DbConnection,
    infra_id: i64,
    ops_uic: &[i64],
    trigrams: &[String],
    ops_id: &[String],
) -> Result<(
    HashMap<i64, Vec<OperationalPointModel>>,
    HashMap<String, Vec<OperationalPointModel>>,
    HashMap<String, OperationalPointModel>,
)> {
    let mut uic_to_ops: HashMap<i64, Vec<OperationalPointModel>> = HashMap::new();
    OperationalPointModel::retrieve_from_uic(conn, infra_id, ops_uic)
        .await?
        .into_iter()
        .for_each(|op| {
            uic_to_ops
                .entry(op.extensions.identifier.clone().unwrap().uic)
                .or_default()
                .push(op)
        });

    let mut trigrams_to_ops: HashMap<String, Vec<OperationalPointModel>> = HashMap::new();
    OperationalPointModel::retrieve_from_trigrams(conn, infra_id, trigrams)
        .await?
        .into_iter()
        .for_each(|op| {
            trigrams_to_ops
                .entry(op.extensions.sncf.clone().unwrap().trigram)
                .or_default()
                .push(op)
        });

    let ops_id = ops_id.iter().map(|obj_id| (infra_id, obj_id.clone()));
    // a check for missing ids is performed later
    let ids_to_ops: HashMap<_, _> =
        OperationalPointModel::retrieve_batch_unchecked::<_, Vec<_>>(conn, ops_id)
            .await?
            .into_iter()
            .map(|op| (op.obj_id.clone(), op))
            .collect();

    Ok((uic_to_ops, trigrams_to_ops, ids_to_ops))
}

/// Error when extracting track offsets from path items
pub struct TrackOffsetExtractionError {
    /// The index of the path item that caused the error
    pub index: usize,
    /// The path item that caused the error
    pub path_item: PathItemLocation,
}

impl From<TrackOffsetExtractionError> for PathfindingResult {
    fn from(error: TrackOffsetExtractionError) -> Self {
        PathfindingResult::InvalidPathItem {
            index: error.index,
            path_item: error.path_item,
        }
    }
}

/// extract locations from path items
pub async fn extract_location_from_path_items(
    conn: &mut DbConnection,
    infra_id: i64,
    path_items: &[PathItemLocation],
) -> Result<TrackOffsetResult> {
    let (trigrams, ops_uic, ops_id) = collect_path_item_ids(path_items);

    let (uic_to_ops, trigrams_to_ops, ids_to_ops) =
        retrieve_op_from_locations(conn, infra_id, &ops_uic, &trigrams, &ops_id).await?;

    let mut result: Vec<Vec<_>> = Vec::default();
    for (index, path_item) in path_items.iter().enumerate() {
        let track_offsets = match path_item {
            PathItemLocation::TrackOffset(track_offset) => {
                vec![TrackOffset {
                    track: track_offset.track.clone(),
                    offset: track_offset.offset,
                }]
            }
            PathItemLocation::OperationalPointId { operational_point } => {
                match ids_to_ops.get(&operational_point.0) {
                    Some(op) => OperationalPoint::track_offset(op),
                    None => {
                        return Ok(Err(TrackOffsetExtractionError {
                            index,
                            path_item: path_item.clone(),
                        }));
                    }
                }
            }
            PathItemLocation::OperationalPointDescription {
                trigram,
                secondary_code,
            } => {
                let ops = trigrams_to_ops.get(&trigram.0).cloned().unwrap_or_default();
                let ops = secondary_code_filter(secondary_code, ops);
                if ops.is_empty() {
                    return Ok(Err(TrackOffsetExtractionError {
                        index,
                        path_item: path_item.clone(),
                    }));
                }
                track_offsets_from_ops(&ops)
            }
            PathItemLocation::OperationalPointUic {
                uic,
                secondary_code,
            } => {
                let ops = uic_to_ops.get(&(*uic as i64)).cloned().unwrap_or_default();
                let ops = secondary_code_filter(secondary_code, ops);
                if ops.is_empty() {
                    return Ok(Err(TrackOffsetExtractionError {
                        index,
                        path_item: path_item.clone(),
                    }));
                }
                track_offsets_from_ops(&ops)
            }
        };
        result.push(track_offsets);
    }
    Ok(Ok(result))
}

async fn check_tracks_from_path_items(
    conn: &mut DbConnection,
    infra_id: i64,
    track_offsets: &[Vec<TrackOffset>],
) -> Result<std::result::Result<(), PathfindingResult>> {
    for tracks in track_offsets {
        let ids = tracks
            .iter()
            .map(|track_offset| (infra_id, track_offset.track.0.clone()));
        let (_, missings): (Vec<_>, _) = TrackSectionModel::retrieve_batch(conn, ids).await?;
        if !missings.is_empty() {
            return Ok(Err(PathfindingResult::NotFoundInTracks));
        }
    }
    Ok(Ok(()))
}

fn track_offsets_from_ops(ops: &[OperationalPointModel]) -> Vec<TrackOffset> {
    ops.iter()
        .flat_map(|op| OperationalPoint::track_offset(op.as_ref()))
        .collect()
}

/// Filter operational points by secondary code
/// If the secondary code is not provided, the original list is returned
fn secondary_code_filter(
    secondary_code: &Option<String>,
    ops: Vec<OperationalPointModel>,
) -> Vec<OperationalPointModel> {
    if let Some(secondary_code) = secondary_code {
        ops.into_iter()
            .filter(|op| &op.extensions.sncf.as_ref().unwrap().ch == secondary_code)
            .collect()
    } else {
        ops
    }
}
