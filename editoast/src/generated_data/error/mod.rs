pub mod buffer_stops;
pub mod detectors;
pub mod operational_points;
pub mod routes;
pub mod signals;
pub mod speed_sections;
pub mod switch_types;
pub mod switches;
pub mod track_section_links;

use std::collections::HashMap;

use diesel::result::Error as DieselError;
use diesel::sql_types::{Array, BigInt, Json};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use serde_json::to_value;

use super::GeneratedData;
use crate::infra_cache::Graph;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{InfraError, OSRDObject, ObjectType};

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

/// Generate errors given static object and global error generators.
/// This function assume that object error generators list isn't empty and sorted by priority.
/// Global errors are generated at the end.
fn generate_errors<Ctx: Default>(
    object_type: ObjectType,
    infra_cache: &InfraCache,
    graph: &Graph,
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

/// Get sql query that insert errors given an object type
fn get_insert_errors_query(obj_type: ObjectType) -> &'static str {
    match obj_type {
        ObjectType::TrackSection => include_str!("sql/track_sections_insert_errors.sql"),
        ObjectType::Signal => include_str!("sql/signals_insert_errors.sql"),
        ObjectType::SpeedSection => include_str!("sql/speed_sections_insert_errors.sql"),
        ObjectType::Detector => include_str!("sql/detectors_insert_errors.sql"),
        ObjectType::TrackSectionLink => include_str!("sql/track_section_links_insert_errors.sql"),
        ObjectType::Switch => include_str!("sql/switches_insert_errors.sql"),
        ObjectType::SwitchType => include_str!("sql/switch_types_insert_errors.sql"),
        ObjectType::BufferStop => include_str!("sql/buffer_stops_insert_errors.sql"),
        ObjectType::Route => include_str!("sql/routes_insert_errors.sql"),
        ObjectType::OperationalPoint => include_str!("sql/operational_points_insert_errors.sql"),
        ObjectType::Catenary => todo!(),
    }
}

/// Insert a heterogeneous list of infra errors in DB with a minimum number of queries
fn insert_errors(
    conn: &mut PgConnection,
    infra_id: i64,
    errors: Vec<InfraError>,
) -> Result<(), DieselError> {
    let mut errors_by_type: HashMap<_, Vec<_>> = Default::default();
    for error in errors {
        errors_by_type
            .entry(error.get_type())
            .or_default()
            .push(to_value(error).unwrap());
    }
    for (obj_type, errors) in errors_by_type {
        let count = sql_query(get_insert_errors_query(obj_type))
            .bind::<BigInt, _>(infra_id)
            .bind::<Array<Json>, _>(&errors)
            .execute(conn)?;
        debug_assert_eq!(count, errors.len());
    }
    Ok(())
}

pub struct ErrorLayer;

impl GeneratedData for ErrorLayer {
    fn table_name() -> &'static str {
        "osrd_infra_errorlayer"
    }

    fn generate(
        conn: &mut PgConnection,
        infra_id: i64,
        infra_cache: &InfraCache,
    ) -> Result<(), DieselError> {
        // Create a graph for topological errors
        let graph = Graph::load(infra_cache);

        // Generate the errors
        let mut infra_errors = generate_errors(
            ObjectType::Signal,
            infra_cache,
            &graph,
            &signals::OBJECT_GENERATORS,
            &[],
        );
        infra_errors.extend(generate_errors(
            ObjectType::SpeedSection,
            infra_cache,
            &graph,
            &speed_sections::OBJECT_GENERATORS,
            &[],
        ));

        infra_errors.extend(generate_errors(
            ObjectType::SwitchType,
            infra_cache,
            &graph,
            &switch_types::OBJECT_GENERATORS,
            &[],
        ));

        infra_errors.extend(generate_errors(
            ObjectType::Detector,
            infra_cache,
            &graph,
            &detectors::OBJECT_GENERATORS,
            &[],
        ));
        infra_errors.extend(generate_errors(
            ObjectType::BufferStop,
            infra_cache,
            &graph,
            &buffer_stops::OBJECT_GENERATORS,
            &buffer_stops::GLOBAL_GENERATORS,
        ));

        infra_errors.extend(generate_errors(
            ObjectType::OperationalPoint,
            infra_cache,
            &graph,
            &operational_points::OBJECT_GENERATORS,
            &[],
        ));

        infra_errors.extend(generate_errors(
            ObjectType::Route,
            infra_cache,
            &graph,
            &routes::OBJECT_GENERATORS,
            &routes::GLOBAL_GENERATORS,
        ));

        infra_errors.extend(generate_errors(
            ObjectType::TrackSectionLink,
            infra_cache,
            &graph,
            &track_section_links::OBJECT_GENERATORS,
            &track_section_links::GLOBAL_GENERATORS,
        ));

        infra_errors.extend(generate_errors(
            ObjectType::Switch,
            infra_cache,
            &graph,
            &switches::OBJECT_GENERATORS,
            &[],
        ));

        // Insert errors in DB
        insert_errors(conn, infra_id, infra_errors)?;

        Ok(())
    }

    fn update(
        conn: &mut PgConnection,
        infra: i64,
        _operations: &[crate::schema::operation::OperationResult],
        infra_cache: &InfraCache,
    ) -> Result<(), DieselError> {
        // Clear the whole layer and regenerate it
        Self::refresh(conn, infra, infra_cache)
    }
}

#[cfg(test)]
mod test {
    use super::{
        buffer_stops, detectors, generate_errors, operational_points, routes, signals,
        speed_sections, switch_types, switches, track_section_links, Graph,
    };

    use crate::infra_cache::tests::{create_buffer_stop_cache, create_small_infra_cache};

    use crate::schema::ObjectType;

    #[test]
    fn small_infra_cache_validation() {
        let small_infra_cache = create_small_infra_cache();

        let graph = Graph::load(&small_infra_cache);

        // Generate the errors
        assert!(generate_errors(
            ObjectType::Signal,
            &small_infra_cache,
            &graph,
            &signals::OBJECT_GENERATORS,
            &[],
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::SpeedSection,
            &small_infra_cache,
            &graph,
            &speed_sections::OBJECT_GENERATORS,
            &[],
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::SwitchType,
            &small_infra_cache,
            &graph,
            &switch_types::OBJECT_GENERATORS,
            &[],
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::Detector,
            &small_infra_cache,
            &graph,
            &detectors::OBJECT_GENERATORS,
            &[],
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::BufferStop,
            &small_infra_cache,
            &graph,
            &buffer_stops::OBJECT_GENERATORS,
            &buffer_stops::GLOBAL_GENERATORS,
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::Route,
            &small_infra_cache,
            &graph,
            &routes::OBJECT_GENERATORS,
            &routes::GLOBAL_GENERATORS,
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::OperationalPoint,
            &small_infra_cache,
            &graph,
            &operational_points::OBJECT_GENERATORS,
            &[],
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::TrackSectionLink,
            &small_infra_cache,
            &graph,
            &[],
            &track_section_links::GLOBAL_GENERATORS,
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::Switch,
            &small_infra_cache,
            &graph,
            &switches::OBJECT_GENERATORS,
            &[],
        )
        .is_empty());
    }

    #[test]
    fn error_priority_check() {
        let mut small_infra_cache = create_small_infra_cache();
        let bf = create_buffer_stop_cache("BF_error", "E", 530.0);
        small_infra_cache.add(bf);

        let graph = Graph::load(&small_infra_cache);
        let errors = generate_errors(
            ObjectType::BufferStop,
            &small_infra_cache,
            &graph,
            &buffer_stops::OBJECT_GENERATORS,
            &[],
        );
        assert_eq!(1, errors.len());
    }
}
