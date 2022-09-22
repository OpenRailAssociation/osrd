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
use diesel::{sql_query, sql_types::Integer, PgConnection, RunQueryDsl};
use serde::{Deserialize, Serialize};

use crate::client::ChartosConfig;
use crate::layer::invalidate_chartos_layer;
use crate::{infra_cache::InfraCache, objects::ObjectRef};

use self::routes::PathEndpointField;

use graph::Graph;

#[derive(Serialize, Deserialize, PartialEq, Debug)]
#[serde(deny_unknown_fields)]
pub struct InfraError {
    field: String,
    is_warning: bool,
    #[serde(flatten)]
    sub_type: InfraErrorType,
    #[serde(skip)]
    obj_id: String,
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
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
    #[serde(rename = "no_buffer_stop")]
    NoBufferStop,
    #[serde(rename = "path_is_not_continuous")]
    PathIsNotContinuous,
    #[serde(rename = "overlapping_switches")]
    OverlappingSwitches { reference: ObjectRef },
    #[serde(rename = "overlapping_track_links")]
    OverlappingTrackLinks { reference: ObjectRef },
}

impl InfraError {
    fn new_invalid_reference<T: AsRef<str>, U: AsRef<str>>(
        obj_id: U,
        field: T,
        reference: ObjectRef,
    ) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::InvalidReference { reference },
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_out_of_range<T: AsRef<str>, U: AsRef<str>>(
        obj_id: U,
        field: T,
        position: f64,
        expected_range: [f64; 2],
    ) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::OutOfRange {
                position,
                expected_range,
            },
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_empty_path<T: AsRef<str>, U: AsRef<str>>(obj_id: U, field: T) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::EmptyPath,
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_path_does_not_match_endpoints<T: AsRef<str>, U: AsRef<str>>(
        obj_id: U,
        field: T,
        expected_track: String,
        expected_position: f64,
        endpoint_field: PathEndpointField,
    ) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::PathDoesNotMatchEndpoints {
                expected_track,
                expected_position,
                endpoint_field,
            },
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_empty_object<T: AsRef<str>, U: AsRef<str>>(obj_id: U, field: T) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: true,
            sub_type: InfraErrorType::EmptyObject,
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_object_out_of_path<T: AsRef<str>, U: AsRef<str>>(
        obj_id: U,
        field: T,
        position: f64,
        track: String,
    ) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::ObjectOutOfPath { position, track },
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_missing_route<U: AsRef<str>>(obj_id: U) -> Self {
        Self {
            field: Default::default(),
            is_warning: true,
            sub_type: InfraErrorType::MissingRoute,
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_unknown_port_name<T: AsRef<str>, U: AsRef<str>>(
        obj_id: U,
        field: T,
        port_name: String,
    ) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::UnknownPortName { port_name },
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_invalid_switch_ports<T: AsRef<str>, U: AsRef<str>>(obj_id: U, field: T) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::InvalidSwitchPorts,
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_unused_port<T: AsRef<str>, U: AsRef<str>>(
        obj_id: U,
        field: T,
        port_name: String,
    ) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: true,
            sub_type: InfraErrorType::UnusedPort { port_name },
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_duplicated_group<T: AsRef<str>, U: AsRef<str>>(
        obj_id: U,
        field: T,
        original_group_path: String,
    ) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: true,
            sub_type: InfraErrorType::DuplicatedGroup {
                original_group_path,
            },
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_no_buffer_stop<T: AsRef<str>, U: AsRef<str>>(obj_id: U, field: T) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: true,
            sub_type: InfraErrorType::NoBufferStop,
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_path_is_not_continuous<T: AsRef<str>, U: AsRef<str>>(obj_id: U, field: T) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::PathIsNotContinuous,
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_overlapping_switches<U: AsRef<str>>(obj_id: U, reference: ObjectRef) -> Self {
        Self {
            field: Default::default(),
            is_warning: false,
            sub_type: InfraErrorType::OverlappingSwitches { reference },
            obj_id: obj_id.as_ref().into(),
        }
    }

    fn new_overlapping_track_links<U: AsRef<str>>(obj_id: U, reference: ObjectRef) -> Self {
        Self {
            field: Default::default(),
            is_warning: true,
            sub_type: InfraErrorType::OverlappingTrackLinks { reference },
            obj_id: obj_id.as_ref().into(),
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

    // Invalidate chartos cache
    invalidate_chartos_layer(infra, "errors", chartos_config);
    Ok(())
}
