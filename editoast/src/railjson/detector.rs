use super::generate_id;
use super::ApplicableDirections;
use super::OSRDObject;
use super::ObjectRef;
use super::ObjectType;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Detector {
    #[derivative(Default(value = r#"generate_id("detector")"#))]
    pub id: String,
    pub track: ObjectRef,
    #[derivative(Default(value = "0."))]
    pub position: f64,
    pub applicable_directions: ApplicableDirections,
}

impl OSRDObject for Detector {
    fn get_type(&self) -> ObjectType {
        ObjectType::Detector
    }

    fn get_id(&self) -> String {
        self.id.clone()
    }
}
