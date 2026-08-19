use database::Db;
use serde::Deserialize;
use serde::Serialize;

use crate::infra;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SpeedLimitTags {
    pub tag: String,
}

impl infra::Model {
    pub async fn get_speed_limit_tags(&self, db: Db) -> Result<Vec<SpeedLimitTags>, crate::Error> {
        Ok(sqlx::query_file_as!(
            SpeedLimitTags,
            "src/infra/sql/get_speed_limit_tags.sql",
            self.id
        )
        .fetch_all(db.sqlx())
        .await?)
    }
}
