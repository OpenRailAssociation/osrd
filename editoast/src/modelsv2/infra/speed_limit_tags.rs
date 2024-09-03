use std::ops::DerefMut;

use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use editoast_models::DbConnection;
use serde::Deserialize;
use serde::Serialize;

use super::Infra;
use crate::error::Result;

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
pub struct SpeedLimitTags {
    #[diesel(sql_type = Text)]
    pub tag: String,
}

impl Infra {
    pub async fn get_speed_limit_tags(&self, conn: &DbConnection) -> Result<Vec<SpeedLimitTags>> {
        let query = include_str!("sql/get_speed_limit_tags.sql");
        let speed_limits_tags = sql_query(query)
            .bind::<BigInt, _>(self.id)
            .load::<SpeedLimitTags>(conn.write().await.deref_mut())
            .await?;
        Ok(speed_limits_tags)
    }
}
