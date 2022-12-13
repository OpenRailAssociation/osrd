pub mod buffer_stops;
pub mod detectors;
pub mod operational_points;
pub mod routes;
pub mod signals;
pub mod speed_sections;
pub mod switch_types;
pub mod switches;
pub mod track_section_links;
pub mod track_sections;

use diesel::result::Error as DieselError;
use diesel::PgConnection;

use super::GeneratedData;
use crate::infra_cache::Graph;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::{InfraError, ObjectType};

type ErrGenerators<'a> = [ErrGenerator];
type FnErrGenerator = fn(&ObjectCache, &InfraCache, &Graph) -> Vec<InfraError>;

pub struct ErrGenerator {
    priority: u32,
    check_function: FnErrGenerator,
}
impl ErrGenerator {
    pub const fn new(priority: u32, check_function: FnErrGenerator) -> Self {
        ErrGenerator {
            priority,
            check_function,
        }
    }
}

pub fn generate_errors(
    object_type: ObjectType,
    infra_cache: &InfraCache,
    graph: &Graph,
    list_err_generators: &'static ErrGenerators,
) -> Vec<InfraError> {
    let mut errors = Vec::new();
    for el in infra_cache.get_objects_by_type(object_type).values() {
        let mut found_error = false;
        let mut current_priority = list_err_generators[0].priority;
        for f in list_err_generators.iter() {
            if f.priority != current_priority && found_error {
                // No need to check further errors
                break;
            }
            let new_errors = (f.check_function)(el, infra_cache, graph);
            // Update found error
            found_error |= !new_errors.is_empty();
            // Add errors to the list
            errors.extend(new_errors);
            // Update priority
            current_priority = f.priority;
        }
    }
    errors
}

pub struct ErrorLayer;

impl GeneratedData for ErrorLayer {
    fn table_name() -> &'static str {
        "osrd_infra_errorlayer"
    }

    fn generate(
        conn: &PgConnection,
        infra: i32,
        infra_cache: &InfraCache,
    ) -> Result<(), DieselError> {
        // Create a graph for topological errors
        let graph = Graph::load(infra_cache);

        // Generate the errors

        let infra_errors = generate_errors(
            ObjectType::TrackSection,
            infra_cache,
            &graph,
            &track_sections::TRACK_SECTIONS_ERRORS,
        );
        track_sections::insert_errors(infra_errors, conn, infra)?;
        let infra_errors = generate_errors(
            ObjectType::Signal,
            infra_cache,
            &graph,
            &signals::SIGNALS_ERRORS,
        );
        signals::insert_errors(infra_errors, conn, infra)?;
        let infra_errors = generate_errors(
            ObjectType::SpeedSection,
            infra_cache,
            &graph,
            &speed_sections::SPEED_SECTION_ERRORS,
        );
        speed_sections::insert_errors(infra_errors, conn, infra)?;

        let infra_errors = generate_errors(
            ObjectType::SwitchType,
            infra_cache,
            &graph,
            &switch_types::SWITCH_TYPES_ERRORS,
        );
        switch_types::insert_errors(infra_errors, conn, infra)?;

        let infra_errors = generate_errors(
            ObjectType::Detector,
            infra_cache,
            &graph,
            &detectors::DETECTOR_ERRORS,
        );
        detectors::insert_errors(infra_errors, conn, infra)?;
        let infra_errors = generate_errors(
            ObjectType::BufferStop,
            infra_cache,
            &graph,
            &buffer_stops::BUFFER_STOP_ERRORS,
        );
        buffer_stops::insert_errors(infra_errors, conn, infra)?;

        let infra_errors = generate_errors(
            ObjectType::OperationalPoint,
            infra_cache,
            &graph,
            &operational_points::OPERATIONAL_POINTS_ERRORS,
        );
        operational_points::insert_errors(infra_errors, conn, infra)?;

        let infra_errors = generate_errors(
            ObjectType::Route,
            infra_cache,
            &graph,
            &routes::ROUTE_ERRORS,
        );
        routes::insert_errors(infra_errors, conn, infra)?;

        // We can't use generate_errors function for switches and track_section_links
        // because we can't split the check functions using the same signature as for other objects
        switches::insert_errors(conn, infra, infra_cache)?;
        track_section_links::insert_errors(conn, infra, infra_cache)?;
        Ok(())
    }

    fn update(
        conn: &PgConnection,
        infra: i32,
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
        speed_sections, switch_types, switches, track_section_links, track_sections, Graph,
    };
    use crate::infra_cache::tests::{create_buffer_stop_cache, create_small_infra_cache};
    use crate::infra_cache::ObjectCache;

    use crate::schema::ObjectType;

    #[test]
    fn small_infra_cache_validation() {
        let small_infra_cache = create_small_infra_cache();

        let graph = Graph::load(&small_infra_cache);

        // Generate the errors
        assert!(generate_errors(
            ObjectType::TrackSection,
            &small_infra_cache,
            &graph,
            &track_sections::TRACK_SECTIONS_ERRORS,
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::Signal,
            &small_infra_cache,
            &graph,
            &signals::SIGNALS_ERRORS,
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::SpeedSection,
            &small_infra_cache,
            &graph,
            &speed_sections::SPEED_SECTION_ERRORS,
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::SwitchType,
            &small_infra_cache,
            &graph,
            &switch_types::SWITCH_TYPES_ERRORS,
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::Detector,
            &small_infra_cache,
            &graph,
            &detectors::DETECTOR_ERRORS,
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::BufferStop,
            &small_infra_cache,
            &graph,
            &buffer_stops::BUFFER_STOP_ERRORS,
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::Route,
            &small_infra_cache,
            &graph,
            &routes::ROUTE_ERRORS,
        )
        .is_empty());
        assert!(generate_errors(
            ObjectType::OperationalPoint,
            &small_infra_cache,
            &graph,
            &operational_points::OPERATIONAL_POINTS_ERRORS,
        )
        .is_empty());

        assert!(switches::generate_errors(&small_infra_cache).is_empty());
        assert!(track_section_links::generate_errors(&small_infra_cache).is_empty());
    }

    #[test]
    fn error_priority_check() {
        let mut small_infra_cache = create_small_infra_cache();
        let bf: ObjectCache = create_buffer_stop_cache("BF_error", "E", 530.0).into();

        small_infra_cache.add(bf);

        let graph = Graph::load(&small_infra_cache);
        let errors = generate_errors(
            ObjectType::BufferStop,
            &small_infra_cache,
            &graph,
            &buffer_stops::BUFFER_STOP_ERRORS,
        );
        assert_eq!(1, errors.len());
    }
}
