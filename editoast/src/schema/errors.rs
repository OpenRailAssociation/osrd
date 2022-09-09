use std::fmt;

use serde::{Deserialize, Serialize};
use strum_macros::EnumIter;

use crate::schema::ObjectRef;

use super::{Direction, DirectionalTrackRange, Route};

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

/// Represent the entry or exit point of a path
#[derive(Serialize, Deserialize, Debug, Clone, Copy, EnumIter, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub enum PathEndpointField {
    #[serde(rename = "entry_point")]
    EntryPoint,
    #[serde(rename = "exit_point")]
    ExitPoint,
}

impl InfraError {
    pub fn get_id(&self) -> &String {
        &self.obj_id
    }

    pub fn new_invalid_reference<T: AsRef<str>, U: AsRef<str>>(
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

    pub fn new_out_of_range<T: AsRef<str>, U: AsRef<str>>(
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

    pub fn new_empty_path<T: AsRef<str>, U: AsRef<str>>(obj_id: U, field: T) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::EmptyPath,
            obj_id: obj_id.as_ref().into(),
        }
    }

    pub fn new_path_does_not_match_endpoints<T: AsRef<str>, U: AsRef<str>>(
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

    pub fn new_empty_object<T: AsRef<str>, U: AsRef<str>>(obj_id: U, field: T) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: true,
            sub_type: InfraErrorType::EmptyObject,
            obj_id: obj_id.as_ref().into(),
        }
    }

    pub fn new_object_out_of_path<T: AsRef<str>, U: AsRef<str>>(
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

    pub fn new_missing_route<U: AsRef<str>>(obj_id: U) -> Self {
        Self {
            field: Default::default(),
            is_warning: true,
            sub_type: InfraErrorType::MissingRoute,
            obj_id: obj_id.as_ref().into(),
        }
    }

    pub fn new_unknown_port_name<T: AsRef<str>, U: AsRef<str>>(
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

    pub fn new_invalid_switch_ports<T: AsRef<str>, U: AsRef<str>>(obj_id: U, field: T) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::InvalidSwitchPorts,
            obj_id: obj_id.as_ref().into(),
        }
    }

    pub fn new_unused_port<T: AsRef<str>, U: AsRef<str>>(
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

    pub fn new_duplicated_group<T: AsRef<str>, U: AsRef<str>>(
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

    pub fn new_no_buffer_stop<T: AsRef<str>, U: AsRef<str>>(obj_id: U, field: T) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: true,
            sub_type: InfraErrorType::NoBufferStop,
            obj_id: obj_id.as_ref().into(),
        }
    }

    pub fn new_path_is_not_continuous<T: AsRef<str>, U: AsRef<str>>(obj_id: U, field: T) -> Self {
        Self {
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::PathIsNotContinuous,
            obj_id: obj_id.as_ref().into(),
        }
    }

    pub fn new_overlapping_switches<U: AsRef<str>>(obj_id: U, reference: ObjectRef) -> Self {
        Self {
            field: Default::default(),
            is_warning: false,
            sub_type: InfraErrorType::OverlappingSwitches { reference },
            obj_id: obj_id.as_ref().into(),
        }
    }

    pub fn new_overlapping_track_links<U: AsRef<str>>(obj_id: U, reference: ObjectRef) -> Self {
        Self {
            field: Default::default(),
            is_warning: true,
            sub_type: InfraErrorType::OverlappingTrackLinks { reference },
            obj_id: obj_id.as_ref().into(),
        }
    }
}

impl PathEndpointField {
    /// Given a path, retrieve track id and position offset of the path endpoint location
    pub fn get_path_location(&self, path: &[DirectionalTrackRange]) -> (String, f64) {
        let track_range = match self {
            PathEndpointField::EntryPoint => path.first().unwrap(),
            PathEndpointField::ExitPoint => path.last().unwrap(),
        };

        let pos = match (self, &track_range.direction) {
            (PathEndpointField::EntryPoint, Direction::StartToStop) => track_range.begin,
            (PathEndpointField::EntryPoint, Direction::StopToStart) => track_range.end,
            (PathEndpointField::ExitPoint, Direction::StartToStop) => track_range.end,
            (PathEndpointField::ExitPoint, Direction::StopToStart) => track_range.begin,
        };

        (track_range.track.obj_id.clone(), pos)
    }

    pub fn get_route_endpoint<'a>(&self, route: &'a Route) -> &'a ObjectRef {
        match self {
            PathEndpointField::EntryPoint => &route.entry_point,
            PathEndpointField::ExitPoint => &route.exit_point,
        }
    }
}

impl fmt::Display for PathEndpointField {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", serde_json::to_string(self).unwrap())
    }
}
