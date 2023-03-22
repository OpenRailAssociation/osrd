use crate::error::Result;
use crate::schema::rolling_stock::{
    Gamma, RollingResistance, RollingStockMetadata, RollingStockWithLiveries,
};
use crate::schema::rolling_stock_livery::RollingStockLiveryMetadata;
use crate::tables::osrd_infra_rollingstock;
use crate::DbPool;
use actix_web::web::{block, Data};
use diesel::result::Error as DieselError;
use diesel::ExpressionMethods;
use diesel::SelectableHelper;
use diesel::{QueryDsl, RunQueryDsl};
use diesel_json::Json as DieselJson;
use editoast_derive::Model;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Deserialize, Identifiable, Insertable, Model, Queryable, Serialize)]
#[model(table = "osrd_infra_rollingstock")]
#[model(create, retrieve, delete)]
#[diesel(table_name = osrd_infra_rollingstock)]
pub struct RollingStock {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    pub name: String,
    version: String,
    effort_curves: JsonValue,
    base_power_class: String,
    length: f64,
    max_speed: f64,
    startup_time: f64,
    startup_acceleration: f64,
    comfort_acceleration: f64,
    gamma: DieselJson<Gamma>,
    inertia_coefficient: f64,
    features: Vec<String>,
    mass: f64,
    rolling_resistance: DieselJson<RollingResistance>,
    loading_gauge: String,
    metadata: DieselJson<RollingStockMetadata>,
    power_restrictions: Option<JsonValue>,
}

impl RollingStock {
    pub async fn with_liveries(self, db_pool: Data<DbPool>) -> Result<RollingStockWithLiveries> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_rollingstocklivery::dsl as livery_dsl;
            let mut conn = db_pool.get()?;
            let liveries = livery_dsl::osrd_infra_rollingstocklivery
                .filter(livery_dsl::rolling_stock_id.eq(self.id.unwrap()))
                .select(RollingStockLiveryMetadata::as_select())
                .load(&mut conn)?;
            Ok(RollingStockWithLiveries {
                rolling_stock: self,
                liveries,
            })
        })
        .await
        .unwrap()
    }
}

#[cfg(test)]
mod tests {
    use crate::client::PostgresConfig;
    use crate::models::{Create, Delete, Retrieve};
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;

    use super::RollingStock;

    #[actix_test]
    async fn create_get_delete_rolling_stock() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let rolling_stock: RollingStock =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");

        // create a rolling stock
        let rolling_stock = rolling_stock.create(db_pool.clone()).await.unwrap();
        let rolling_stock_id = rolling_stock.id.unwrap();

        // get a rolling stock
        assert!(RollingStock::retrieve(db_pool.clone(), rolling_stock_id)
            .await
            .unwrap()
            .is_some());

        // delete a rolling stock
        assert!(RollingStock::delete(db_pool.clone(), rolling_stock_id)
            .await
            .unwrap());
    }
}
