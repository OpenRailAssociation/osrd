use std::collections::HashMap;

use super::Direction;
use super::OSRDIdentified;

use super::utils::Identifier;
use super::utils::NonBlankString;
use super::OSRDTyped;
use super::ObjectType;
use super::Side;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use derivative::Derivative;
use diesel::sql_types::{Double, Text};

use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Model)]
#[serde(deny_unknown_fields)]
#[model(table = "crate::tables::osrd_infra_signalmodel")]
#[derivative(Default)]
pub struct Signal {
    pub id: Identifier,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub direction: Direction,
    #[derivative(Default(value = "400."))]
    pub sight_distance: f64,
    pub linked_detector: Option<String>,
    pub logical_signals: Option<Vec<LogicalSignal>>,
    #[serde(default)]
    pub extensions: SignalExtensions,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct LogicalSignal {
    pub signaling_system: String,
    pub next_signaling_systems: Vec<String>,
    pub settings: HashMap<NonBlankString, NonBlankString>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SignalExtensions {
    pub sncf: Option<SignalSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
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

impl OSRDTyped for Signal {
    fn get_type() -> ObjectType {
        ObjectType::Signal
    }
}

impl OSRDIdentified for Signal {
    fn get_id(&self) -> &String {
        &self.id
    }
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct SignalCache {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[diesel(sql_type = Text)]
    pub track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[diesel(sql_type = Double)]
    pub position: f64,
}

impl OSRDTyped for SignalCache {
    fn get_type() -> ObjectType {
        ObjectType::Signal
    }
}

impl OSRDIdentified for SignalCache {
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
        Self::new(sig.id.0, sig.track.0, sig.position)
    }
}

#[cfg(test)]
mod test {
    use super::Signal;
    use super::SignalExtensions;
    use crate::infra::tests::test_infra_transaction;
    use serde_json::from_str;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10).map(|_| Signal::default()).collect::<Vec<Signal>>();

            assert!(Signal::persist_batch(&data, infra.id, conn).is_ok());
        });
    }

    #[test]
    fn test_signal_extensions_deserialization() {
        from_str::<SignalExtensions>(r#"{}"#).unwrap();
    }
}
