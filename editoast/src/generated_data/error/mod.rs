pub mod buffer_stops;
pub mod detectors;
pub mod graph;
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
use crate::infra_cache::InfraCache;
use graph::Graph;

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
        track_sections::insert_errors(conn, infra, infra_cache, &graph)?;
        signals::insert_errors(conn, infra, infra_cache)?;
        speed_sections::insert_errors(conn, infra, infra_cache)?;
        track_section_links::insert_errors(conn, infra, infra_cache)?;
        switch_types::insert_errors(conn, infra, infra_cache)?;
        switches::insert_errors(conn, infra, infra_cache)?;
        detectors::insert_errors(conn, infra, infra_cache)?;
        buffer_stops::insert_errors(conn, infra, infra_cache)?;
        routes::insert_errors(conn, infra, infra_cache, &graph)?;
        operational_points::insert_errors(conn, infra, infra_cache)?;

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
        buffer_stops, detectors, operational_points, routes, signals, speed_sections, switch_types,
        switches, track_section_links, track_sections, Graph,
    };
    use crate::infra_cache::tests::create_small_infra_cache;

    #[test]
    fn small_infra_cache_validation() {
        let small_infra_cache = create_small_infra_cache();

        let graph = Graph::load(&small_infra_cache);

        // Generate the errors
        assert!(track_sections::generate_errors(&small_infra_cache, &graph).is_empty());
        assert!(signals::generate_errors(&small_infra_cache).is_empty());
        assert!(speed_sections::generate_errors(&small_infra_cache).is_empty());
        assert!(track_section_links::generate_errors(&small_infra_cache).is_empty());
        assert!(switch_types::generate_errors(&small_infra_cache).is_empty());
        assert!(switches::generate_errors(&small_infra_cache).is_empty());
        assert!(detectors::generate_errors(&small_infra_cache).is_empty());
        assert!(buffer_stops::generate_errors(&small_infra_cache).is_empty());
        assert!(routes::generate_errors(&small_infra_cache, &graph).is_empty());
        assert!(operational_points::generate_errors(&small_infra_cache).is_empty());
    }
}
