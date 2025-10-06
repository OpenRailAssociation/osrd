use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
/// List of supported signaling systems
/// Note: 'ETCS_LEVEL2' can't be listed, providing 'etcs_brake_params' field is the (only) way to trigger ETCS_LEVEL2 support
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
