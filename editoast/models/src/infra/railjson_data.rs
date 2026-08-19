use database::Db;
use schemas::primitives::ObjectType;

use crate::infra;
use crate::infra_objects::get_table;

#[derive(Default, sqlx::FromRow)]
pub struct RailJsonData {
    pub railjson: String,
}

impl infra::Model {
    pub async fn get_railjson(
        db: Db,
        infra_id: i64,
        object_type: &ObjectType,
    ) -> Result<Vec<RailJsonData>, crate::Error> {
        let table_name = get_table(object_type);
        let query = format!(
            "SELECT (x.data)::text AS railjson FROM {table_name} x WHERE x.infra_id = $1 ORDER BY x.obj_id"
        );
        Ok(sqlx::query_as(sqlx::AssertSqlSafe(query))
            .bind(infra_id)
            .fetch_all(db.sqlx())
            .await?)
    }
}
