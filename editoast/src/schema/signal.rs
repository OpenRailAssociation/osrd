use std::collections::HashMap;

use derivative::Derivative;
use diesel::sql_types::Double;
use diesel::sql_types::Jsonb;
use diesel::sql_types::Text;
use diesel_json::Json as DieselJson;
use serde::Deserialize;
use serde::Serialize;

use super::Direction;
use super::OSRDIdentified;
use super::OSRDTyped;
use super::ObjectType;
use super::Side;
use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use editoast_common::Identifier;
use editoast_common::NonBlankString;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
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
    #[serde(default)]
    pub logical_signals: Vec<LogicalSignal>,
    #[serde(default)]
    pub extensions: SignalExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct LogicalSignal {
    pub signaling_system: String,
    pub next_signaling_systems: Vec<String>,
    pub settings: HashMap<NonBlankString, NonBlankString>,
    pub default_parameters: HashMap<NonBlankString, NonBlankString>,
    pub conditional_parameters: Vec<ConditionalParameters>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct ConditionalParameters {
    pub on_route: NonBlankString,
    pub parameters: HashMap<NonBlankString, NonBlankString>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SignalExtensions {
    pub sncf: Option<SignalSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct SignalSncfExtension {
    pub label: String,
    pub side: Side,
    pub kp: String,
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
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[diesel(sql_type = Jsonb)]
    pub logical_signals: DieselJson<Vec<LogicalSignal>>,
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
    pub fn new(
        obj_id: String,
        track: String,
        position: f64,
        logical_signals: Vec<LogicalSignal>,
    ) -> Self {
        Self {
            obj_id,
            track,
            position,
            logical_signals: DieselJson(logical_signals),
        }
    }
}

impl From<Signal> for SignalCache {
    fn from(sig: Signal) -> Self {
        Self::new(sig.id.0, sig.track.0, sig.position, sig.logical_signals)
    }
}

#[cfg(test)]
mod test {
    use serde_json::from_str;

    use super::SignalExtensions;

    #[test]
    fn test_signal_extensions_deserialization() {
        from_str::<SignalExtensions>(r#"{}"#).unwrap();
    }
}
