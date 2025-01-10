use crate::primitives::NonBlankString;
use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::TrackOffset;
use crate::primitives::Identifier;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

editoast_common::schemas! {
    OperationalPoint,
    OperationalPointPart,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct OperationalPoint {
    #[schema(inline)]
    pub id: Identifier,
    pub parts: Vec<OperationalPointPart>,
    #[serde(default)]
    #[schema(inline)]
    pub extensions: OperationalPointExtensions,
    #[serde(default)]
    pub weight: Option<u8>,
    #[serde(default)]
    pub is_station: bool,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default, PartialEq)]
pub struct OperationalPointPart {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    #[schema(inline)]
    pub track: Identifier,
    pub position: f64,
    #[serde(default)]
    #[schema(inline)]
    pub extensions: OperationalPointPartExtension,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointPartExtension {
    #[schema(inline)]
    pub sncf: Option<OperationalPointPartSncfExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointPartSncfExtension {
    pub kp: String,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointExtensions {
    #[schema(inline)]
    pub sncf: Option<OperationalPointSncfExtension>,
    #[schema(inline)]
    pub identifier: Option<OperationalPointIdentifierExtension>,
}

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointSncfExtension {
    pub ci: i64,
    pub ch: String,
    #[schema(inline)]
    pub ch_short_label: NonBlankString,
    #[schema(inline)]
    pub ch_long_label: NonBlankString,
    pub trigram: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointIdentifierExtension {
    #[schema(inline)]
    pub name: NonBlankString,
    pub uic: i64,
}

impl OSRDTyped for OperationalPoint {
    fn get_type() -> ObjectType {
        ObjectType::OperationalPoint
    }
}

impl OSRDIdentified for OperationalPoint {
    fn get_id(&self) -> &String {
        &self.id
    }
}

impl OperationalPoint {
    pub fn track_offset(&self) -> Vec<TrackOffset> {
        self.parts
            .clone()
            .into_iter()
            .map(|el| TrackOffset {
                track: el.track,
                offset: (el.position * 1000.0) as u64,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use serde_json::from_str;

    use super::OperationalPointExtensions;

    #[test]
    fn test_op_extensions_deserialization() {
        from_str::<OperationalPointExtensions>(r#"{}"#).unwrap();
    }
}
