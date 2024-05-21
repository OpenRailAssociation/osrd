use diesel::sql_types::Text;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    PowerRestriction,
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PowerRestriction {
    #[diesel(sql_type = Text)]
    pub power_restriction: String,
}
