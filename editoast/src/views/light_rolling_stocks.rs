use crate::error::Result;
use crate::schema::rolling_stock::{LightRollingStock, LightRollingStockWithLiveries};
use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::web::{self, Data, Json, Path, Query};

pub fn routes() -> impl HttpServiceFactory {
    web::scope("/light_rolling_stock").service((get, list))
}

#[get("")]
async fn list(
    db_pool: Data<DbPool>,
    page_settings: Query<PaginationQueryParam>,
) -> Result<Json<PaginatedResponse<LightRollingStock>>> {
    let page = page_settings.page;
    let per_page = page_settings.page_size.unwrap_or(25);
    Ok(Json(
        LightRollingStock::list(db_pool, page, per_page).await?,
    ))
}

#[get("/{rolling_stock_id}")]
async fn get(
    db_pool: Data<DbPool>,
    rolling_stock_id: Path<i64>,
) -> Result<Json<LightRollingStockWithLiveries>> {
    let rolling_stock_id = rolling_stock_id.into_inner();
    Ok(Json(
        LightRollingStock::retrieve(db_pool, rolling_stock_id).await?,
    ))
}

#[cfg(test)]
mod tests {
    use crate::client::PostgresConfig;
    use crate::models::RollingStock;
    use crate::models::{Create, Delete};
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_service, TestRequest};
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;

    #[actix_test]
    async fn list_light_rolling_stock() {
        let app = create_test_service().await;
        let req = TestRequest::get().uri("/light_rolling_stock").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[actix_test]
    async fn get_light_rolling_stock() {
        let app = create_test_service().await;
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let mut rolling_stock: RollingStock =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");
        rolling_stock.name = String::from("get_light_rolling_stock_test");
        let rolling_stock = rolling_stock.create(db_pool.clone()).await.unwrap();
        let rolling_stock_id = rolling_stock.id.unwrap();

        let req = TestRequest::get()
            .uri(format!("/light_rolling_stock/{}", rolling_stock_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        RollingStock::delete(db_pool.clone(), rolling_stock_id)
            .await
            .unwrap();

        let req = TestRequest::get()
            .uri(format!("/light_rolling_stock/{}", rolling_stock_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
