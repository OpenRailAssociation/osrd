use crate::error::Result;
use crate::models::{Create, Retrieve, RollingStockModel};
use crate::schema::rolling_stock::{
    EffortCurves, Gamma, RollingResistance, RollingStock, RollingStockMetadata,
    RollingStockWithLiveries,
};
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, Data, Json, Path};
use actix_web::{get, post};
use diesel_json::Json as DieselJson;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use thiserror::Error;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "rollingstocks")]
pub enum RollingStockError {
    #[error("Rolling stock '{rolling_stock_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { rolling_stock_id: i64 },
}

pub fn routes() -> impl HttpServiceFactory {
    web::scope("/rolling_stock").service((get, create))
}

#[get("/{rolling_stock_id}")]
async fn get(db_pool: Data<DbPool>, path: Path<i64>) -> Result<Json<RollingStockWithLiveries>> {
    let rolling_stock_id = path.into_inner();
    let rolling_stock = match RollingStockModel::retrieve(db_pool.clone(), rolling_stock_id).await?
    {
        Some(rolling_stock) => rolling_stock,
        None => return Err(RollingStockError::NotFound { rolling_stock_id }.into()),
    };
    let rollig_stock_with_liveries = rolling_stock.with_liveries(db_pool).await?;
    Ok(Json(rollig_stock_with_liveries))
}

#[derive(Serialize, Deserialize)]
struct RollingStockCreateForm {
    pub name: String,
    pub version: String,
    pub effort_curves: EffortCurves,
    pub base_power_class: String,
    pub length: f64,
    pub max_speed: f64,
    pub startup_time: f64,
    pub startup_acceleration: f64,
    pub comfort_acceleration: f64,
    pub gamma: Gamma,
    pub inertia_coefficient: f64,
    pub features: Vec<String>,
    pub mass: f64,
    pub rolling_resistance: RollingResistance,
    pub loading_gauge: String,
    pub metadata: RollingStockMetadata,
    pub power_restrictions: Option<JsonValue>,
}

impl From<RollingStockCreateForm> for RollingStockModel {
    fn from(rolling_stock: RollingStockCreateForm) -> Self {
        RollingStockModel {
            name: Some(rolling_stock.name),
            version: Some(rolling_stock.version),
            effort_curves: Some(DieselJson(rolling_stock.effort_curves)),
            base_power_class: Some(rolling_stock.base_power_class),
            length: Some(rolling_stock.length),
            max_speed: Some(rolling_stock.max_speed),
            startup_time: Some(rolling_stock.startup_time),
            startup_acceleration: Some(rolling_stock.startup_acceleration),
            comfort_acceleration: Some(rolling_stock.comfort_acceleration),
            gamma: Some(DieselJson(rolling_stock.gamma)),
            inertia_coefficient: Some(rolling_stock.inertia_coefficient),
            features: Some(rolling_stock.features),
            mass: Some(rolling_stock.mass),
            rolling_resistance: Some(DieselJson(rolling_stock.rolling_resistance)),
            loading_gauge: Some(rolling_stock.loading_gauge),
            metadata: Some(DieselJson(rolling_stock.metadata)),
            power_restrictions: Some(rolling_stock.power_restrictions),
            ..Default::default()
        }
    }
}

#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<RollingStockCreateForm>,
) -> Result<Json<RollingStock>> {
    let rolling_stock: RollingStockModel = data.into_inner().into();
    let rolling_stock: RollingStock = rolling_stock.create(db_pool).await?.into();

    Ok(Json(rolling_stock))
}

#[cfg(test)]
mod tests {
    use crate::fixtures::tests::{db_pool, fast_rolling_stock, TestFixture};
    use crate::models::{Delete, RollingStockModel};
    use crate::views::rolling_stocks::RollingStock;
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use rstest::rstest;

    #[rstest]
    async fn get_rolling_stock(#[future] fast_rolling_stock: TestFixture<RollingStockModel>) {
        let app = create_test_service().await;
        let rolling_stock = fast_rolling_stock.await;

        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}", rolling_stock.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn create_rolling_stock(db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>) {
        let app = create_test_service().await;
        let rolling_stock: RollingStockModel =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");

        let response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock")
                .set_json(rolling_stock)
                .to_request(),
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);

        let rolling_stock: RollingStock = read_body_json(response).await;
        assert_eq!(rolling_stock.name, "fast_rolling_stock");
        assert!(RollingStockModel::delete(db_pool.clone(), rolling_stock.id)
            .await
            .is_ok());
    }
}
