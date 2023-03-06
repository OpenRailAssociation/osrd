use crate::error::Result;
use crate::schema::rolling_stock::RollingStock;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{self, block, Data, Json, Path};

pub fn routes() -> impl HttpServiceFactory {
    web::scope("/rolling_stock").service(get)
}

/// Return a specific set of electrical profiles
#[get("/{rolling_stock}")]
async fn get(db_pool: Data<DbPool>, rolling_stock: Path<i64>) -> Result<Json<RollingStock>> {
    let rolling_stock = rolling_stock.into_inner();
    block(move || Ok(Json(RollingStock::retrieve(db_pool, rolling_stock)?)))
        .await
        .unwrap()
}

#[cfg(test)]
mod tests {
    use crate::client::PostgresConfig;
    use crate::schema::rolling_stock::{RollingStock, RollingStockForm};
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_service, TestRequest};
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;
    use std::fs;

    #[actix_test]
    async fn get_rolling_stock() {
        let app = create_test_service().await;
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(2).build(manager).unwrap());

        let path = "./src/tests/example_rolling_stock.json";
        let data = fs::read_to_string(path).expect("Unable to read file");
        let rolling_stock_form: RollingStockForm =
            serde_json::from_str(&data).expect("Unable to parse");
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
}
