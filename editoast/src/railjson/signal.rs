use super::generate_id;
use super::Direction;
use super::OSRDObject;
use super::ObjectRef;
use super::ObjectType;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Signal {
    #[derivative(Default(value = r#"generate_id("signal")"#))]
    pub id: String,
    pub track: ObjectRef,
    #[derivative(Default(value = "0."))]
    pub position: f64,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub direction: Direction,
    #[derivative(Default(value = "400."))]
    pub sight_distance: f64,
    pub linked_detector: Option<ObjectRef>,
    pub aspects: Option<Vec<String>>,
    pub angle_sch: f64,
    pub angle_geo: f64,
    pub type_code: Option<String>,
    pub support_type: Option<String>,
    pub is_in_service: Option<bool>,
    pub is_lightable: Option<bool>,
    pub is_operational: Option<bool>,
    pub comment: Option<String>,
    pub physical_organization_group: Option<String>,
    pub responsible_group: Option<String>,
    pub label: Option<String>,
    pub installation_type: Option<String>,
    pub value: Option<String>,
    pub side: Side,
    pub default_aspect: String,
}

impl OSRDObject for Signal {
    fn get_type(&self) -> ObjectType {
        ObjectType::Signal
    }

    fn get_id(&self) -> String {
        self.id.clone()
    }
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[derivative(Default)]
pub enum Side {
    #[serde(rename = "LEFT")]
    Left,
    #[serde(rename = "RIGHT")]
    Right,
    #[serde(rename = "CENTER")]
    #[derivative(Default)]
    Center,
}
