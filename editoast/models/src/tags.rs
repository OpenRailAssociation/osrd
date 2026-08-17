use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default, ToSchema)]
pub struct Tags(Vec<String>);

impl Tags {
    pub fn new(value: Vec<String>) -> Self {
        Self(value)
    }

    pub fn to_vec(&self) -> Vec<String> {
        self.0.clone()
    }
}

impl From<Vec<Option<String>>> for Tags {
    fn from(value: Vec<Option<String>>) -> Self {
        Self(value.into_iter().flatten().collect())
    }
}

impl From<Tags> for Vec<Option<String>> {
    fn from(value: Tags) -> Self {
        value.0.into_iter().map(Some).collect()
    }
}
