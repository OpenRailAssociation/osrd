use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::layer::Layer;

use super::generate_id;
use super::Direction;
use super::OSRDObject;
use super::ObjectRef;
use super::ObjectType;
use derivative::Derivative;
use diesel::sql_types::{Double, Text};
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
    pub extensions: SignalExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SignalExtensions {
    pub sncf: Option<SignalSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SignalSncfExtension {
    pub angle_geo: f64,
    pub angle_sch: f64,
    pub aspects: Vec<String>,
    pub comment: String,
    pub default_aspect: String,
    pub installation_type: String,
    pub is_in_service: bool,
    pub is_lightable: bool,
    pub is_operational: bool,
    pub label: String,
    pub side: Side,
    pub support_type: String,
    pub type_code: String,
    pub value: String,
}

impl OSRDObject for Signal {
    fn get_type(&self) -> ObjectType {
        ObjectType::Signal
    }

    fn get_id(&self) -> &String {
        &self.id
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

impl Layer for Signal {
    fn get_table_name() -> &'static str {
        "osrd_infra_signallayer"
    }

    fn generate_layer_query() -> &'static str {
        include_str!("../layer/sql/generate_signal_layer.sql")
    }

    fn insert_update_layer_query() -> &'static str {
        include_str!("../layer/sql/insert_update_signal_layer.sql")
    }

    fn layer_name() -> &'static str {
        "signals"
    }

    fn get_obj_type() -> ObjectType {
        ObjectType::Signal
    }
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct SignalCache {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Text"]
    pub track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Double"]
    pub position: f64,
}

impl OSRDObject for SignalCache {
    fn get_type(&self) -> ObjectType {
        ObjectType::Signal
    }

    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for SignalCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![&self.track]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Signal(self.clone())
    }
}

impl SignalCache {
    pub fn new(obj_id: String, track: String, position: f64) -> Self {
        Self {
            obj_id,
            track,
            position,
        }
    }
}

impl From<Signal> for SignalCache {
    fn from(sig: Signal) -> Self {
        Self::new(sig.id, sig.track.obj_id, sig.position)
    }
}


#[cfg(test)]
mod test {
    use serde_json::from_str;
    use super::SignalExtensions;

    #[test]
    fn test_signal_extensions_deserialization() {
        from_str::<SignalExtensions >(r#"{}"#).unwrap();
    }
}