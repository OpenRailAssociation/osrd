pub mod buffer_stops;
pub mod detectors;
pub mod electrifications;
pub mod infra_error;
pub mod operational_points;
pub mod routes;
pub mod signals;
pub mod speed_sections;
pub mod switch_types;
pub mod switches;
pub mod track_sections;

use std::collections::HashMap;
use std::collections::HashSet;
use std::pin::Pin;

use async_trait::async_trait;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Json;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use futures_util::Future;
use itertools::Itertools;
use serde_json::to_value;
use sha1::Digest;
use sha1::Sha1;
use tracing::warn;

use super::GeneratedData;
use crate::error::Result;
use crate::generated_data::infra_error::InfraError;
use crate::infra_cache::operation::CacheOperation;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use editoast_models::DbConnection;
use editoast_schemas::primitives::OSRDObject;
use editoast_schemas::primitives::ObjectType;

editoast_common::schemas! {
    infra_error::schemas(),
}

/// Empty context used when no context is needed
#[derive(Debug, Default)]
pub struct NoContext;

type ObjectErrorGenerators<Ctx> = [ObjectErrorGenerator<Ctx>];
type GlobalErrorGenerators<Ctx> = [GlobalErrorGenerator<Ctx>];

type FnErrorGeneratorNoContext = fn(&ObjectCache, &InfraCache, &Graph) -> Vec<InfraError>;
type FnErrorGeneratorContext<Ctx> =
    fn(&ObjectCache, &InfraCache, &Graph, Ctx) -> (Vec<InfraError>, Ctx);

pub enum ObjectErrorGenerator<Ctx: Default> {
    NoContext {
        priority: u32,
        check_function: FnErrorGeneratorNoContext,
    },
    WithContext {
        priority: u32,
        check_function: FnErrorGeneratorContext<Ctx>,
    },
}

impl<Ctx: Default> ObjectErrorGenerator<Ctx> {
    pub const fn new(priority: u32, check_function: FnErrorGeneratorNoContext) -> Self {
        ObjectErrorGenerator::NoContext {
            priority,
            check_function,
        }
    }

    pub const fn new_ctx(priority: u32, check_function: FnErrorGeneratorContext<Ctx>) -> Self {
        ObjectErrorGenerator::WithContext {
            priority,
            check_function,
        }
    }

    pub fn get_priority(&self) -> u32 {
        match self {
            ObjectErrorGenerator::NoContext { priority, .. } => *priority,
            ObjectErrorGenerator::WithContext { priority, .. } => *priority,
        }
    }
}

type FnGlobalErrorGeneratorNoContext = fn(&InfraCache, &Graph) -> Vec<InfraError>;
type FnGlobalErrorGeneratorContext<Ctx> = fn(&InfraCache, &Graph, Ctx) -> (Vec<InfraError>, Ctx);

pub enum GlobalErrorGenerator<Ctx> {
    NoContext(FnGlobalErrorGeneratorNoContext),
    WithContext(FnGlobalErrorGeneratorContext<Ctx>),
}

impl<Ctx> GlobalErrorGenerator<Ctx> {
    pub const fn new(check_function: FnGlobalErrorGeneratorNoContext) -> Self {
        GlobalErrorGenerator::NoContext(check_function)
    }

    pub const fn new_ctx(check_function: FnGlobalErrorGeneratorContext<Ctx>) -> Self {
        GlobalErrorGenerator::WithContext(check_function)
    }
}

type ErrorHash = String;

/// An infra error with its hash
struct ErrorWithHash {
    error: InfraError,
    /// Sha1 of the serialized error
    hash: ErrorHash,
}

impl From<InfraError> for ErrorWithHash {
    fn from(error: InfraError) -> Self {
        let mut hasher = Sha1::new();
        hasher.update(&serde_json::to_vec(&error).unwrap());
        let hash = hasher.finalize();
        let hash: ErrorHash = format!("{:x}", hash);
        ErrorWithHash { error, hash }
    }
}

/// Generate errors given static object and global error generators.
/// This function assume that object error generators list isn't empty and sorted by priority.
/// Global errors are generated at the end.
async fn generate_errors<Ctx: Default>(
    object_type: ObjectType,
    infra_cache: &InfraCache,
    graph: &Graph<'_>,
    object_err_generators: &'static ObjectErrorGenerators<Ctx>,
    global_err_generators: &'static GlobalErrorGenerators<Ctx>,
) -> Vec<InfraError> {
    let mut errors = Vec::new();
    let mut context = Ctx::default();

    // Generate object errors
    for el in infra_cache.get_objects_by_type(object_type).values() {
        let mut found_error = false;
        let mut current_priority = 0;
        for f in object_err_generators.iter() {
            if f.get_priority() != current_priority && found_error {
                // No need to check further errors
                break;
            }
            let new_errors = match f {
                ObjectErrorGenerator::NoContext { check_function, .. } => {
                    (check_function)(el, infra_cache, graph)
                }
                ObjectErrorGenerator::WithContext { check_function, .. } => {
                    let (new_errors, new_ctx) = (check_function)(el, infra_cache, graph, context);
                    context = new_ctx;
                    new_errors
                }
            };
            // Update found error
            found_error |= !new_errors.is_empty();
            // Add errors to the list
            errors.extend(new_errors);
            // Update priority
            current_priority = f.get_priority();
        }
    }

    // Generate global errors
    for f in global_err_generators.iter() {
        let new_errors = match f {
            GlobalErrorGenerator::NoContext(check_function) => (check_function)(infra_cache, graph),
            GlobalErrorGenerator::WithContext(check_function) => {
                let (new_errors, new_ctx) = (check_function)(infra_cache, graph, context);
                context = new_ctx;
                new_errors
            }
        };
        // Add errors to the list
        errors.extend(new_errors);
    }
    errors
}

pub async fn generate_infra_errors(infra_cache: &InfraCache) -> Vec<InfraError> {
    // Create a graph for topological errors
    let graph = Graph::load(infra_cache);
    // Generate the errors
    let futures: Vec<Pin<Box<dyn Future<Output = _> + Send>>> = vec![
        Box::pin(generate_errors(
            ObjectType::TrackSection,
            infra_cache,
            &graph,
            &track_sections::OBJECT_GENERATORS,
            &[],
        )),
        Box::pin(generate_errors(
            ObjectType::Signal,
            infra_cache,
            &graph,
            &signals::OBJECT_GENERATORS,
            &[],
        )),
        Box::pin(generate_errors(
            ObjectType::SpeedSection,
            infra_cache,
            &graph,
            &speed_sections::OBJECT_GENERATORS,
            &speed_sections::GLOBAL_GENERATORS,
        )),
        Box::pin(generate_errors(
            ObjectType::Route,
            infra_cache,
            &graph,
            &routes::OBJECT_GENERATORS,
            &routes::GLOBAL_GENERATORS,
        )),
        Box::pin(generate_errors(
            ObjectType::SwitchType,
            infra_cache,
            &graph,
            &switch_types::OBJECT_GENERATORS,
            &[],
        )),
        Box::pin(generate_errors(
            ObjectType::Detector,
            infra_cache,
            &graph,
            &detectors::OBJECT_GENERATORS,
            &[],
        )),
        Box::pin(generate_errors(
            ObjectType::BufferStop,
            infra_cache,
            &graph,
            &buffer_stops::OBJECT_GENERATORS,
            &buffer_stops::GLOBAL_GENERATORS,
        )),
        Box::pin(generate_errors(
            ObjectType::OperationalPoint,
            infra_cache,
            &graph,
            &operational_points::OBJECT_GENERATORS,
            &[],
        )),
        Box::pin(generate_errors(
            ObjectType::Switch,
            infra_cache,
            &graph,
            &switches::OBJECT_GENERATORS,
            &[],
        )),
        Box::pin(generate_errors(
            ObjectType::Electrification,
            infra_cache,
            &graph,
            &electrifications::OBJECT_GENERATORS,
            &electrifications::GLOBAL_GENERATORS,
        )),
    ];

    futures::future::join_all(futures)
        .await
        .into_iter()
        .flatten()
        .collect()
}

/// Get sql query that insert errors given an object type
fn get_insert_errors_query(obj_type: ObjectType) -> &'static str {
    match obj_type {
        ObjectType::TrackSection => include_str!("sql/track_sections_insert_errors.sql"),
        ObjectType::Signal => include_str!("sql/signals_insert_errors.sql"),
        // TODO: update neutral_sections_insert_errors.sql when layers are set up
        ObjectType::NeutralSection => include_str!("sql/neutral_sections_insert_errors.sql"),
        ObjectType::SpeedSection => include_str!("sql/speed_sections_insert_errors.sql"),
        ObjectType::Detector => include_str!("sql/detectors_insert_errors.sql"),
        ObjectType::Switch => include_str!("sql/switches_insert_errors.sql"),
        ObjectType::SwitchType => include_str!("sql/switch_types_insert_errors.sql"),
        ObjectType::BufferStop => include_str!("sql/buffer_stops_insert_errors.sql"),
        ObjectType::Route => include_str!("sql/routes_insert_errors.sql"),
        ObjectType::OperationalPoint => include_str!("sql/operational_points_insert_errors.sql"),
        ObjectType::Electrification => include_str!("sql/electrifications_insert_errors.sql"),
    }
}

/// This function dispatch errors by their object type
fn dispatch_errors_by_object_type(
    errors: Vec<ErrorWithHash>,
) -> HashMap<ObjectType, Vec<ErrorWithHash>> {
    let mut errors_by_type: HashMap<_, Vec<_>> = Default::default();
    for error in errors {
        errors_by_type
            .entry(error.error.get_type())
            .or_default()
            .push(error);
    }
    errors_by_type
}

/// Retrieve the current errors hash for a given infra
async fn retrieve_current_errors_hash(
    conn: &mut DbConnection,
    infra_id: i64,
) -> Result<Vec<ErrorHash>> {
    use crate::tables::infra_layer_error::dsl;
    Ok(dsl::infra_layer_error
        .filter(dsl::infra_id.eq(infra_id))
        .select(dsl::info_hash)
        .load(conn)
        .await?)
}

/// Remove a list of errors given an infra and a list of error hashes
async fn remove_errors_from_hashes(
    conn: &mut DbConnection,
    infra_id: i64,
    errors_hash: &Vec<&ErrorHash>,
) -> Result<()> {
    use crate::tables::infra_layer_error::dsl;
    let nb_deleted = diesel::delete(
        dsl::infra_layer_error
            .filter(dsl::infra_id.eq(infra_id))
            .filter(dsl::info_hash.eq_any(errors_hash)),
    )
    .execute(conn)
    .await?;
    debug_assert_eq!(nb_deleted, errors_hash.len());
    Ok(())
}

/// Remove a list of errors given an infra and a list of error hashes
async fn create_errors(
    conn: &mut DbConnection,
    infra_id: i64,
    errors: Vec<ErrorWithHash>,
) -> Result<()> {
    let errors_by_type = dispatch_errors_by_object_type(errors);
    for (obj_type, errors) in errors_by_type {
        let mut errors_information = vec![];
        let mut errors_hash = vec![];
        for error in errors.iter() {
            errors_information.push(to_value(&error.error).unwrap());
            errors_hash.push(&error.hash);
        }

        let count = sql_query(get_insert_errors_query(obj_type))
            .bind::<BigInt, _>(infra_id)
            .bind::<Array<Json>, _>(&errors_information)
            .bind::<Array<Text>, _>(&errors_hash)
            .execute(conn)
            .await?;
        assert_eq!(count, errors_hash.len());
    }
    Ok(())
}

/// Insert a heterogeneous list of infra errors in DB with a minimum number of queries and operations
/// This function retrieve the existing errors in DB, compare them with the new ones and insert only
/// the new ones. It also remove the errors that are not present anymore.
async fn update_errors(
    conn: &mut DbConnection,
    infra_id: i64,
    errors: Vec<InfraError>,
) -> Result<()> {
    let new_errors_with_hash: Vec<ErrorWithHash> = errors.into_iter().map_into().collect();
    let new_errors_hash = new_errors_with_hash
        .iter()
        .map(|e| e.hash.clone())
        .collect::<HashSet<_>>();

    let current_errors_hash = retrieve_current_errors_hash(conn, infra_id).await?;
    let current_errors_hash = current_errors_hash.into_iter().collect::<HashSet<_>>();

    // Filter errors that must be removed
    let to_remove = current_errors_hash
        .difference(&new_errors_hash)
        .collect_vec();
    remove_errors_from_hashes(conn, infra_id, &to_remove).await?;

    // Filter errors that must be created
    let errors_hash_to_create = new_errors_hash
        .difference(&current_errors_hash)
        .collect_vec();
    let mut errors_to_create: Vec<_> = new_errors_with_hash
        .into_iter()
        .filter(|e| errors_hash_to_create.contains(&&e.hash))
        .collect();
    if errors_hash_to_create.len() != errors_to_create.len() {
        // Deduplicate errors with same hahs
        errors_to_create.sort_by(|e1, e2| e1.hash.cmp(&e2.hash));
        errors_to_create.dedup_by(|e1, e2| e1.hash.eq(&e2.hash));
        warn!("Duplicate errors are generated.");
    }
    create_errors(conn, infra_id, errors_to_create).await
}

pub struct ErrorLayer;

#[async_trait]
impl GeneratedData for ErrorLayer {
    fn table_name() -> &'static str {
        "infra_layer_error"
    }

    async fn generate(
        conn: &mut DbConnection,
        infra_id: i64,
        infra_cache: &InfraCache,
    ) -> Result<()> {
        // Compute current errors
        let infra_errors = generate_infra_errors(infra_cache).await;

        // Insert new errors and remove old ones in DB
        update_errors(conn, infra_id, infra_errors).await
    }

    async fn update(
        conn: &mut DbConnection,
        infra_id: i64,
        _operations: &[CacheOperation],
        infra_cache: &InfraCache,
    ) -> Result<()> {
        // Generate already act like an update
        Self::generate(conn, infra_id, infra_cache).await
    }
}

#[cfg(test)]
mod test {
    use rstest::rstest;

    use super::buffer_stops;
    use super::detectors;
    use super::electrifications;
    use super::generate_errors;
    use super::operational_points;
    use super::routes;
    use super::signals;
    use super::speed_sections;
    use super::switch_types;
    use super::switches;
    use super::track_sections;
    use super::Graph;
    use crate::infra_cache::tests::create_buffer_stop_cache;
    use crate::infra_cache::tests::create_small_infra_cache;
    use editoast_schemas::primitives::ObjectType;

    #[rstest]
    async fn small_infra_cache_validation() {
        let small_infra_cache = create_small_infra_cache();

        let graph = Graph::load(&small_infra_cache);

        // Generate the errors
        assert!(generate_errors(
            ObjectType::TrackSection,
            &small_infra_cache,
            &graph,
            &track_sections::OBJECT_GENERATORS,
            &[],
        )
        .await
        .is_empty());
        assert!(generate_errors(
            ObjectType::Signal,
            &small_infra_cache,
            &graph,
            &signals::OBJECT_GENERATORS,
            &[],
        )
        .await
        .is_empty());
        assert!(generate_errors(
            ObjectType::SpeedSection,
            &small_infra_cache,
            &graph,
            &speed_sections::OBJECT_GENERATORS,
            &speed_sections::GLOBAL_GENERATORS,
        )
        .await
        .is_empty());
        assert!(generate_errors(
            ObjectType::SwitchType,
            &small_infra_cache,
            &graph,
            &switch_types::OBJECT_GENERATORS,
            &[],
        )
        .await
        .is_empty());
        assert!(generate_errors(
            ObjectType::Detector,
            &small_infra_cache,
            &graph,
            &detectors::OBJECT_GENERATORS,
            &[],
        )
        .await
        .is_empty());
        assert!(generate_errors(
            ObjectType::BufferStop,
            &small_infra_cache,
            &graph,
            &buffer_stops::OBJECT_GENERATORS,
            &buffer_stops::GLOBAL_GENERATORS,
        )
        .await
        .is_empty());
        assert!(generate_errors(
            ObjectType::Route,
            &small_infra_cache,
            &graph,
            &routes::OBJECT_GENERATORS,
            &routes::GLOBAL_GENERATORS,
        )
        .await
        .is_empty());
        assert!(generate_errors(
            ObjectType::OperationalPoint,
            &small_infra_cache,
            &graph,
            &operational_points::OBJECT_GENERATORS,
            &[],
        )
        .await
        .is_empty());
        assert!(generate_errors(
            ObjectType::Switch,
            &small_infra_cache,
            &graph,
            &switches::OBJECT_GENERATORS,
            &[],
        )
        .await
        .is_empty());
        assert!(generate_errors(
            ObjectType::Electrification,
            &small_infra_cache,
            &graph,
            &electrifications::OBJECT_GENERATORS,
            &electrifications::GLOBAL_GENERATORS,
        )
        .await
        .is_empty());
    }

    #[rstest]
    async fn error_priority_check() {
        let mut small_infra_cache = create_small_infra_cache();
        let bf = create_buffer_stop_cache("BF_error", "E", 530.0);
        small_infra_cache.add(bf).unwrap();

        let graph = Graph::load(&small_infra_cache);
        let errors = generate_errors(
            ObjectType::BufferStop,
            &small_infra_cache,
            &graph,
            &buffer_stops::OBJECT_GENERATORS,
            &[],
        )
        .await;
        assert_eq!(1, errors.len());
    }
}
