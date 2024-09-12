pub mod path_item_cache;
pub mod pathfinding;
pub mod projection;
mod properties;

use std::collections::HashMap;

use editoast_schemas::train_schedule::PathItemLocation;
pub use pathfinding::pathfinding_from_train_batch;

use editoast_derive::EditoastError;
use thiserror::Error;

use crate::core::pathfinding::TrackRange;
use crate::error::Result;
use crate::models::prelude::*;
use crate::models::Infra;
use crate::models::OperationalPointModel;
use editoast_models::DbConnection;

crate::routes! {
    &properties,
    &pathfinding,
}

editoast_common::schemas! {
    pathfinding::schemas(),
    properties::schemas(),
    TrackRange,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pathfinding")]
pub enum PathfindingError {
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}

async fn retrieve_infra_version(conn: &mut DbConnection, infra_id: i64) -> Result<String> {
    let infra = Infra::retrieve_or_fail(conn, infra_id, || PathfindingError::InfraNotFound {
        infra_id,
    })
    .await?;
    Ok(infra.version)
}

/// Retrieve operational points from operational point uic codes
pub async fn retrieve_op_from_uic(
    conn: &mut DbConnection,
    infra_id: i64,
    ops_uic: &[i64],
) -> Result<HashMap<i64, Vec<OperationalPointModel>>> {
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
    Ok(uic_to_ops)
}

/// Retrieve operational points from operational point trigams
pub async fn retrieve_op_from_trigrams(
    conn: &mut DbConnection,
    infra_id: i64,
    trigrams: &[String],
) -> Result<HashMap<String, Vec<OperationalPointModel>>> {
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
    Ok(trigrams_to_ops)
}

/// Retrieve operational points from operational point ids
pub async fn retrieve_op_from_ids(
    conn: &mut DbConnection,
    infra_id: i64,
    ops_id: &[String],
) -> Result<HashMap<String, OperationalPointModel>> {
    let ops_id = ops_id.iter().map(|obj_id| (infra_id, obj_id.clone()));
    // a check for missing ids is performed later
    let ids_to_ops: HashMap<_, _> =
        OperationalPointModel::retrieve_batch_unchecked::<_, Vec<_>>(conn, ops_id)
            .await?
            .into_iter()
            .map(|op| (op.obj_id.clone(), op))
            .collect();

    Ok(ids_to_ops)
}

/// Filter operational points by secondary code
/// If the secondary code is not provided, the original list is returned
pub fn secondary_code_filter(
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

/// Collect the ids of the operational points from the path items
pub fn collect_path_item_ids(
    path_items: &[&PathItemLocation],
) -> (Vec<String>, Vec<i64>, Vec<String>) {
    let mut trigrams: Vec<String> = Vec::new();
    let mut ops_uic: Vec<i64> = Vec::new();
    let mut ops_id: Vec<String> = Vec::new();

    for item in path_items {
        match item {
            PathItemLocation::OperationalPointDescription { trigram, .. } => {
                trigrams.push(trigram.clone().0);
            }
            PathItemLocation::OperationalPointUic { uic, .. } => {
                ops_uic.push(i64::from(*uic));
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
