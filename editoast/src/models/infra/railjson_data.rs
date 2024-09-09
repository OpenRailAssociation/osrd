use std::ops::DerefMut;

use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use editoast_models::DbConnection;
use editoast_schemas::primitives::ObjectType;

use super::Infra;
use crate::error::Result;
use crate::models::get_table;

#[derive(QueryableByName, Default)]
pub struct RailJsonData {
    #[diesel(sql_type = Text)]
    pub railjson: String,
}

impl Infra {
    pub async fn get_railjson(
        conn: &mut DbConnection,
        infra_id: i64,
        object_type: &ObjectType,
    ) -> Result<Vec<RailJsonData>> {
        let table_name = get_table(object_type);
        let query = format!("SELECT (x.data)::text AS railjson FROM {table_name} x WHERE x.infra_id = $1 ORDER BY x.obj_id");
        let railjson_data = sql_query(query)
            .bind::<BigInt, _>(infra_id)
            .load::<RailJsonData>(conn.write().await.deref_mut())
            .await?;
        Ok(railjson_data)
    }
}
