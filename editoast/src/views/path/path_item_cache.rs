use core_client::pathfinding::InvalidPathItem;
use core_client::pathfinding::PathfindingInputError;
use database::DbConnection;
use schemas::infra::TrackOffset;
use schemas::primitives::NonBlankString;
use schemas::train_schedule::OperationalPointIdentifier;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;
use schemas::train_schedule::TrackReference;
use std::collections::HashMap;

use crate::error::Result;
use crate::models::OperationalPointModel;
use crate::models::TrackSectionModel;
use editoast_models::prelude::*;

use super::pathfinding::PathfindingFailure;
use super::pathfinding::PathfindingResult;

type TrackOffsetResult = std::result::Result<Vec<Vec<TrackOffset>>, PathfindingResult>;

/// Gather information about several path items, factorizing db calls.
#[derive(Default, Debug)]
pub struct PathItemCache {
    /// All operational points are stored here exactly once
    ops: Vec<OperationalPointModel>,
    /// Maps UIC code to indices in the ops Vec
    uic_to_indices: HashMap<u32, Vec<usize>>,
    /// Maps trigram to indices in the ops Vec
    trigram_to_indices: HashMap<String, Vec<usize>>,
    /// Maps obj_id to index in the ops Vec
    obj_id_to_index: HashMap<String, usize>,
    track_ids_to_name: HashMap<String, NonBlankString>,
}

impl PathItemCache {
    /// Load the path item cache from a list of pathfinding inputs
    ///
    /// This method ensures that all retrieved operational points are indexed
    /// across all available lookup methods (ID, UIC, trigram), regardless of
    /// how they were initially queried. This makes the cache API consistent:
    /// an operational point can be retrieved using any of its identifiers,
    /// not just the one used to build the cache.
    #[tracing::instrument(skip(conn), err)]
    pub async fn load(
        mut conn: DbConnection,
        infra_id: i64,
        path_items: &[&PathItemLocation],
    ) -> Result<PathItemCache> {
        if path_items.is_empty() {
            return Ok(PathItemCache::default());
        }

        // Step 1: Retrieve operational points from database using the requested identifiers
        let (trigrams, ops_uic, ops_id) = collect_path_item_ids(path_items);
        let uic_conn = &mut conn.clone();
        let trigram_conn = &mut conn.clone();
        let ids_conn = &mut conn.clone();
        let (uic_results, trigram_results, ids_results) = tokio::try_join!(
            retrieve_op_from_uic(uic_conn, infra_id, &ops_uic),
            retrieve_op_from_trigrams(trigram_conn, infra_id, &trigrams),
            retrieve_op_from_ids(ids_conn, infra_id, &ops_id)
        )?;

        // Step 2: Collect all unique OPs first, deduplicating by obj_id
        let ops: Vec<OperationalPointModel> = ids_results
            .into_iter()
            .chain(trigram_results)
            .chain(uic_results)
            .map(|op| (op.obj_id.clone(), op))
            .collect::<HashMap<String, OperationalPointModel>>()
            .into_values()
            .collect();

        // Step 3: Build index maps from the ops vector
        let mut obj_id_to_index: HashMap<String, usize> = HashMap::new();
        let mut uic_to_indices: HashMap<u32, Vec<usize>> = HashMap::new();
        let mut trigram_to_indices: HashMap<String, Vec<usize>> = HashMap::new();

        for (index, op) in ops.iter().enumerate() {
            // Build ID index
            obj_id_to_index.insert(op.obj_id.clone(), index);

            // Build UIC index if present
            if let Some(identifier) = &op.extensions.identifier {
                uic_to_indices
                    .entry(identifier.uic)
                    .or_default()
                    .push(index);
            }

            // Build trigram index if present
            if let Some(sncf) = &op.extensions.sncf {
                trigram_to_indices
                    .entry(sncf.trigram.clone())
                    .or_default()
                    .push(index);
            }
        }

        // Step 4: Retrieve track information
        let op_tracks = ops
            .iter()
            .flat_map(|op| &op.parts)
            .map(|part| (infra_id, part.track.0.clone()));

        let path_item_tracks = path_items.iter().filter_map(|item| match item {
            PathItemLocation::TrackOffset(TrackOffset { track, .. }) => {
                Some((infra_id, track.0.clone()))
            }
            _ => None,
        });

        let tracks = op_tracks.chain(path_item_tracks);
        let track_sections =
            TrackSectionModel::retrieve_batch_unchecked::<_, Vec<_>>(&mut conn, tracks).await?;

        let track_ids_to_name = track_sections
            .into_iter()
            .filter_map(|track| {
                track
                    .extensions
                    .sncf
                    .as_ref()
                    .map(|extension| (track.obj_id.clone(), extension.track_name.clone()))
            })
            .collect();

        Ok(PathItemCache {
            ops,
            uic_to_indices,
            trigram_to_indices,
            obj_id_to_index,
            track_ids_to_name,
        })
    }

    /// Get the operational points associated with an identifier
    pub fn get_from_id(&self, id: &str) -> Option<&OperationalPointModel> {
        self.obj_id_to_index.get(id).map(|&idx| &self.ops[idx])
    }

    /// Get the operational points associated with a trigram
    pub fn get_from_trigram(
        &self,
        trigram: &str,
    ) -> Option<impl Iterator<Item = &OperationalPointModel>> {
        self.trigram_to_indices
            .get(trigram)
            .map(|indices| indices.iter().map(|&idx| &self.ops[idx]))
    }

    /// Get the operational points associated with a UIC code
    pub fn get_from_uic(&self, uic: u32) -> Option<impl Iterator<Item = &OperationalPointModel>> {
        self.uic_to_indices
            .get(&uic)
            .map(|indices| indices.iter().map(|&idx| &self.ops[idx]))
    }

    /// Check if a track exists
    pub fn track_exists(&self, track: &str) -> bool {
        self.track_ids_to_name.contains_key(track)
    }

    pub fn get_from_path_location(
        &self,
        path_item: &PathItemLocation,
    ) -> Option<Vec<&OperationalPointModel>> {
        match path_item {
            PathItemLocation::TrackOffset(_) => None,
            PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference:
                    OperationalPointIdentifier::OperationalPointId {
                        operational_point, ..
                    },
                ..
            }) => self.get_from_id(&operational_point.0).map(|op| vec![op]),
            PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointDescription { trigram, .. },
                ..
            }) => self.get_from_trigram(&trigram.0).map(|op| op.collect()),
            PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointUic { uic, .. },
                ..
            }) => self.get_from_uic(*uic).map(|op| op.collect()),
        }
    }

    /// Retrieve the operational point ID given a reference
    pub fn get_op_ref_id(&self, op_ref: &OperationalPointIdentifier) -> Option<String> {
        let (ops, secondary_code) = match op_ref {
            OperationalPointIdentifier::OperationalPointId { operational_point } => {
                return Some(operational_point.0.clone());
            }
            OperationalPointIdentifier::OperationalPointDescription {
                trigram,
                secondary_code,
            } => (
                self.get_from_trigram(&trigram.0).map(|op| op.collect())?,
                secondary_code,
            ),
            OperationalPointIdentifier::OperationalPointUic {
                uic,
                secondary_code,
            } => (
                self.get_from_uic(*uic).map(|op| op.collect())?,
                secondary_code,
            ),
        };
        secondary_code_filter(secondary_code, ops)
            .into_iter()
            .next()
            .map(|op| op.obj_id.clone())
    }

    /// Retrieve an operational point identifier from a path item location using the cache
    pub fn op_identifier(&self, path_item: &PathItemLocation) -> Option<String> {
        if let PathItemLocation::OperationalPointReference(OperationalPointReference {
            reference,
            ..
        }) = path_item
        {
            self.get_op_ref_id(reference)
        } else {
            None
        }
    }

    /// Extract locations from path items
    pub fn extract_location_from_path_items(
        &self,
        path_items: &[&PathItemLocation],
    ) -> TrackOffsetResult {
        let mut result: Vec<Vec<_>> = Vec::default();
        let mut invalid_path_items = Vec::new();
        for (index, &path_item) in path_items.iter().enumerate() {
            let track_offsets = match path_item {
                PathItemLocation::TrackOffset(track_offset) => {
                    vec![track_offset.clone()]
                }
                PathItemLocation::OperationalPointReference(OperationalPointReference {
                    reference: OperationalPointIdentifier::OperationalPointId { operational_point },
                    track_reference,
                }) => {
                    let mut track_offsets = vec![];
                    if let Some(op) = self.get_from_id(&operational_point.0) {
                        track_offsets = op.track_offset();
                        track_offsets = self.track_reference_filter(track_offsets, track_reference);
                    }
                    if track_offsets.is_empty() {
                        invalid_path_items.push(InvalidPathItem {
                            index,
                            path_item: path_item.clone(),
                        });
                        continue;
                    }
                    track_offsets
                }
                PathItemLocation::OperationalPointReference(OperationalPointReference {
                    reference:
                        OperationalPointIdentifier::OperationalPointDescription {
                            trigram,
                            secondary_code,
                        },
                    track_reference,
                }) => {
                    let ops = self
                        .get_from_trigram(&trigram.0)
                        .map(|op| op.collect())
                        .unwrap_or_default();
                    let ops = secondary_code_filter(secondary_code, ops);
                    let track_offsets = track_offsets_from_ops(ops);
                    let track_offsets = self.track_reference_filter(track_offsets, track_reference);
                    if track_offsets.is_empty() {
                        invalid_path_items.push(InvalidPathItem {
                            index,
                            path_item: path_item.clone(),
                        });
                        continue;
                    };
                    track_offsets
                }
                PathItemLocation::OperationalPointReference(OperationalPointReference {
                    reference:
                        OperationalPointIdentifier::OperationalPointUic {
                            uic,
                            secondary_code,
                        },
                    track_reference,
                }) => {
                    let ops = self
                        .get_from_uic(*uic)
                        .map(|op| op.collect())
                        .unwrap_or_default();
                    let ops = secondary_code_filter(secondary_code, ops);
                    let track_offsets = track_offsets_from_ops(ops);
                    let track_offsets = self.track_reference_filter(track_offsets, track_reference);
                    if track_offsets.is_empty() {
                        invalid_path_items.push(InvalidPathItem {
                            index,
                            path_item: path_item.clone(),
                        });
                        continue;
                    };
                    track_offsets
                }
            };

            // Check if tracks exist
            for track_offset in &track_offsets {
                if !self.track_exists(&track_offset.track.0) {
                    invalid_path_items.push(InvalidPathItem {
                        index,
                        path_item: path_item.clone(),
                    });
                    continue;
                }
            }

            result.push(track_offsets);
        }

        if !invalid_path_items.is_empty() {
            return Err(PathfindingResult::Failure(
                PathfindingFailure::PathfindingInputError(
                    PathfindingInputError::InvalidPathItems {
                        items: invalid_path_items,
                    },
                ),
            ));
        }

        Ok(result)
    }

    /// Filter operational points parts by a track label or a track id
    /// If neither a track label or id is provided, the original list is returned
    pub fn track_reference_filter(
        &self,
        track_offsets: Vec<TrackOffset>,
        track_reference: &Option<TrackReference>,
    ) -> Vec<TrackOffset> {
        match track_reference {
            Some(TrackReference::Id { track_id }) => track_offsets
                .into_iter()
                .filter(|track_offset| &track_offset.track == track_id)
                .collect(),
            Some(TrackReference::Name { track_name }) => track_offsets
                .into_iter()
                .filter(|track_offset| {
                    self.track_ids_to_name.get(&track_offset.track.0) == Some(track_name)
                })
                .collect(),
            None => track_offsets,
        }
    }
}

/// Collect the ids of the operational points from the path items
pub fn collect_path_item_ids(
    path_items: &[&PathItemLocation],
) -> (Vec<String>, Vec<u32>, Vec<String>) {
    let mut trigrams: Vec<String> = Vec::new();
    let mut ops_uic: Vec<u32> = Vec::new();
    let mut ops_id: Vec<String> = Vec::new();

    for item in path_items {
        match item {
            PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointDescription { trigram, .. },
                ..
            }) => {
                trigrams.push(trigram.clone().0);
            }
            PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointUic { uic, .. },
                ..
            }) => {
                ops_uic.push(*uic);
            }
            PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference:
                    OperationalPointIdentifier::OperationalPointId {
                        operational_point, ..
                    },
                ..
            }) => {
                ops_id.push(operational_point.clone().0);
            }
            _ => {}
        }
    }
    (trigrams, ops_uic, ops_id)
}

/// Retrieve operational points from operational point uic codes
pub async fn retrieve_op_from_uic(
    conn: &mut DbConnection,
    infra_id: i64,
    ops_uic: &[u32],
) -> Result<Vec<OperationalPointModel>> {
    OperationalPointModel::retrieve_from_uic(conn, infra_id, ops_uic)
        .await
        .map_err(Into::into)
}

/// Retrieve operational points from operational point trigams
pub async fn retrieve_op_from_trigrams(
    conn: &mut DbConnection,
    infra_id: i64,
    trigrams: &[String],
) -> Result<Vec<OperationalPointModel>> {
    OperationalPointModel::retrieve_from_trigrams(conn, infra_id, trigrams)
        .await
        .map_err(Into::into)
}

/// Retrieve operational points from operational point ids
pub async fn retrieve_op_from_ids(
    conn: &mut DbConnection,
    infra_id: i64,
    ops_id: &[String],
) -> Result<Vec<OperationalPointModel>> {
    let ops_id = ops_id.iter().map(|obj_id| (infra_id, obj_id.clone()));
    // a check for missing ids is performed later
    OperationalPointModel::retrieve_batch_unchecked::<_, Vec<_>>(conn, ops_id)
        .await
        .map_err(Into::into)
}

fn track_offsets_from_ops<'a>(
    ops: impl IntoIterator<Item = &'a OperationalPointModel>,
) -> Vec<TrackOffset> {
    ops.into_iter().flat_map(|op| op.track_offset()).collect()
}

/// Filter operational points by secondary code
/// If the secondary code is not provided, the original list is returned
fn secondary_code_filter<'a>(
    secondary_code: &Option<String>,
    ops: Vec<&'a OperationalPointModel>,
) -> Vec<&'a OperationalPointModel> {
    if let Some(secondary_code) = secondary_code {
        ops.into_iter()
            .filter(|op| &op.extensions.sncf.as_ref().unwrap().ch == secondary_code)
            .collect()
    } else {
        ops
    }
}

#[cfg(test)]
mod tests {
    use database::DbConnectionPoolV2;
    use schemas::infra::OperationalPoint;
    use schemas::infra::OperationalPointExtensions;
    use schemas::infra::OperationalPointIdentifierExtension;
    use schemas::infra::OperationalPointSncfExtension;
    use schemas::primitives::Identifier;

    use super::*;
    use crate::models::fixtures::create_empty_infra;
    use crate::models::fixtures::create_infra_object;

    fn create_op(obj_id: &str, trigram: Option<&str>, uic: Option<u32>) -> OperationalPoint {
        let extensions = OperationalPointExtensions {
            sncf: trigram.map(|t| OperationalPointSncfExtension {
                ci: 0,
                ch: "00".to_string(),
                ch_short_label: "Test".into(),
                ch_long_label: "Test OP".into(),
                trigram: t.to_string(),
            }),
            identifier: uic.map(|u| OperationalPointIdentifierExtension {
                name: "Test OP".into(),
                uic: u,
            }),
        };

        OperationalPoint {
            id: Identifier::from(obj_id),
            parts: vec![],
            extensions,
            weight: None,
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_cache_cross_indexing() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut conn = db_pool.get_ok();
        let infra = create_empty_infra(&mut conn).await;

        // Create three operational points with different identifier combinations
        let op1 = create_op("op_1", Some("ABC"), Some(1234));
        let op2 = create_op("op_2", Some("DEF"), None); // No UIC
        let op3 = create_op("op_3", None, Some(5678)); // No trigram

        // Insert OPs into the database
        create_infra_object(&mut conn, infra.id, op1).await;
        create_infra_object(&mut conn, infra.id, op2).await;
        create_infra_object(&mut conn, infra.id, op3).await;

        // Create path items that reference these OPs by different methods
        let path_items = [
            PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointId {
                    operational_point: Identifier::from("op_1"),
                },
                track_reference: None,
            }),
            PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointDescription {
                    trigram: NonBlankString::from("DEF"),
                    secondary_code: None,
                },
                track_reference: None,
            }),
            PathItemLocation::OperationalPointReference(OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointUic {
                    uic: 5678,
                    secondary_code: None,
                },
                track_reference: None,
            }),
        ];

        let path_item_refs: Vec<&PathItemLocation> = path_items.iter().collect();

        // Load the cache using the real load() method
        let cache = PathItemCache::load(conn, infra.id, &path_item_refs)
            .await
            .expect("Failed to load cache");

        // Test OP1 (has both trigram and UIC) can be found by all methods
        assert!(
            cache.get_from_id("op_1").is_some(),
            "OP1 should be findable by ID"
        );
        assert!(
            cache.get_from_trigram("ABC").is_some(),
            "OP1 should be findable by trigram even though queried by ID"
        );
        assert!(
            cache.get_from_uic(1234).is_some(),
            "OP1 should be findable by UIC even though queried by ID"
        );

        // Verify it's the same OP
        assert_eq!(cache.get_from_id("op_1").unwrap().obj_id, "op_1");
        assert_eq!(
            cache
                .get_from_trigram("ABC")
                .map(|op| op.collect::<Vec<_>>())
                .unwrap()
                .first()
                .unwrap()
                .obj_id,
            "op_1"
        );
        assert_eq!(
            cache
                .get_from_uic(1234)
                .map(|op| op.collect::<Vec<_>>())
                .unwrap()
                .first()
                .unwrap()
                .obj_id,
            "op_1"
        );

        // Test OP2 (trigram only) is indexed by ID and trigram but not UIC
        assert!(
            cache.get_from_id("op_2").is_some(),
            "OP2 should be findable by ID even though queried by trigram"
        );
        assert!(
            cache.get_from_trigram("DEF").is_some(),
            "OP2 should be findable by trigram"
        );
        assert_eq!(cache.get_from_id("op_2").unwrap().obj_id, "op_2");
        assert_eq!(
            cache
                .get_from_trigram("DEF")
                .map(|op| op.collect::<Vec<_>>())
                .unwrap()
                .first()
                .unwrap()
                .obj_id,
            "op_2"
        );

        // Test OP3 (UIC only) is indexed by ID and UIC but not trigram
        assert!(
            cache.get_from_id("op_3").is_some(),
            "OP3 should be findable by ID even though queried by UIC"
        );
        assert!(
            cache.get_from_uic(5678).is_some(),
            "OP3 should be findable by UIC"
        );
        assert_eq!(cache.get_from_id("op_3").unwrap().obj_id, "op_3");
        assert_eq!(
            cache
                .get_from_uic(5678)
                .map(|op| op.collect::<Vec<_>>())
                .unwrap()
                .first()
                .unwrap()
                .obj_id,
            "op_3"
        );
    }
}
