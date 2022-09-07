use super::generate_id;
use super::DirectionalTrackRange;
use super::OSRDObject;
use super::ObjectRef;
use super::ObjectType;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Route {
    #[derivative(Default(value = r#"generate_id("route")"#))]
    pub id: String,
    pub entry_point: ObjectRef,
    pub exit_point: ObjectRef,
    pub release_detectors: Vec<ObjectRef>,
    pub path: Vec<DirectionalTrackRange>,
}

impl OSRDObject for Route {
    fn get_id(&self) -> String {
        self.id.clone()
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::Route
    }
}
