use editoast_common::NonBlankString;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    PowerRestrictionItem,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct PowerRestrictionItem {
    #[schema(inline)]
    pub from: NonBlankString,
    #[schema(inline)]
    pub to: NonBlankString,
    pub value: String,
}
