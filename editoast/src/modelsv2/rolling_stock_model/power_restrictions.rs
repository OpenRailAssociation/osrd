use std::ops::DerefMut;

use diesel::sql_query;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use editoast_models::DbConnection;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::RollingStockModel;
use crate::error::Result;

editoast_common::schemas! {
    PowerRestriction,
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PowerRestriction {
    #[diesel(sql_type = Text)]
    pub power_restriction: String,
}

impl RollingStockModel {
    pub async fn get_power_restrictions(conn: &DbConnection) -> Result<Vec<PowerRestriction>> {
        let power_restrictions = sql_query(include_str!("sql/get_power_restrictions.sql"))
            .load::<PowerRestriction>(conn.write().await.deref_mut())
            .await?;
        Ok(power_restrictions)
    }
}
