use std::collections::HashMap;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;

use super::generate_id;
use super::OSRDObject;
use super::ObjectType;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SwitchType {
    #[derivative(Default(value = r#"generate_id("switchtype")"#))]
    pub id: String,
    pub ports: Vec<String>,
    pub groups: HashMap<String, Vec<SwitchPortConnection>>,
}

impl OSRDObject for SwitchType {
    fn get_id(&self) -> &String {
        &self.id
    }

    fn get_type(&self) -> ObjectType {
        ObjectType::SwitchType
    }
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct SwitchPortConnection {
    pub src: String,
    pub dst: String,
}

impl Cache for SwitchType {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::SwitchType(self.clone())
    }
}
