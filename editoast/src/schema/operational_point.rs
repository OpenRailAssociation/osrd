use super::OSRDIdentified;

use super::utils::Identifier;
use super::utils::NonBlankString;
use super::OSRDTyped;
use super::ObjectType;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::modelsv2::OperationalPointModel;
use crate::schema::TrackOffset;
use derivative::Derivative;
use utoipa::ToSchema;

use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct OperationalPoint {
    #[schema(inline)]
    pub id: Identifier,
    pub parts: Vec<OperationalPointPart>,
    #[serde(default)]
    pub extensions: OperationalPointExtensions,
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
    pub fn track_offset(op: &OperationalPointModel) -> Vec<TrackOffset> {
        op.parts
            .clone()
            .into_iter()
            .map(|el| TrackOffset {
                track: el.track,
                offset: (el.position * 1000.0) as u64,
            })
            .collect()
    }
}

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct OperationalPointCache {
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub parts: Vec<OperationalPointPartCache>,
}

impl OperationalPointCache {
    pub fn new(obj_id: String, parts: Vec<OperationalPointPartCache>) -> Self {
        Self { obj_id, parts }
    }
}

impl From<OperationalPoint> for OperationalPointCache {
    fn from(op: OperationalPoint) -> Self {
        let parts = op.parts.into_iter().map(|p| p.into()).collect();
        Self::new(op.id.0, parts)
    }
}

impl OSRDTyped for OperationalPointCache {
    fn get_type() -> ObjectType {
        ObjectType::OperationalPoint
    }
}

impl OSRDIdentified for OperationalPointCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl Cache for OperationalPointCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.parts.iter().map(|tr| &*tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::OperationalPoint(self.clone())
    }
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default, PartialEq)]
pub struct OperationalPointPartCache {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub track: Identifier,
    pub position: f64,
}

impl From<OperationalPointPart> for OperationalPointPartCache {
    fn from(op: OperationalPointPart) -> Self {
        Self {
            track: op.track,
            position: op.position,
        }
    }
}

#[cfg(test)]
mod test {
    use super::OperationalPointExtensions;
    use serde_json::from_str;

    #[test]
    fn test_op_extensions_deserialization() {
        from_str::<OperationalPointExtensions>(r#"{}"#).unwrap();
    }
}
