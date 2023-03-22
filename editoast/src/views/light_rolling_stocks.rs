use crate::error::Result;
use crate::models::{LightRollingStockModel, Retrieve};
use crate::schema::rolling_stock::light_rolling_stock::LightRollingStockWithLiveries;
use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::views::rolling_stocks::RollingStockError;
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
) -> Result<Json<PaginatedResponse<LightRollingStockWithLiveries>>> {
    let page = page_settings.page;
    let per_page = page_settings.page_size.unwrap_or(25);
    Ok(Json(
        LightRollingStockModel::list(db_pool, page, per_page).await?,
    ))
}

#[get("/{rolling_stock_id}")]
async fn get(
    db_pool: Data<DbPool>,
    rolling_stock_id: Path<i64>,
) -> Result<Json<LightRollingStockWithLiveries>> {
    let rolling_stock_id = rolling_stock_id.into_inner();
    let rolling_stock =
        match LightRollingStockModel::retrieve(db_pool.clone(), rolling_stock_id).await? {
            Some(rolling_stock) => rolling_stock,
            None => return Err(RollingStockError::NotFound { rolling_stock_id }.into()),
        };
    let rollig_stock_with_liveries = rolling_stock.with_liveries(db_pool).await?;
    Ok(Json(rollig_stock_with_liveries))
}

#[cfg(test)]
mod tests {
    use crate::fixtures::tests::{fast_rolling_stock, TestFixture};
    use crate::models::RollingStockModel;
    use crate::views::tests::create_test_service;
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_service, TestRequest};
    use rstest::*;

    #[actix_test]
    async fn list_light_rolling_stock() {
        let app = create_test_service().await;
        let req = TestRequest::get().uri("/light_rolling_stock").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn get_light_rolling_stock(#[future] fast_rolling_stock: TestFixture<RollingStockModel>) {
        let app = create_test_service().await;
        let rolling_stock = fast_rolling_stock.await;

        let req = TestRequest::get()
            .uri(format!("/light_rolling_stock/{}", rolling_stock.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn no_rolling_stock() {
        let app = create_test_service().await;

        let req = TestRequest::get()
            .uri(format!("/light_rolling_stock/{}", -1).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
