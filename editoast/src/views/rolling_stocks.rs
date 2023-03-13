use crate::error::Result;

use crate::schema::rolling_stock::{RollingStock, RollingStockWithLiveries};
use crate::schema::rolling_stock_image::RollingStockCompoundImage;
use crate::schema::rolling_stock_livery::RollingStockLivery;
use crate::DbPool;
use actix_http::StatusCode;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, Data, Json, Path};
use actix_web::{get, HttpResponse};

pub fn routes() -> impl HttpServiceFactory {
    web::scope("/rolling_stock").service((get, get_livery))
}

#[get("/{rolling_stock_id}")]
async fn get(db_pool: Data<DbPool>, path: Path<i64>) -> Result<Json<RollingStockWithLiveries>> {
    let rolling_stock_id = path.into_inner();
    Ok(Json(
        RollingStock::retrieve(db_pool, rolling_stock_id).await?,
    ))
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

#[cfg(test)]
mod tests {
    use crate::client::PostgresConfig;
    use crate::schema::rolling_stock::{RollingStock, RollingStockForm};
    use crate::schema::rolling_stock_image::RollingStockCompoundImage;
    use crate::schema::rolling_stock_livery::{RollingStockLivery, RollingStockLiveryForm};
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_service, TestRequest};
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;
    use std::io::Cursor;

    #[actix_test]
    async fn get_rolling_stock() {
        let app = create_test_service().await;
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let mut rolling_stock_form: RollingStockForm =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");
        rolling_stock_form.name = String::from("get_rolling_stock_test");
        let rolling_stock = RollingStock::create(db_pool.clone(), rolling_stock_form)
            .await
            .unwrap();

        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}", rolling_stock.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        RollingStock::delete(db_pool.clone(), rolling_stock.id)
            .await
            .unwrap();

        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}", rolling_stock.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_test]
    async fn get_rolling_stock_livery() {
        let app = create_test_service().await;
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let mut rolling_stock_form: RollingStockForm =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");
        rolling_stock_form.name = String::from("get_rolling_stock_livery_test");
        let rolling_stock = RollingStock::create(db_pool.clone(), rolling_stock_form)
            .await
            .unwrap();

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
            rolling_stock_id: rolling_stock.id,
            compound_image_id: Some(image_id),
        };
        let livery_id = RollingStockLivery::create(db_pool.clone(), livery_form)
            .await
            .unwrap();

        // get - success
        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}/livery/{}", rolling_stock.id, livery_id).as_str())
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
            .uri(format!("/rolling_stock/{}/livery/{}", rolling_stock.id, livery_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        // get - not found
        assert!(RollingStock::delete(db_pool.clone(), rolling_stock.id)
            .await
            .is_ok());
        let req = TestRequest::get()
            .uri(format!("/rolling_stock/{}/livery/{}", rolling_stock.id, livery_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
