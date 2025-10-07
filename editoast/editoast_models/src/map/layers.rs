use std::collections::HashMap;

use serde::Deserialize;

// select C.stuff from A inner join B C on C.id = C.id;
//                       \___________________________/
//                             a join expression
//                            C is an alias for B
type JoinExpr = String;

/// Layer view description
#[derive(Debug, Deserialize)]
pub struct View {
    pub on_field: String,
    pub data_expr: String,
    #[serde(default)]
    pub exclude_fields: Vec<String>,
    #[serde(default)]
    pub joins: Vec<JoinExpr>,
    #[serde(rename = "where", default)]
    pub where_expr: Vec<String>,
}

/// Layer description
#[derive(Debug, Deserialize)]
pub struct Layer {
    pub table_name: String,
    pub views: HashMap<String, View>,
    #[serde(default)]
    pub id_field: Option<String>,
    #[serde(default)]
    pub attribution: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MapLayers {
    pub layers: HashMap<String, Layer>,
}

impl MapLayers {
    pub fn new(layers: HashMap<String, Layer>) -> Self {
        Self { layers }
    }
}

impl Default for MapLayers {
    fn default() -> Self {
        serde_yaml::from_str(include_str!("../../../map_layers.yml"))
            .expect("static data should be valid")
    }
}
