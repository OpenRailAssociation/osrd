use crate::error::Result;
use crate::models::{Create, Retrieve, RollingStockModel};
use crate::schema::rolling_stock::{
    Gamma, RollingResistance, RollingStock, RollingStockError, RollingStockMetadata,
    RollingStockWithLiveries,
};
use crate::schema::rolling_stock_image::RollingStockCompoundImage;
use crate::schema::rolling_stock_livery::RollingStockLivery;
use crate::DbPool;
use actix_http::StatusCode;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, Data, Json, Path};
use actix_web::{get, post, HttpResponse};
use diesel_json::Json as DieselJson;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

pub fn routes() -> impl HttpServiceFactory {
    web::scope("/rolling_stock").service((get, get_livery, create))
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

#[get("/{rolling_stock_id}/livery/{livery_id}")]
async fn get_livery(db_pool: Data<DbPool>, path: Path<(i64, i64)>) -> Result<HttpResponse> {
    let (_rolling_stock_id, livery_id) = path.into_inner();
    let livery = RollingStockLivery::retrieve(db_pool.clone(), livery_id).await?;
    if livery.compound_image_id.is_some() {
        let compound_image = RollingStockCompoundImage::retrieve(
            db_pool.clone(),
            livery_id,
            livery.compound_image_id.unwrap(),
        )
        .await?;
        Ok(HttpResponse::build(StatusCode::OK)
            .content_type("image/png")
            .body(compound_image.inner_data()))
    } else {
        Ok(HttpResponse::build(StatusCode::NO_CONTENT).body(""))
    }
}

/// Creation form for a project
#[derive(Serialize, Deserialize)]
pub struct RollingStockCreateForm {
    pub name: String,
    pub version: String,
    pub effort_curves: JsonValue,
    pub base_power_class: String,
    pub length: f64,
    pub max_speed: f64,
    pub startup_time: f64,
    pub startup_acceleration: f64,
    pub comfort_acceleration: f64,
    pub gamma: DieselJson<Gamma>,
    pub inertia_coefficient: f64,
    pub features: Vec<String>,
    pub mass: f64,
    pub rolling_resistance: DieselJson<RollingResistance>,
    pub loading_gauge: String,
    pub metadata: DieselJson<RollingStockMetadata>,
    pub power_restrictions: Option<JsonValue>,
}

impl From<RollingStockCreateForm> for RollingStockModel {
    fn from(rolling_stock: RollingStockCreateForm) -> Self {
        RollingStockModel {
            id: None,
            name: Some(rolling_stock.name),
            version: Some(rolling_stock.version),
            effort_curves: Some(rolling_stock.effort_curves),
            base_power_class: Some(rolling_stock.base_power_class),
            length: Some(rolling_stock.length),
            max_speed: Some(rolling_stock.max_speed),
            startup_time: Some(rolling_stock.startup_time),
            startup_acceleration: Some(rolling_stock.startup_acceleration),
            comfort_acceleration: Some(rolling_stock.comfort_acceleration),
            gamma: Some(rolling_stock.gamma),
            inertia_coefficient: Some(rolling_stock.inertia_coefficient),
            features: Some(rolling_stock.features),
            mass: Some(rolling_stock.mass),
            rolling_resistance: Some(rolling_stock.rolling_resistance),
            loading_gauge: Some(rolling_stock.loading_gauge),
            metadata: Some(rolling_stock.metadata),
            power_restrictions: Some(rolling_stock.power_restrictions),
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
    use crate::client::PostgresConfig;
    use crate::models::RollingStockModel;
    use crate::models::{Create, Delete};
    use crate::schema::rolling_stock::RollingStock;
    use crate::schema::rolling_stock_image::RollingStockCompoundImage;
    use crate::schema::rolling_stock_livery::{RollingStockLivery, RollingStockLiveryForm};
    use crate::views::rolling_stocks::RollingStockCreateForm;
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;
    use std::io::Cursor;

    #[actix_test]
    async fn get_rolling_stock() {
        let app = create_test_service().await;
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let mut rolling_stock: RollingStockModel =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");
        rolling_stock.name = Some(String::from("get_rolling_stock_test"));
        let rolling_stock = rolling_stock.create(db_pool.clone()).await.unwrap();
        let rolling_stock_id = rolling_stock.id.unwrap();

        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}", rolling_stock_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        RollingStockModel::delete(db_pool.clone(), rolling_stock_id)
            .await
            .unwrap();

        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}", rolling_stock_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_test]
    async fn get_rolling_stock_livery() {
        let app = create_test_service().await;
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let mut rolling_stock: RollingStockModel =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");
        rolling_stock.name = Some(String::from("get_rolling_stock_livery_test"));
        let rolling_stock = rolling_stock.create(db_pool.clone()).await.unwrap();
        let rolling_stock_id = rolling_stock.id.unwrap();

        let img = image::open("src/tests/example_rolling_stock_image_1.gif").unwrap();
        let mut img_bytes: Vec<u8> = Vec::new();
        assert!(img
            .write_to(
                &mut Cursor::new(&mut img_bytes),
                image::ImageOutputFormat::Png
            )
            .is_ok());
        let image_id = RollingStockCompoundImage::create(db_pool.clone(), img_bytes)
            .await
            .unwrap();

        let livery_form = RollingStockLiveryForm {
            name: String::from("test_livery"),
            rolling_stock_id,
            compound_image_id: Some(image_id),
        };
        let livery_id = RollingStockLivery::create(db_pool.clone(), livery_form)
            .await
            .unwrap();

        // get - success
        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}/livery/{}", rolling_stock_id, livery_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        // get - no content
        assert!(
            RollingStockCompoundImage::delete(db_pool.clone(), livery_id, image_id)
                .await
                .is_ok()
        );
        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}/livery/{}", rolling_stock_id, livery_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        // get - not found
        assert!(RollingStockModel::delete(db_pool.clone(), rolling_stock_id)
            .await
            .is_ok());
        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}/livery/{}", rolling_stock_id, livery_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_test]
    async fn create_rolling_stock() {
        let app = create_test_service().await;
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());
        let mut rolling_stock: RollingStockCreateForm =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");
        rolling_stock.name = String::from("new rolling stock");

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
        assert_eq!(rolling_stock.name, "new rolling stock");
        assert!(RollingStockModel::delete(db_pool.clone(), rolling_stock.id)
            .await
            .is_ok());
    }
}
