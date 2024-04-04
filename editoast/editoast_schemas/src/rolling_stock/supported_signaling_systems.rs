use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct RollingStockSupportedSignalingSystems(pub Vec<String>);

impl From<Vec<Option<String>>> for RollingStockSupportedSignalingSystems {
    fn from(features: Vec<Option<String>>) -> Self {
        Self(features.into_iter().flatten().collect())
    }
}
impl From<RollingStockSupportedSignalingSystems> for Vec<Option<String>> {
    fn from(features: RollingStockSupportedSignalingSystems) -> Self {
        features.0.into_iter().map(Some).collect()
    }
}
