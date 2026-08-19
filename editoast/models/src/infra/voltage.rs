use database::Db;
use serde::Deserialize;
use serde::Serialize;

use crate::infra;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Voltage {
    pub voltage: String,
}

impl infra::Model {
    pub async fn get_voltages(
        &self,
        db: Db,
        include_rolling_stock_modes: bool,
    ) -> Result<Vec<Voltage>, crate::Error> {
        if include_rolling_stock_modes {
            Ok(sqlx::query_file_as!(
                Voltage,
                "src/infra/sql/get_voltages_with_rolling_stocks_modes.sql",
                self.id
            )
            .fetch_all(db.sqlx())
            .await?)
        } else {
            Ok(sqlx::query_file_as!(
                Voltage,
                "src/infra/sql/get_voltages_without_rolling_stocks_modes.sql",
                self.id
            )
            .fetch_all(db.sqlx())
            .await?)
        }
    }

    pub async fn get_all_voltages(db: Db) -> Result<Vec<Voltage>, crate::Error> {
        Ok(
            sqlx::query_file_as!(Voltage, "src/infra/sql/get_all_voltages_and_modes.sql")
                .fetch_all(db.sqlx())
                .await?,
        )
    }
}
