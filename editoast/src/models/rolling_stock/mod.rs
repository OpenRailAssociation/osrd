pub mod light_rolling_stock;
pub mod rolling_stock_image;
pub mod rolling_stock_livery;

pub use light_rolling_stock::LightRollingStockModel;
pub use rolling_stock_livery::RollingStockLiveryModel;

use crate::error::Result;
use crate::models::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata;
use crate::models::Identifiable;
use crate::schema::rolling_stock::{
    EffortCurves, Gamma, RollingResistance, RollingStock, RollingStockMetadata,
    RollingStockWithLiveries,
};
use crate::tables::osrd_infra_rollingstock;
use crate::DbPool;
use actix_web::web::{block, Data};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::ExpressionMethods;
use diesel::SelectableHelper;
use diesel::{QueryDsl, RunQueryDsl};
use diesel_json::Json as DieselJson;
use editoast_derive::Model;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Derivative, Deserialize, Identifiable, Insertable, Model, Queryable, Serialize)]
#[derivative(Default)]
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
    #[diesel(deserialize_as = DieselJson<EffortCurves>)]
    pub effort_curves: Option<DieselJson<EffortCurves>>,
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

impl Identifiable for RollingStockModel {
    fn get_id(&self) -> i64 {
        self.id.expect("Id not found")
    }
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
            effort_curves: rolling_stock_model.effort_curves.unwrap().0,
            base_power_class: rolling_stock_model.base_power_class.unwrap(),
            length: rolling_stock_model.length.unwrap(),
            max_speed: rolling_stock_model.max_speed.unwrap(),
            startup_time: rolling_stock_model.startup_time.unwrap(),
            startup_acceleration: rolling_stock_model.startup_acceleration.unwrap(),
            comfort_acceleration: rolling_stock_model.comfort_acceleration.unwrap(),
            gamma: rolling_stock_model.gamma.unwrap().0,
            inertia_coefficient: rolling_stock_model.inertia_coefficient.unwrap(),
            features: rolling_stock_model.features.unwrap(),
            mass: rolling_stock_model.mass.unwrap(),
            rolling_resistance: rolling_stock_model.rolling_resistance.unwrap().0,
            loading_gauge: rolling_stock_model.loading_gauge.unwrap(),
            metadata: rolling_stock_model.metadata.unwrap().0,
            power_restrictions: rolling_stock_model.power_restrictions.unwrap(),
        }
    }
}

#[cfg(test)]
pub mod tests {
    use crate::{
        fixtures::tests::{db_pool, fast_rolling_stock, TestFixture},
        models::Retrieve,
    };
    use rstest::*;

    use super::RollingStockModel;
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};

    #[rstest]
    async fn create_delete_rolling_stock(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
    ) {
        let rolling_stock_id: i64;
        {
            let rolling_stock = fast_rolling_stock.await;
            rolling_stock_id = rolling_stock.id();
            assert_eq!(
                "fast_rolling_stock",
                rolling_stock.model.name.clone().unwrap()
            );
        }
        assert!(RollingStockModel::retrieve(db_pool, rolling_stock_id)
            .await
            .unwrap()
            .is_none());
    }
}
