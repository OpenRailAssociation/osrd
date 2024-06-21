use diesel::sql_query;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::RollingStockModel;
use crate::error::Result;
use editoast_models::DbConnection;

editoast_common::schemas! {
    PowerRestriction,
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PowerRestriction {
    #[diesel(sql_type = Text)]
    pub power_restriction: String,
}

impl RollingStockModel {
    pub async fn get_power_restrictions(conn: &mut DbConnection) -> Result<Vec<PowerRestriction>> {
        let power_restrictions = sql_query(include_str!("sql/get_power_restrictions.sql"))
            .load::<PowerRestriction>(conn)
            .await?;
        Ok(power_restrictions)
    }
}
