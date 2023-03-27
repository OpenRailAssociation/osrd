use crate::error::Result;
use crate::schema::rolling_stock::{
    Gamma, RollingResistance, RollingStock, RollingStockMetadata, RollingStockWithLiveries,
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
pub struct RollingStockModel {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
    #[diesel(deserialize_as = String)]
    pub version: Option<String>,
    #[diesel(deserialize_as = JsonValue)]
    pub effort_curves: Option<JsonValue>,
    #[diesel(deserialize_as = String)]
    pub base_power_class: Option<String>,
    #[diesel(deserialize_as = f64)]
    pub length: Option<f64>,
    #[diesel(deserialize_as = f64)]
    pub max_speed: Option<f64>,
    #[diesel(deserialize_as = f64)]
    pub startup_time: Option<f64>,
    #[diesel(deserialize_as = f64)]
    pub startup_acceleration: Option<f64>,
    #[diesel(deserialize_as = f64)]
    pub comfort_acceleration: Option<f64>,
    #[diesel(deserialize_as = DieselJson<Gamma>)]
    pub gamma: Option<DieselJson<Gamma>>,
    #[diesel(deserialize_as = f64)]
    pub inertia_coefficient: Option<f64>,
    #[diesel(deserialize_as = Vec<String>)]
    pub features: Option<Vec<String>>,
    #[diesel(deserialize_as = f64)]
    pub mass: Option<f64>,
    #[diesel(deserialize_as = DieselJson<RollingResistance>)]
    pub rolling_resistance: Option<DieselJson<RollingResistance>>,
    #[diesel(deserialize_as = String)]
    pub loading_gauge: Option<String>,
    #[diesel(deserialize_as = DieselJson<RollingStockMetadata>)]
    pub metadata: Option<DieselJson<RollingStockMetadata>>,
    #[diesel(deserialize_as = Option<JsonValue>)]
    pub power_restrictions: Option<Option<JsonValue>>,
}

impl RollingStockModel {
    pub async fn with_liveries(self, db_pool: Data<DbPool>) -> Result<RollingStockWithLiveries> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_rollingstocklivery::dsl as livery_dsl;
            let mut conn = db_pool.get()?;
            let liveries = livery_dsl::osrd_infra_rollingstocklivery
                .filter(livery_dsl::rolling_stock_id.eq(self.id.unwrap()))
                .select(RollingStockLiveryMetadata::as_select())
                .load(&mut conn)?;
            Ok(RollingStockWithLiveries {
                rolling_stock: self.into(),
                liveries,
            })
        })
        .await
        .unwrap()
    }
}

impl From<RollingStockModel> for RollingStock {
    fn from(rolling_stock_model: RollingStockModel) -> Self {
        RollingStock {
            id: rolling_stock_model.id.unwrap(),
            name: rolling_stock_model.name.unwrap(),
            version: rolling_stock_model.version.unwrap(),
            effort_curves: rolling_stock_model.effort_curves.unwrap(),
            base_power_class: rolling_stock_model.base_power_class.unwrap(),
            length: rolling_stock_model.length.unwrap(),
            max_speed: rolling_stock_model.max_speed.unwrap(),
            startup_time: rolling_stock_model.startup_time.unwrap(),
            startup_acceleration: rolling_stock_model.startup_acceleration.unwrap(),
            comfort_acceleration: rolling_stock_model.comfort_acceleration.unwrap(),
            gamma: rolling_stock_model.gamma.unwrap(),
            inertia_coefficient: rolling_stock_model.inertia_coefficient.unwrap(),
            features: rolling_stock_model.features.unwrap(),
            mass: rolling_stock_model.mass.unwrap(),
            rolling_resistance: rolling_stock_model.rolling_resistance.unwrap(),
            loading_gauge: rolling_stock_model.loading_gauge.unwrap(),
            metadata: rolling_stock_model.metadata.unwrap(),
            power_restrictions: rolling_stock_model.power_restrictions.unwrap(),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::client::PostgresConfig;
    use crate::models::{Create, Delete, Retrieve};
    use crate::schema::rolling_stock::RollingStock;
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;

    use super::RollingStockModel;

    #[actix_test]
    async fn create_get_delete_rolling_stock() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let rolling_stock: RollingStockModel =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");

        // create a rolling stock
        let rolling_stock: RollingStock =
            rolling_stock.create(db_pool.clone()).await.unwrap().into();
        let rolling_stock_id = rolling_stock.id;

        // get a rolling stock
        assert!(
            RollingStockModel::retrieve(db_pool.clone(), rolling_stock_id)
                .await
                .unwrap()
                .is_some()
        );

        // delete a rolling stock
        assert!(RollingStockModel::delete(db_pool.clone(), rolling_stock_id)
            .await
            .unwrap());
    }
}
