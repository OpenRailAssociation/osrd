use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;

use super::Infra;
use crate::error::Result;
use editoast_models::DbConnection;

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
pub struct Voltage {
    #[diesel(sql_type = Text)]
    pub voltage: String,
}

impl Infra {
    pub async fn get_voltages(
        &self,
        conn: &mut DbConnection,
        include_rolling_stock_modes: bool,
    ) -> Result<Vec<Voltage>> {
        let query = if !include_rolling_stock_modes {
            include_str!("sql/get_voltages_without_rolling_stocks_modes.sql")
        } else {
            include_str!("sql/get_voltages_with_rolling_stocks_modes.sql")
        };
        let voltages = sql_query(query)
            .bind::<BigInt, _>(self.id)
            .load::<Voltage>(conn)
            .await?;
        Ok(voltages)
    }

    pub async fn get_all_voltages(conn: &mut DbConnection) -> Result<Vec<Voltage>> {
        let query = include_str!("sql/get_all_voltages_and_modes.sql");
        let voltages = sql_query(query).load::<Voltage>(conn).await?;
        Ok(voltages)
    }
}
