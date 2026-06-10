use core_client::pathfinding::InvalidPathItem;
use core_client::pathfinding::PathfindingInputError;
use database::DbConnection;
use itertools::Itertools;
use schemas::infra::Domestic;
use schemas::infra::OperationalPoint;
use schemas::infra::TrackOffset;
use schemas::primitives::NonBlankString;
use schemas::train_schedule::OperationalPointPartReference;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;
use std::borrow::Borrow;
use std::collections::HashMap;
use std::collections::HashSet;
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
    uic_to_indices: HashMap<(u32, Option<NonBlankString>), usize>,
    /// Maps domestic (country code, main code, secondary code) to indices in the ops Vec
    domestic_to_indices: HashMap<Domestic, usize>,
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
    /// across all available lookup methods (ID, UIC, main code), regardless of
    /// how they were initially queried. This makes the cache API consistent:
    /// an operational point can be retrieved using any of its identifiers,
    /// not just the one used to build the cache.
    #[tracing::instrument(skip(conn, path_items), err)]
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
        let (ops_domestics, ops_uic, ops_id) = collect_path_item_ids(operational_points);
        let uic_conn = &mut conn.clone();
        let domestic_conn = &mut conn.clone();
        let ids_conn = &mut conn.clone();
        let (uic_results, domestics_results, ids_results) = tokio::try_join!(
            retrieve_op_from_uic(uic_conn, infra_id, &ops_uic),
            retrieve_op_from_domestics(domestic_conn, infra_id, &ops_domestics),
            retrieve_op_from_ids(ids_conn, infra_id, &ops_id)
        )?;

        // Step 2: Collect all unique OPs first, deduplicating by obj_id
        let ops: Vec<OperationalPointModel> = ids_results
            .into_iter()
            .chain(domestics_results)
            .chain(uic_results)
            .map(|op| (op.obj_id.clone(), op))
            .collect::<HashMap<String, OperationalPointModel>>()
            .into_values()
            .collect();

        // Step 3: Build index maps from the ops vector
        let mut obj_id_to_index: HashMap<String, usize> = HashMap::new();
        let mut uic_to_indices: HashMap<(u32, Option<NonBlankString>), usize> = HashMap::new();
        let mut domestic_to_indices: HashMap<Domestic, usize> = HashMap::new();

        for (index, op) in ops.iter().enumerate() {
            // Build ID index
            obj_id_to_index.insert(op.obj_id.clone(), index);

            // Build UIC index if present
            if let Some(op_uic) = op.uic {
                uic_to_indices.insert((op_uic, op.secondary_code.clone()), index);
            }

            // Build domestic (country code, main code, secondary code) index if present
            domestic_to_indices.insert(
                Domestic {
                    country_code: op.country_code.clone(),
                    main_code: op.main_code.clone(),
                    secondary_code: op.secondary_code.clone(),
                },
                index,
            );
        }

        Ok(OperationalPointCache {
            ops,
            uic_to_indices,
            domestic_to_indices,
            obj_id_to_index,
            path_item_tracks_exists: Default::default(),
            track_ids_to_local_track_name: Default::default(),
        })
    }

    /// Get the operational points associated with an identifier
    pub fn get_from_id(&self, id: &str) -> Option<&OperationalPointModel> {
        self.obj_id_to_index.get(id).map(|&idx| &self.ops[idx])
    }

    /// Get the operational points associated with a domestic (country code, main code, secondary code)
    pub fn get_from_domestic(&self, domestic: &Domestic) -> Option<&OperationalPointModel> {
        self.domestic_to_indices
            .get(domestic)
            .map(|&idx| &self.ops[idx])
    }

    /// Get the operational points associated with a UIC code
    pub fn get_from_uic(
        &self,
        uic: &(u32, Option<NonBlankString>),
    ) -> Option<&OperationalPointModel> {
        self.uic_to_indices.get(uic).map(|&idx| &self.ops[idx])
    }

    /// Get the track name by track id
    pub fn get_name_by_track(&self, op_id: String, track_id: &str) -> Option<&NonBlankString> {
        let op_index = self.obj_id_to_index.get(&op_id)?;
        self.track_ids_to_local_track_name[*op_index].get(track_id)
    }

    /// Retrieve the operational point ID given a reference
    pub fn get_op_ref_id(&self, op_ref: &OperationalPointReference) -> Option<String> {
        match op_ref {
            OperationalPointReference::Id { operational_point } => self
                .get_from_id(&operational_point.0)
                .map(|op| op.obj_id.clone()),
            OperationalPointReference::Domestic {
                country_code,
                main_code,
                secondary_code,
            } => self
                .get_from_domestic(&Domestic {
                    country_code: country_code.clone(),
                    main_code: main_code.clone(),
                    secondary_code: secondary_code.clone(),
                })
                .map(|op| op.obj_id.clone()),
            OperationalPointReference::Uic {
                uic,
                secondary_code,
            } => self
                .get_from_uic(&(*uic, secondary_code.clone()))
                .map(|op| op.obj_id.clone()),
        }
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
                            OperationalPointReference::Domestic {
                                country_code,
                                main_code,
                                secondary_code,
                            },
                        local_track_name,
                    },
                ) => {
                    let track_offsets = self
                        .get_from_domestic(&Domestic {
                            country_code: country_code.clone(),
                            main_code: main_code.clone(),
                            secondary_code: secondary_code.clone(),
                        })
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
                    let track_offsets = self
                        .get_from_uic(&(*uic, secondary_code.clone()))
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
        uic_to_indices: HashMap<(u32, Option<NonBlankString>), usize>,
        domestic_to_indices: HashMap<Domestic, usize>,
        obj_id_to_index: HashMap<String, usize>,
        path_item_tracks_exists: HashMap<String, bool>,
        track_ids_to_local_track_name: Vec<HashMap<String, NonBlankString>>,
    ) -> Self {
        Self {
            ops,
            uic_to_indices,
            domestic_to_indices,
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
            OperationalPointReference::Domestic {
                country_code,
                ref main_code,
                secondary_code,
            } => self
                .get_from_domestic(&Domestic {
                    country_code: country_code.clone(),
                    main_code: main_code.clone(),
                    secondary_code: secondary_code.clone(),
                })
                .map(|op| &op.schema),
            OperationalPointReference::Uic {
                uic,
                secondary_code,
            } => self
                .get_from_uic(&(uic, secondary_code.clone()))
                .map(|op| &op.schema),
        }
    }
}

/// Collect the ids of the operational points from the path items
fn collect_path_item_ids(
    operational_points: &[OperationalPointReference],
) -> (
    Vec<editoast_models::infra_objects::Domestic>,
    Vec<u32>,
    Vec<String>,
) {
    let mut domestics: HashSet<(String, String, Option<String>)> = HashSet::new();
    let mut ops_uic: HashSet<u32> = HashSet::new();
    let mut ops_id: HashSet<String> = HashSet::new();

    for item in operational_points {
        match item {
            OperationalPointReference::Domestic {
                country_code,
                main_code,
                secondary_code,
            } => {
                domestics.insert((
                    country_code.clone().0,
                    main_code.clone().0,
                    secondary_code.clone().map(|s| s.0),
                ));
            }
            OperationalPointReference::Uic { uic, .. } => {
                ops_uic.insert(*uic);
            }
            OperationalPointReference::Id {
                operational_point, ..
            } => {
                ops_id.insert(operational_point.clone().0);
            }
        }
    }
    (
        domestics.into_iter().collect(),
        ops_uic.into_iter().collect(),
        ops_id.into_iter().collect(),
    )
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

/// Retrieve operational points from operational point domestics (country code, main code, secondary code)
async fn retrieve_op_from_domestics(
    conn: &mut DbConnection,
    infra_id: i64,
    domestics: &[editoast_models::infra_objects::Domestic],
) -> Result<Vec<OperationalPointModel>> {
    OperationalPointModel::retrieve_from_domestics(conn, infra_id, domestics)
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

#[cfg(test)]
mod tests {
    use database::DbConnectionPoolV2;
    use schemas::infra::OperationalPoint;
    use schemas::primitives::Identifier;

    use super::*;
    use crate::fixtures::create_empty_infra;
    use crate::fixtures::create_infra_object;

    fn create_op(
        obj_id: &str,
        main_code: &str,
        uic: u32,
        country_code: &str,
        secondary_code: &str,
    ) -> OperationalPoint {
        OperationalPoint {
            id: Identifier::from(obj_id),
            parts: vec![],
            weight: None,
            name: "Test OP".into(),
            uic: Some(uic),
            plc: None,
            country_code: country_code.into(),
            main_code: main_code.into(),
            secondary_code: Some(secondary_code.into()),
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
        let op1 = create_op("op_1", "ABC", 1234, "FR", "00");
        let op2 = create_op("op_2", "DEF", 91011, "FR", "00"); // UIC not relevant
        let op3 = create_op("op_3", "HIJ", 5678, "FR", "00"); // main code not relevant
        let op4 = create_op("op_4", "ABC", 1111, "DE", "00"); // same main code as op1 but different country code
        let op5 = create_op("op_5", "ABC", 2222, "FR", "11"); // same main code and country code as op1 but different secondary code

        // Insert OPs into the database
        create_infra_object(&mut conn, infra.id, op1).await;
        create_infra_object(&mut conn, infra.id, op2).await;
        create_infra_object(&mut conn, infra.id, op3).await;
        create_infra_object(&mut conn, infra.id, op4).await;
        create_infra_object(&mut conn, infra.id, op5).await;

        // Create path items that reference these OPs by different methods
        let path_items = [
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Id {
                    operational_point: Identifier::from("op_1"),
                },
                local_track_name: None,
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Domestic {
                    country_code: "FR".into(),
                    main_code: "DEF".into(),
                    secondary_code: Some("00".into()),
                },
                local_track_name: None,
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Uic {
                    uic: 5678,
                    secondary_code: Some("00".into()),
                },
                local_track_name: None,
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Domestic {
                    country_code: "DE".into(),
                    main_code: "ABC".into(),
                    secondary_code: Some("00".into()),
                },
                local_track_name: None,
            }),
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: OperationalPointReference::Domestic {
                    country_code: "FR".into(),
                    main_code: "ABC".into(),
                    secondary_code: Some("11".into()),
                },
                local_track_name: None,
            }),
        ];

        // Load the cache using the real load() method
        let cache = OperationalPointCache::load_path_items(conn, infra.id, &path_items)
            .await
            .expect("Failed to load cache");

        // Test OP1 (has both main code and UIC) can be found by all methods
        assert!(
            cache.get_from_id("op_1").is_some(),
            "OP1 should be findable by ID"
        );
        assert!(
            cache
                .get_from_domestic(&Domestic {
                    country_code: "FR".into(),
                    main_code: "ABC".into(),
                    secondary_code: Some("00".into())
                })
                .is_some(),
            "OP1 should be findable by main code even though queried by ID"
        );
        assert!(
            cache.get_from_uic(&(1234, Some("00".into()))).is_some(),
            "OP1 should be findable by UIC even though queried by ID"
        );

        // Verify it's the same OP
        assert_eq!(cache.get_from_id("op_1").unwrap().obj_id, "op_1");
        assert_eq!(
            cache
                .get_from_domestic(&Domestic {
                    country_code: "FR".into(),
                    main_code: "ABC".into(),
                    secondary_code: Some("00".into())
                })
                .unwrap()
                .obj_id,
            "op_1"
        );
        assert_eq!(
            cache
                .get_from_uic(&(1234, Some("00".into())))
                .unwrap()
                .obj_id,
            "op_1"
        );

        // Test OP2 (main code only) is indexed by ID and main code but not UIC
        assert!(
            cache.get_from_id("op_2").is_some(),
            "OP2 should be findable by ID even though queried by main code"
        );
        assert!(
            cache
                .get_from_domestic(&Domestic {
                    country_code: "FR".into(),
                    main_code: "DEF".into(),
                    secondary_code: Some("00".into())
                })
                .is_some(),
            "OP2 should be findable by main code"
        );
        assert_eq!(cache.get_from_id("op_2").unwrap().obj_id, "op_2");
        assert_eq!(
            cache
                .get_from_domestic(&Domestic {
                    country_code: "FR".into(),
                    main_code: "DEF".into(),
                    secondary_code: Some("00".into())
                })
                .unwrap()
                .obj_id,
            "op_2"
        );

        // Test OP3 (UIC only) is indexed by ID and UIC but not main code
        assert!(
            cache.get_from_id("op_3").is_some(),
            "OP3 should be findable by ID even though queried by UIC"
        );
        assert!(
            cache.get_from_uic(&(5678, Some("00".into()))).is_some(),
            "OP3 should be findable by UIC"
        );
        assert_eq!(cache.get_from_id("op_3").unwrap().obj_id, "op_3");
        assert_eq!(
            cache
                .get_from_uic(&(5678, Some("00".into())))
                .unwrap()
                .obj_id,
            "op_3"
        );

        // Test OP4 is indexed differently than OP1 event if it has the same main code
        assert!(
            cache.get_from_id("op_4").is_some(),
            "OP4 should be findable by ID"
        );
        assert_eq!(cache.get_from_id("op_4").unwrap().obj_id, "op_4");
        assert_eq!(
            cache
                .get_from_domestic(&Domestic {
                    country_code: "DE".into(),
                    main_code: "ABC".into(),
                    secondary_code: Some("00".into())
                })
                .unwrap()
                .obj_id,
            "op_4"
        );
        assert_eq!(
            cache
                .get_from_uic(&(1111, Some("00".into())))
                .unwrap()
                .obj_id,
            "op_4"
        );

        // Test OP5 is indexed differently than OP1 event if it has the same main code and country code
        assert!(
            cache.get_from_id("op_5").is_some(),
            "OP5 should be findable by ID"
        );
        assert_eq!(cache.get_from_id("op_5").unwrap().obj_id, "op_5");
        assert_eq!(
            cache
                .get_from_domestic(&Domestic {
                    country_code: "FR".into(),
                    main_code: "ABC".into(),
                    secondary_code: Some("11".into())
                })
                .unwrap()
                .obj_id,
            "op_5"
        );
        assert_eq!(
            cache
                .get_from_uic(&(2222, Some("11".into())))
                .unwrap()
                .obj_id,
            "op_5"
        );
    }
}
