use std::collections::HashMap;

use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::Direction;
use super::Side;
use crate::primitives::Identifier;
use crate::primitives::NonBlankString;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

editoast_common::schemas! {
    Signal,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Signal {
    #[schema(inline)]
    pub id: Identifier,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    #[schema(inline)]
    pub track: Identifier,
    pub position: f64,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub direction: Direction,
    #[derivative(Default(value = "400."))]
    pub sight_distance: f64,
    #[serde(default)]
    #[schema(inline)]
    pub logical_signals: Vec<LogicalSignal>,
    #[serde(default)]
    #[schema(inline)]
    pub extensions: SignalExtensions,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
pub struct LogicalSignal {
    pub signaling_system: String,
    pub next_signaling_systems: Vec<String>,
    #[schema(inline)]
    pub settings: HashMap<NonBlankString, NonBlankString>,
    #[schema(inline)]
    pub default_parameters: HashMap<NonBlankString, NonBlankString>,
    #[schema(inline)]
    pub conditional_parameters: Vec<ConditionalParameters>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
pub struct ConditionalParameters {
    #[schema(inline)]
    pub on_route: NonBlankString,
    #[schema(inline)]
    pub parameters: HashMap<NonBlankString, NonBlankString>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SignalExtensions {
    #[schema(inline)]
    pub sncf: Option<SignalSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SignalSncfExtension {
    pub label: String,
    #[serde(default)]
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

#[cfg(test)]
mod test {
    use serde_json::from_str;

    use super::SignalExtensions;

    #[test]
    fn test_signal_extensions_deserialization() {
        from_str::<SignalExtensions>(r#"{}"#).unwrap();
    }
}
