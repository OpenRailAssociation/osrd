mod buffer_stops;
mod detectors;
mod graph;
mod operational_points;
mod routes;
mod signals;
mod speed_sections;
mod switch_types;
mod switches;
mod track_section_links;
mod track_sections;

use diesel::result::Error as DieselError;
use diesel::{sql_query, sql_types::Integer, PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};

use crate::client::ChartosConfig;
use crate::{infra_cache::InfraCache, railjson::ObjectRef};

use self::routes::PathEndpointField;

use super::invalidate_chartos_layer;

use graph::Graph;

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct InfraError {
    field: String,
    is_warning: bool,
    #[serde(flatten)]
    sub_type: InfraErrorType,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "error_type", deny_unknown_fields)]
enum InfraErrorType {
    #[serde(rename = "invalid_reference")]
    InvalidReference { reference: ObjectRef },
    #[serde(rename = "out_of_range")]
    OutOfRange {
        position: f64,
        expected_range: [f64; 2],
    },
    #[serde(rename = "empty_path")]
    EmptyPath,
    #[serde(rename = "path_does_not_match_endpoints")]
    PathDoesNotMatchEndpoints {
        expected_track: String,
        expected_position: f64,
        endpoint_field: PathEndpointField,
    },
    #[serde(rename = "unknown_port_name")]
    UnknownPortName { port_name: String },
    #[serde(rename = "invalid_switch_ports")]
    InvalidSwitchPorts,
    #[serde(rename = "empty_object")]
    EmptyObject,
    #[serde(rename = "object_out_of_path")]
    ObjectOutOfPath { position: f64, track: String },
    #[serde(rename = "missing_route")]
    MissingRoute,
    #[serde(rename = "unused_port")]
    UnusedPort { port_name: String },
    #[serde(rename = "duplicated_group")]
    DuplicatedGroup { original_group_path: String },
}

impl InfraError {
    fn new_invalid_reference(field: String, reference: ObjectRef) -> Self {
        Self {
            field,
            is_warning: false,
            sub_type: InfraErrorType::InvalidReference { reference },
        }
    }

    fn new_out_of_range(field: String, position: f64, expected_range: [f64; 2]) -> Self {
        Self {
            field,
            is_warning: false,
            sub_type: InfraErrorType::OutOfRange {
                position,
                expected_range,
            },
        }
    }

    fn new_empty_path(field: String) -> Self {
        Self {
            field,
            is_warning: false,
            sub_type: InfraErrorType::EmptyPath,
        }
    }

    fn new_path_does_not_match_endpoints(
        field: String,
        expected_track: String,
        expected_position: f64,
        endpoint_field: PathEndpointField,
    ) -> Self {
        Self {
            field,
            is_warning: false,
            sub_type: InfraErrorType::PathDoesNotMatchEndpoints {
                expected_track,
                expected_position,
                endpoint_field,
            },
        }
    }

    fn new_empty_object(field: String) -> Self {
        Self {
            field,
            is_warning: true,
            sub_type: InfraErrorType::EmptyObject,
        }
    }

    fn new_object_out_of_path(field: String, position: f64, track: String) -> Self {
        Self {
            field,
            is_warning: false,
            sub_type: InfraErrorType::ObjectOutOfPath { position, track },
        }
    }

    fn new_missing_route() -> Self {
        Self {
            field: Default::default(),
            is_warning: true,
            sub_type: InfraErrorType::MissingRoute,
        }
    }

    fn new_unknown_port_name(field: String, port_name: String) -> Self {
        Self {
            field,
            is_warning: false,
            sub_type: InfraErrorType::UnknownPortName { port_name },
        }
    }

    fn new_invalid_switch_ports(field: String) -> Self {
        Self {
            field,
            is_warning: false,
            sub_type: InfraErrorType::InvalidSwitchPorts,
        }
    }

    fn new_unused_port(field: String, port_name: String) -> Self {
        Self {
            field,
            is_warning: true,
            sub_type: InfraErrorType::UnusedPort { port_name },
        }
    }

    fn new_duplicated_group(field: String, original_group_path: String) -> Self {
        Self {
            field,
            is_warning: true,
            sub_type: InfraErrorType::DuplicatedGroup {
                original_group_path,
            },
        }
    }
}

/// This function regenerate the errors and warnings of the infra
pub fn generate_errors(
    conn: &PgConnection,
    infra: i32,
    infra_cache: &InfraCache,
    chartos_config: &ChartosConfig,
) -> Result<(), DieselError> {
    // Clear the whole layer
    sql_query("DELETE FROM osrd_infra_errorlayer WHERE infra_id = $1")
        .bind::<Integer, _>(infra)
        .execute(conn)?;

    // Create a graph for topological errors
    let _graph = Graph::load(infra_cache);

    // Generate the errors
    track_sections::generate_errors(conn, infra, infra_cache)?;
    signals::generate_errors(conn, infra, infra_cache)?;
    speed_sections::generate_errors(conn, infra, infra_cache)?;
    track_section_links::generate_errors(conn, infra, infra_cache)?;
    switch_types::generate_errors(conn, infra, infra_cache)?;
    switches::generate_errors(conn, infra, infra_cache)?;
    detectors::generate_errors(conn, infra, infra_cache)?;
    buffer_stops::generate_errors(conn, infra, infra_cache)?;
    routes::generate_errors(conn, infra, infra_cache)?;
    operational_points::generate_errors(conn, infra, infra_cache)?;

    // Invalidate chartos cache
    invalidate_chartos_layer(infra, "errors", chartos_config);
    Ok(())
}
