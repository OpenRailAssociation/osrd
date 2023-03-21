//! Defines the deserializers for the `search.yml` config file

use std::collections::HashMap;

use serde::Deserialize;

use super::typing::{AstType, TypeSpec};

#[derive(Deserialize, Clone, PartialEq, Debug)]
pub struct Config {
    #[serde(flatten)]
    pub entries: HashMap<String, SearchEntry>,
}

#[derive(Deserialize, Clone, PartialEq, Debug)]
pub struct SearchEntry {
    pub table: String,
    pub columns: HashMap<String, TypeDescriptor>,
    pub result: SearchResult,
}

#[derive(Deserialize, Clone, PartialEq, Debug)]
pub struct SearchResult {
    pub joins: Option<String>,
    pub columns: HashMap<String, String>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(untagged)]
pub enum TypeDescriptor {
    Atomic(AstType),
    Compound(CompoundTypeDescriptor),
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum CompoundTypeDescriptor {
    Array { item: Box<TypeDescriptor> },
}

impl Config {
    pub fn parse() -> Config {
        serde_yaml::from_str(include_str!("../../../search.yml"))
            .expect("Invalid search.yml config file:")
    }
}

impl From<TypeDescriptor> for TypeSpec {
    fn from(value: TypeDescriptor) -> Self {
        match value {
            TypeDescriptor::Atomic(t) => t.into(),
            TypeDescriptor::Compound(CompoundTypeDescriptor::Array { item }) => {
                TypeSpec::Sequence(Box::new((*item).into()))
            }
        }
    }
}
