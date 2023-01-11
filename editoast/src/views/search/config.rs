//! Defines the deserializers for the `search.yml` config file

use std::collections::HashMap;

use serde::Deserialize;

use super::typing::AstType;

#[derive(Deserialize, Clone, PartialEq, Debug)]
pub struct Config {
    #[serde(flatten)]
    pub entries: HashMap<String, SearchEntry>,
}

#[derive(Deserialize, Clone, PartialEq, Debug)]
pub struct SearchEntry {
    pub table: String,
    pub columns: HashMap<String, AstType>,
    pub result: SearchResult,
}

#[derive(Deserialize, Clone, PartialEq, Debug)]
pub struct SearchResult {
    pub joins: Option<String>,
    pub columns: HashMap<String, String>,
}

impl Config {
    pub fn parse() -> Config {
        serde_yaml::from_str(include_str!("../../../search.yml"))
            .expect("Invalid search.yml config file:")
    }
}
