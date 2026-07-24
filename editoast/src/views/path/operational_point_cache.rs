use core_client::pathfinding::InvalidPathItem;
use core_client::pathfinding::PathfindingInputError;
use database::DbConnection;
use itertools::Itertools;
use schemas::infra::OperationalPoint;
use schemas::infra::TrackOffset;
use schemas::primitives::NonBlankString;
use schemas::train_schedule::OperationalPointPartReference;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;
use std::borrow::Borrow;
use std::collections::HashMap;
use tracing::error;

use crate::error::Result;
use editoast_models::OperationalPointModel;
use editoast_models::TrackSectionModel;

use super::pathfinding::PathfindingFailure;

type TrackOffsetResult = std::result::Result<Vec<Vec<TrackOffset>>, PathfindingFailure>;

/// Gather information about several path items, factorizing db calls.
#[derive(Default, Debug)]
pub struct OperationalPointCache {
    /// All operational points are stored here exactly once
    ops: Vec<OperationalPointModel>,
    /// Maps UIC code to indices in the ops Vec
    uic_to_indices: HashMap<u32, Vec<usize>>,
    /// Maps trigram to indices in the ops Vec
    trigram_to_indices: HashMap<NonBlankString, Vec<usize>>,
    /// Maps obj_id to index in the ops Vec
    obj_id_to_index: HashMap<String, usize>,
    /// Information about track section existence for path item tracks
    path_item_tracks_exists: HashMap<String, bool>,
    /// For each operational point, map track section to local track name
    track_ids_to_local_track_name: Vec<HashMap<String, NonBlankString>>,
}

impl OperationalPointCache {
    /// Load the operational point cache from a list of pathfinding inputs
    ///
    /// This method ensures that all retrieved operational points are indexed
    /// across all available lookup methods (ID, UIC, trigram), regardless of
    /// how they were initially queried. This makes the cache API consistent:
    /// an operational point can be retrieved using any of its identifiers,
    /// not just the one used to build the cache.
    #[tracing::instrument(skip(conn), err)]
    pub async fn load_path_items<L: Borrow<PathItemLocation> + std::fmt::Debug + Sync>(
        mut conn: DbConnection,
        infra_id: i64,
        path_items: &[L],
    ) -> Result<OperationalPointCache> {
        if path_items.is_empty() {
            return Ok(OperationalPointCache::default());
        }

        let mut op_cache = Self::load_from_operational_points(
            conn.clone(),
            infra_id,
            &path_items
                .iter()
                .filter_map(|e| match e.borrow() {
                    PathItemLocation::OperationalPointPartReference(op_ref) => {
                        Some(op_ref.operational_point.clone())
                    }
                    _ => None,
                })
                .collect_vec(),
        )
        .await?;

        // Retrieve track information
        let path_item_tracks = path_items
            .iter()
            .filter_map(|item| match item.borrow() {
                PathItemLocation::TrackOffset(TrackOffset { track, .. }) => Some(track.0.clone()),
                _ => None,
            })
            .collect_vec();

        let existing_track_sections =
            TrackSectionModel::exists_from_ids(&mut conn, infra_id, &path_item_tracks).await?;

        // Not all track sections may have been found.
        op_cache.path_item_tracks_exists = path_item_tracks
            .into_iter()
            .map(|track| (track.clone(), existing_track_sections.contains(&track)))
            .collect();

        let track_ids_to_local_track_name = op_cache
            .ops
            .iter()
            .map(|op| {
                op.parts
                    .iter()
                    .map(|part| (part.track.0.clone(), part.local_track_name.clone()))
                    .collect()
            })
            .collect();

        op_cache.track_ids_to_local_track_name = track_ids_to_local_track_name;
        Ok(op_cache)
    }

    #[tracing::instrument(skip(conn), err)]
    pub async fn load_from_operational_points(
        conn: DbConnection,
        infra_id: i64,
        operational_points: &[OperationalPointReference],
    ) -> Result<OperationalPointCache> {
        if operational_points.is_empty() {
            return Ok(OperationalPointCache::default());
        }

        // Step 1: Retrieve operational points from database using the requested identifiers
        let (trigrams, ops_uic, ops_id) = collect_path_item_ids(operational_points);
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
        let mut trigram_to_indices: HashMap<NonBlankString, Vec<usize>> = HashMap::new();

        for (index, op) in ops.iter().enumerate() {
            // Build ID index
            obj_id_to_index.insert(op.obj_id.clone(), index);

            // Build UIC index if present
            if let Some(op_uic) = op.uic {
                uic_to_indices.entry(op_uic).or_default().push(index);
            }

            // Build trigram index if present
            trigram_to_indices
                .entry(op.main_code.clone())
                .or_default()
                .push(index);
        }

        Ok(OperationalPointCache {
            ops,
            uic_to_indices,
            trigram_to_indices,
            obj_id_to_index,
            path_item_tracks_exists: Default::default(),
            track_ids_to_local_track_name: Default::default(),
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

    /// Get the track name by track id
    pub fn get_name_by_track(&self, op_id: String, track_id: &str) -> Option<&NonBlankString> {
        let op_index = self.obj_id_to_index.get(&op_id)?;
        self.track_ids_to_local_track_name[*op_index].get(track_id)
    }

    /// Retrieve the operational point ID given a reference
    pub fn get_op_ref_id(&self, op_ref: &OperationalPointReference) -> Option<String> {
        let (ops, secondary_code) = match op_ref {
            OperationalPointReference::Id { operational_point } => {
                return Some(operational_point.0.clone());
            }
            OperationalPointReference::Trigram {
                trigram,
                secondary_code,
            } => (
                self.get_from_trigram(&trigram.0).map(|op| op.collect())?,
                secondary_code,
            ),
            OperationalPointReference::Uic {
                uic,
                secondary_code,
            } => (
                self.get_from_uic(*uic).map(|op| op.collect())?,
                secondary_code,
            ),
        };
        find_op_by_secondary_code(secondary_code.as_ref(), ops).map(|op| op.obj_id.clone())
    }

    /// Extract locations from path items
    pub fn extract_location_from_path_items<L: Borrow<PathItemLocation>>(
        &self,
        path_items: &[L],
    ) -> TrackOffsetResult {
        let mut result: Vec<Vec<_>> = Vec::default();
        let mut invalid_path_items = Vec::new();
        for (index, path_item) in path_items.iter().enumerate() {
            let path_item = path_item.borrow();
            let track_offsets = match path_item {
                PathItemLocation::TrackOffset(track_offset) => {
                    match self.path_item_tracks_exists.get(&track_offset.track.0) {
                        Some(true) => {
                            vec![track_offset.clone()]
                        }
                        Some(false) => {
                            invalid_path_items.push(InvalidPathItem {
                                index,
                                path_item: path_item.clone(),
                            });
                            continue;
                        }
                        None => {
                            error!(
                                "The path item track was not part of the operational point cache."
                            );
                            invalid_path_items.push(InvalidPathItem {
                                index,
                                path_item: path_item.clone(),
                            });
                            continue;
                        }
                    }
                }
                PathItemLocation::OperationalPointPartReference(
                    OperationalPointPartReference {
                        operational_point: OperationalPointReference::Id { operational_point },
                        local_track_name,
                    },
                ) => {
                    let mut track_offsets = vec![];
                    if let Some(op) = self.get_from_id(&operational_point.0) {
                        track_offsets =
                            op.track_offsets_by_local_track_name(local_track_name.as_ref());
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
                PathItemLocation::OperationalPointPartReference(
                    OperationalPointPartReference {
                        operational_point:
                            OperationalPointReference::Trigram {
                                trigram,
                                secondary_code,
                            },
                        local_track_name,
                    },
                ) => {
                    let ops = self
                        .get_from_trigram(&trigram.0)
                        .map(|op| op.collect())
                        .unwrap_or_default();
                    let op = find_op_by_secondary_code(secondary_code.as_ref(), ops);
                    let track_offsets = op
                        .map(|op| op.track_offsets_by_local_track_name(local_track_name.as_ref()))
                        .unwrap_or_default();
                    if track_offsets.is_empty() {
                        invalid_path_items.push(InvalidPathItem {
                            index,
                            path_item: path_item.clone(),
                        });
                        continue;
                    };
                    track_offsets
                }
                PathItemLocation::OperationalPointPartReference(
                    OperationalPointPartReference {
                        operational_point:
                            OperationalPointReference::Uic {
                                uic,
                                secondary_code,
                            },
                        local_track_name,
                    },
                ) => {
                    let ops = self
                        .get_from_uic(*uic)
                        .map(|op| op.collect())
                        .unwrap_or_default();
                    let op = find_op_by_secondary_code(secondary_code.as_ref(), ops);
                    let track_offsets = op
                        .map(|op| op.track_offsets_by_local_track_name(local_track_name.as_ref()))
                        .unwrap_or_default();
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

            result.push(track_offsets);
        }

        if !invalid_path_items.is_empty() {
            return Err(PathfindingFailure::PathfindingInputError(
                PathfindingInputError::InvalidPathItems {
                    items: invalid_path_items,
                },
            ));
        }

        Ok(result)
    }

    #[cfg(test)]
    pub(crate) fn new(
        ops: Vec<OperationalPointModel>,
        uic_to_indices: HashMap<u32, Vec<usize>>,
        trigram_to_indices: HashMap<NonBlankString, Vec<usize>>,
        obj_id_to_index: HashMap<String, usize>,
        path_item_tracks_exists: HashMap<String, bool>,
        track_ids_to_local_track_name: Vec<HashMap<String, NonBlankString>>,
    ) -> Self {
        Self {
            ops,
            uic_to_indices,
            trigram_to_indices,
            obj_id_to_index,
            path_item_tracks_exists,
            track_ids_to_local_track_name,
        }
    }

    pub fn get_reference(&self, op_ref: OperationalPointReference) -> Option<&OperationalPoint> {
        match op_ref {
            OperationalPointReference::Id {
                ref operational_point,
            } => self
                .get_from_id(&operational_point.0)
                .map(|op_model| &op_model.schema),
            OperationalPointReference::Trigram {
                ref trigram,
                secondary_code,
            } => self.get_from_trigram(&trigram.0).and_then(|op_models| {
                find_op_by_secondary_code(secondary_code.as_ref(), op_models.collect())
                    .map(|op| &op.schema)
            }),
            OperationalPointReference::Uic {
                uic,
                secondary_code,
            } => self.get_from_uic(uic).and_then(|op_models| {
                find_op_by_secondary_code(secondary_code.as_ref(), op_models.collect())
                    .map(|op| &op.schema)
            }),
        }
    }
}

/// Collect the ids of the operational points from the path items
fn collect_path_item_ids(
    operational_points: &[OperationalPointReference],
) -> (Vec<String>, Vec<u32>, Vec<String>) {
    let mut trigrams: Vec<String> = Vec::new();
    let mut ops_uic: Vec<u32> = Vec::new();
    let mut ops_id: Vec<String> = Vec::new();

    for item in operational_points {
        match item {
            OperationalPointReference::Trigram { trigram, .. } => {
                trigrams.push(trigram.clone().0);
            }
            OperationalPointReference::Uic { uic, .. } => {
                ops_uic.push(*uic);
            }
            OperationalPointReference::Id {
                operational_point, ..
            } => {
                ops_id.push(operational_point.clone().0);
            }
        }
    }
    (trigrams, ops_uic, ops_id)
}

/// Retrieve operational points from operational point uic codes
async fn retrieve_op_from_uic(
    conn: &mut DbConnection,
    infra_id: i64,
    ops_uic: &[u32],
) -> Result<Vec<OperationalPointModel>> {
    OperationalPointModel::retrieve_from_uic(conn, infra_id, ops_uic)
        .await
        .map_err(Into::into)
}

/// Retrieve operational points from operational point trigrams
async fn retrieve_op_from_trigrams(
    conn: &mut DbConnection,
    infra_id: i64,
    trigrams: &[String],
) -> Result<Vec<OperationalPointModel>> {
    OperationalPointModel::retrieve_from_trigrams(conn, infra_id, trigrams)
        .await
        .map_err(Into::into)
}

/// Retrieve operational points from operational point ids
async fn retrieve_op_from_ids(
    conn: &mut DbConnection,
    infra_id: i64,
    ops_id: &[String],
) -> Result<Vec<OperationalPointModel>> {
    OperationalPointModel::retrieve_from_ids(conn, infra_id, ops_id)
        .await
        .map_err(Into::into)
}

/// Filter operational points by secondary code to return one unique OP
/// since the tuple (operational_point, ch) is supposed to be unique in a given infra.
/// If secondary_code is None, searches for an OP without sncf extension.
/// If secondary_code is Some, searches for an OP whose sncf extension matches the given code.
fn find_op_by_secondary_code<'a>(
    secondary_code: Option<&NonBlankString>,
    ops: Vec<&'a OperationalPointModel>,
) -> Option<&'a OperationalPointModel> {
    ops.into_iter()
        .find(|op| secondary_code == op.secondary_code.as_ref())
}

#[cfg(test)]
mod tests {
    use database::DbConnectionPoolV2;
    use schemas::infra::OperationalPoint;
    use schemas::primitives::Identifier;

    use super::*;
    use crate::fixtures::create_empty_infra;
    use crate::fixtures::create_infra_object;

    fn create_op(obj_id: &str, main_code: &str, uic: u32) -> OperationalPoint {
        OperationalPoint {
            id: Identifier::from(obj_id),
            parts: vec![],
            weight: None,
            name: "Test OP".into(),
            uic: Some(uic),
            plc: None,
            country_code: "FR".into(),
            main_code: main_code.into(),
            secondary_code: Some("00".into()),
            is_passenger_station: false,
            secondary_name: Some("Test OP".into()),
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_cache_cross_indexing() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut conn = db_pool.get_ok();
        let infra = create_empty_infra(&mut conn).await;

        // Create three operational points with different identifier combinations
        let op1 = create_op("op_1", "ABC", 1234);
        let op2 = create_op("op_2", "DEF", 91011); // UIC not revelant
        let op3 = create_op("op_3", "HIJ", 5678); // trigram not revelant

        // Insert OPs into the database
        create_infra_object(&mut conn, infra.id, op1).await;
        create_infra_object(&mut conn, infra.id, op2).await;
        create_infra_object(&mut conn, infra.id, op3).await;

        // Create path items that reference these OPs by different methods
        let path_items = [
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Id {
                    operational_point: Identifier::from("op_1"),
                },
                local_track_name: None,
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Trigram {
                    trigram: NonBlankString::from("DEF"),
                    secondary_code: None,
                },
                local_track_name: None,
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Uic {
                    uic: 5678,
                    secondary_code: None,
                },
                local_track_name: None,
            }),
        ];

        // Load the cache using the real load() method
        let cache = OperationalPointCache::load_path_items(conn, infra.id, &path_items)
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
