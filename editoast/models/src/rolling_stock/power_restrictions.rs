use database::Db;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::rolling_stock;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, sqlx::FromRow)]
pub struct PowerRestriction {
    pub power_restriction: String,
}

impl rolling_stock::Model {
    pub async fn get_power_restrictions(db: Db) -> Result<Vec<PowerRestriction>, crate::Error> {
        Ok(sqlx::query_file_as!(
            PowerRestriction,
            "src/rolling_stock/sql/get_power_restrictions.sql"
        )
        .fetch_all(db.sqlx())
        .await?)
    }
}
