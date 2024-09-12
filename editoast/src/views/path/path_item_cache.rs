use std::collections::HashMap;
use std::collections::HashSet;

use editoast_models::DbConnection;
use editoast_schemas::infra::TrackOffset;
use editoast_schemas::train_schedule::PathItemLocation;

use crate::core::pathfinding::PathfindingResult;
use crate::error::Result;
use crate::models::OperationalPointModel;
use crate::models::TrackSectionModel;
use crate::RetrieveBatchUnchecked;

use super::collect_path_item_ids;
use super::retrieve_op_from_ids;
use super::retrieve_op_from_trigrams;
use super::retrieve_op_from_uic;
use super::secondary_code_filter;

type TrackOffsetResult = std::result::Result<Vec<Vec<TrackOffset>>, PathfindingResult>;

/// Gather information about several path items, factorizing db calls.
pub struct PathItemCache {
    uic_to_ops: HashMap<i64, Vec<OperationalPointModel>>,
    trigram_to_ops: HashMap<String, Vec<OperationalPointModel>>,
    ids_to_ops: HashMap<String, OperationalPointModel>,
    existing_track_ids: HashSet<String>,
}

impl PathItemCache {
    /// Load the path item cache from a list of pathfinding inputs
    pub async fn load(
        conn: &mut DbConnection,
        infra_id: i64,
        path_items: &[&PathItemLocation],
    ) -> Result<PathItemCache> {
        let (trigrams, ops_uic, ops_id) = collect_path_item_ids(path_items);
        let uic_to_ops = retrieve_op_from_uic(conn, infra_id, &ops_uic).await?;
        let trigram_to_ops = retrieve_op_from_trigrams(conn, infra_id, &trigrams).await?;
        let ids_to_ops = retrieve_op_from_ids(conn, infra_id, &ops_id).await?;

        let tracks = path_items.iter().filter_map(|item| match item {
            PathItemLocation::TrackOffset(TrackOffset { track, .. }) => {
                Some((infra_id, track.0.clone()))
            }
            _ => None,
        });
        let tracks = ids_to_ops
            .values()
            .chain(trigram_to_ops.values().flatten())
            .chain(uic_to_ops.values().flatten())
            .flat_map(|op| &op.parts)
            .map(|part| (infra_id, part.track.0.clone()))
            .chain(tracks);
        let existing_track_ids =
            TrackSectionModel::retrieve_batch_unchecked::<_, Vec<_>>(conn, tracks)
                .await?
                .into_iter()
                .map(|track| track.obj_id)
                .collect();

        Ok(PathItemCache {
            uic_to_ops,
            trigram_to_ops,
            ids_to_ops,
            existing_track_ids,
        })
    }

    /// Get the operational points associated with an identifier
    pub fn get_from_id(&self, id: &str) -> Option<&OperationalPointModel> {
        self.ids_to_ops.get(id)
    }

    /// Get the operational points associated with a trigram
    pub fn get_from_trigram(&self, trigram: &str) -> Option<&Vec<OperationalPointModel>> {
        self.trigram_to_ops.get(trigram)
    }

    /// Get the operational points associated with a UIC code
    pub fn get_from_uic(&self, uic: i64) -> Option<&Vec<OperationalPointModel>> {
        self.uic_to_ops.get(&uic)
    }

    /// Check if a track exists
    pub fn track_exists(&self, track: &str) -> bool {
        self.existing_track_ids.contains(track)
    }

    /// Extract locations from path items
    pub fn extract_location_from_path_items(
        &self,
        path_items: &[&PathItemLocation],
    ) -> TrackOffsetResult {
        let mut result: Vec<Vec<_>> = Vec::default();
        for (index, &path_item) in path_items.iter().enumerate() {
            let track_offsets = match path_item {
                PathItemLocation::TrackOffset(track_offset) => {
                    vec![track_offset.clone()]
                }
                PathItemLocation::OperationalPointId { operational_point } => {
                    match self.get_from_id(&operational_point.0) {
                        Some(op) => op.track_offset(),
                        None => {
                            return Err(PathfindingResult::InvalidPathItem {
                                index,
                                path_item: path_item.clone(),
                            });
                        }
                    }
                }
                PathItemLocation::OperationalPointDescription {
                    trigram,
                    secondary_code,
                } => {
                    let ops = self
                        .get_from_trigram(&trigram.0)
                        .cloned()
                        .unwrap_or_default();
                    let ops = secondary_code_filter(secondary_code, ops);
                    if ops.is_empty() {
                        return Err(PathfindingResult::InvalidPathItem {
                            index,
                            path_item: path_item.clone(),
                        });
                    }
                    track_offsets_from_ops(&ops)
                }
                PathItemLocation::OperationalPointUic {
                    uic,
                    secondary_code,
                } => {
                    let ops = self
                        .get_from_uic(i64::from(*uic))
                        .cloned()
                        .unwrap_or_default();
                    let ops = secondary_code_filter(secondary_code, ops);
                    if ops.is_empty() {
                        return Err(PathfindingResult::InvalidPathItem {
                            index,
                            path_item: path_item.clone(),
                        });
                    }
                    track_offsets_from_ops(&ops)
                }
            };

            // Check if tracks exist
            for track_offset in &track_offsets {
                if !self.track_exists(&track_offset.track.0) {
                    return Err(PathfindingResult::InvalidPathItem {
                        index,
                        path_item: path_item.clone(),
                    });
                }
            }

            result.push(track_offsets);
        }
        Ok(result)
    }
}

fn track_offsets_from_ops(ops: &[OperationalPointModel]) -> Vec<TrackOffset> {
    ops.iter().flat_map(|op| op.track_offset()).collect()
}
