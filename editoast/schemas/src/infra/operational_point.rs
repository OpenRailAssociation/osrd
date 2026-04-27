use crate::primitives::NonBlankString;
use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::TrackOffset;
use crate::primitives::Identifier;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

#[derive(Debug, Default, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct OperationalPoint {
    #[schema(inline)]
    pub id: Identifier,
    pub parts: Vec<OperationalPointPart>,
    #[serde(default)]
    #[schema(inline)]
    pub extensions: OperationalPointExtensions,
    #[serde(default)]
    pub weight: Option<u8>,
}

#[derive(Debug, Educe, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct OperationalPointPart {
    #[educe(Default = "InvalidRef".into())]
    #[schema(inline)]
    pub track: Identifier,
    /// Offset on the track section, in m
    pub position: f64,
    pub local_track_name: NonBlankString,
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

impl OperationalPointSncfExtension {
    pub fn new(ci: i64, ch: &str, trigram: &str) -> Self {
        Self {
            ci,
            ch: ch.into(),
            ch_short_label: ch.into(),
            ch_long_label: ch.into(),
            trigram: trigram.into(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct OperationalPointIdentifierExtension {
    #[schema(inline)]
    pub name: NonBlankString,
    pub uic: u32,
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
    pub fn track_offsets(&self) -> Vec<TrackOffset> {
        self.track_offsets_by_local_track_name(None)
    }

    pub fn track_offsets_by_local_track_name(
        &self,
        local_track_name: Option<&NonBlankString>,
    ) -> Vec<TrackOffset> {
        self.parts
            .iter()
            .filter(|part| {
                local_track_name
                    .is_none_or(|local_track_name| *local_track_name == part.local_track_name)
            })
            .map(|part| TrackOffset {
                track: part.track.clone(),
                offset: (part.position * 1000.0).round() as u64,
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
