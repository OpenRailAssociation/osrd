use crate::primitives::NonBlankString;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct PowerRestrictionItem {
    #[schema(inline)]
    pub from: NonBlankString,
    #[schema(inline)]
    pub to: NonBlankString,
    pub value: String,
}
