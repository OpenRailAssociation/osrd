use super::{OSRDIdentified, OSRDObject, ObjectType};
use crate::schema::ObjectRef;
use serde::{Deserialize, Serialize};
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
    DuplicatedGroup {
        original_group_path: String,
    },
    EmptyObject,
    InvalidGroup {
        group: String,
        switch_type: String,
    },
    InvalidReference {
        reference: ObjectRef,
    },
    InvalidRoute,
    InvalidSwitchPorts,
    MissingRoute,
    NoBufferStop,
    ObjectOutOfPath {
        reference: ObjectRef,
    },
    OutOfRange {
        position: f64,
        expected_range: [f64; 2],
    },
    OverlappingSwitches {
        reference: ObjectRef,
    },
    OverlappingTrackLinks {
        reference: ObjectRef,
    },
    UnknownPortName {
        port_name: String,
    },
    UnusedPort {
        port_name: String,
    },
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

    pub fn new_invalid_path<O: OSRDObject>(obj: &O) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: "".into(), // This error concern the whole object consistency
            is_warning: false,
            sub_type: InfraErrorType::InvalidRoute,
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

    pub fn new_object_out_of_path<T: AsRef<str>, O: OSRDObject>(
        route: &O,
        field: T,
        reference: ObjectRef,
    ) -> Self {
        Self {
            obj_id: route.get_id().clone(),
            obj_type: route.get_type(),
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::ObjectOutOfPath { reference },
        }
    }

    pub fn new_missing_route<T: AsRef<str>>(track_id: &T) -> Self {
        Self {
            obj_id: track_id.as_ref().into(),
            obj_type: ObjectType::TrackSection,
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

    pub fn new_invalid_group<T: AsRef<str>, TT: AsRef<str>, TTT: AsRef<str>, O: OSRDObject>(
        obj: &O,
        field: T,
        group: TT,
        switch_type: TTT,
    ) -> Self {
        Self {
            obj_id: obj.get_id().clone(),
            obj_type: obj.get_type(),
            field: field.as_ref().into(),
            is_warning: false,
            sub_type: InfraErrorType::InvalidGroup {
                group: group.as_ref().into(),
                switch_type: switch_type.as_ref().into(),
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

    pub fn new_overlapping_switches<O: OSRDObject, T: AsRef<str>>(obj: &O, other: T) -> Self {
        let reference = ObjectRef::new(ObjectType::Switch, other);
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

impl OSRDIdentified for InfraError {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl OSRDObject for InfraError {
    fn get_type(&self) -> ObjectType {
        self.obj_type
    }
}
