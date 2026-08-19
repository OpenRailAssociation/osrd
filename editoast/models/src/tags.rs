use sea_orm::DeriveValueType;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(
    Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default, ToSchema, DeriveValueType,
)]
pub struct Tags(Vec<String>);

impl Tags {
    pub fn new(value: Vec<String>) -> Self {
        Self(value)
    }

    pub fn to_vec(&self) -> Vec<String> {
        self.0.clone()
    }
}

impl From<Vec<String>> for Tags {
    fn from(value: Vec<String>) -> Self {
        Self(value)
    }
}

impl From<Tags> for Vec<String> {
    fn from(value: Tags) -> Self {
        value.0
    }
}
