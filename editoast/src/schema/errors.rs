use super::{Direction, DirectionalTrackRange, OSRDObject, ObjectType, Route, Waypoint};
use crate::schema::ObjectRef;
use serde::{Deserialize, Serialize};
use std::fmt;
use strum_macros::EnumIter;
use strum_macros::EnumVariantNames;

#[derive(Serialize, Deserialize, PartialEq, Debug)]
#[serde(deny_unknown_fields)]
pub struct InfraError {
    obj_id: String,
    obj_type: ObjectType,
    field: String,
    is_warning: bool,
    #[serde(flatten)]
    sub_type: InfraErrorType,
}

#[derive(Serialize, Deserialize, PartialEq, Debug, EnumVariantNames)]
#[strum(serialize_all = "snake_case")]
#[serde(tag = "error_type", rename_all = "snake_case", deny_unknown_fields)]
pub enum InfraErrorType {
    InvalidReference {
        reference: ObjectRef,
    },
    OutOfRange {
        position: f64,
        expected_range: [f64; 2],
    },
    EmptyPath,
    PathDoesNotMatchEndpoints {
        expected_track: String,
        expected_position: f64,
        endpoint_field: PathEndpointField,
    },
    UnknownPortName {
        port_name: String,
    },
    InvalidSwitchPorts,
    EmptyObject,
    ObjectOutOfPath {
        position: f64,
        track: String,
    },
    MissingRoute,
    UnusedPort {
        port_name: String,
    },
    DuplicatedGroup {
        original_group_path: String,
    },
    NoBufferStop,
    PathIsNotContinuous,
    OverlappingSwitches {
        reference: ObjectRef,
    },
    OverlappingTrackLinks {
        reference: ObjectRef,
    },
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
    pub fn new_invalid_reference<T: AsRef<str>, O: OSRDObject>(
        obj: &O,
        field: T,
        reference: ObjectRef,
    ) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::InvalidReference { reference },
        }
    }

    pub fn new_out_of_range<T: AsRef<str>, O: OSRDObject>(
        obj: &O,
        field: T,
        position: f64,
        expected_range: [f64; 2],
    ) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::OutOfRange {
                position,
                expected_range,
            },
        }
    }

    pub fn new_empty_path<T: AsRef<str>, O: OSRDObject>(obj: &O, field: T) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::EmptyPath,
        }
    }

    pub fn new_path_does_not_match_endpoints<T: AsRef<str>, O: OSRDObject>(
        obj: &O,
        field: T,
        expected_track: String,
        expected_position: f64,
        endpoint_field: PathEndpointField,
    ) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::PathDoesNotMatchEndpoints {
                expected_track,
                expected_position,
                endpoint_field,
            },
        }
    }

    pub fn new_empty_object<T: AsRef<str>, O: OSRDObject>(obj: &O, field: T) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: true,
            sub_type: InfraErrorType::EmptyObject,
        }
    }

    pub fn new_object_out_of_path<T: AsRef<str>, U: AsRef<str>, O: OSRDObject>(
        obj: &O,
        field: T,
        position: f64,
        track: U,
    ) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::ObjectOutOfPath {
                position,
                track: track.as_ref().into(),
            },
        }
    }

    pub fn new_missing_route<O: OSRDObject>(obj: &O) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: Default::default(),
            is_warning: true,
            sub_type: InfraErrorType::MissingRoute,
        }
    }

    pub fn new_unknown_port_name<T: AsRef<str>, TT: AsRef<str>, O: OSRDObject>(
        obj: &O,
        field: T,
        port_name: TT,
    ) -> Self {
        let port_name = port_name.as_ref().into();
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::UnknownPortName { port_name },
        }
    }

    pub fn new_invalid_switch_ports<T: AsRef<str>, O: OSRDObject>(obj: &O, field: T) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::InvalidSwitchPorts,
        }
    }

    pub fn new_unused_port<T: AsRef<str>, U: AsRef<str>, O: OSRDObject>(
        obj: &O,
        field: T,
        port_name: U,
    ) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: true,
            sub_type: InfraErrorType::UnusedPort {
                port_name: port_name.as_ref().into(),
            },
        }
    }

    pub fn new_duplicated_group<T: AsRef<str>, O: OSRDObject>(
        obj: &O,
        field: T,
        original_group_path: String,
    ) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: true,
            sub_type: InfraErrorType::DuplicatedGroup {
                original_group_path,
            },
        }
    }

    pub fn new_no_buffer_stop<T: AsRef<str>, O: OSRDObject>(obj: &O, field: T) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: true,
            sub_type: InfraErrorType::NoBufferStop,
        }
    }

    pub fn new_path_is_not_continuous<T: AsRef<str>, O: OSRDObject>(obj: &O, field: T) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::PathIsNotContinuous,
        }
    }

    pub fn new_overlapping_switches<O: OSRDObject>(obj: &O, reference: ObjectRef) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: Default::default(),
            is_warning: false,
            sub_type: InfraErrorType::OverlappingSwitches { reference },
        }
    }

    pub fn new_overlapping_track_links<O: OSRDObject>(obj: &O, reference: ObjectRef) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: Default::default(),
            is_warning: true,
            sub_type: InfraErrorType::OverlappingTrackLinks { reference },
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

        (track_range.track.clone().0, pos)
    }

    pub fn get_route_endpoint<'a>(&self, route: &'a Route) -> &'a Waypoint {
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
