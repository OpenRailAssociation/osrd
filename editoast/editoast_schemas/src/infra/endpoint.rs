use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "UPPERCASE")]
pub enum Endpoint {
    Begin,
    End,
}
