use crate::error::Result;
use crate::models::{LightRollingStockModel, Retrieve};
use crate::schema::rolling_stock::light_rolling_stock::LightRollingStockWithLiveries;
use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::views::rolling_stocks::{RollingStockError, RollingStockIdParam};
use crate::{decl_paginated_response, DbPool};
use actix_web::get;
use actix_web::web::{Data, Json, Path, Query};

crate::routes! {
    "/light_rolling_stock" => {
        get,
        list,
    },
}

decl_paginated_response!(
    PaginatedResponseOfLightRollingStockWithLiveries,
    LightRollingStockWithLiveries
);

crate::schemas! {
    PaginatedResponseOfLightRollingStockWithLiveries,
}

/// Paginated list of rolling stock with a lighter response
#[utoipa::path(
    tag = "rolling_stock",
    params(PaginationQueryParam),
    responses(
        (status = 200, body = PaginatedResponseOfLightRollingStockWithLiveries),
    )
)]
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

/// Retrieve a rolling stock's light representation
#[utoipa::path(
    tag = "rolling_stock",
    params(RollingStockIdParam),
    responses(
        (status = 200, body = LightRollingStockWithLiveries, description = "The rolling stock with their simplified effort curves"),
    )
)]
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
    use crate::assert_status_and_read;
    use crate::fixtures::tests::{db_pool, named_fast_rolling_stock, rolling_stock_livery};
    use crate::schema::rolling_stock::light_rolling_stock::LightRollingStockWithLiveries;
    use crate::views::pagination::PaginatedResponse;
    use crate::views::tests::create_test_service;
    use crate::DbPool;
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_service, TestRequest};
    use actix_web::web::Data;
    use rstest::*;
    use std::collections::HashSet;

    #[actix_test]
    async fn list_light_rolling_stock() {
        let app = create_test_service().await;
        let req = TestRequest::get().uri("/light_rolling_stock").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn get_light_rolling_stock(db_pool: Data<DbPool>) {
        // GIVEN
        let app = create_test_service().await;
        let rolling_stock = named_fast_rolling_stock(
            "fast_rolling_stock_get_light_rolling_stock",
            db_pool.clone(),
        )
        .await;

        let req = TestRequest::get()
            .uri(format!("/light_rolling_stock/{}", rolling_stock.id()).as_str())
            .to_request();

        // WHEN
        let response = call_service(&app, req).await;

        // THEN
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

    fn is_sorted(data: &[i64]) -> bool {
        for elem in data.windows(2) {
            if elem[0] >= elem[1] {
                return false;
            }
        }
        true
    }

    #[rstest]
    async fn list_light_rolling_stock_increasing_ids(db_pool: Data<DbPool>) {
        // Generate some rolling stocks
        let vec_fixtures = (0..10)
            .map(|x| {
                let pool = db_pool.clone();
                async move {
                    rolling_stock_livery(&format!("list_light_rolling_stock_livery_ids_{x}"), pool)
                        .await
                }
            })
            .collect::<Vec<_>>();
        let vec_fixtures = futures::future::join_all(vec_fixtures).await;
        let expected_ids = vec_fixtures
            .iter()
            .map(|x| x.rolling_stock.model.id.unwrap())
            .collect::<HashSet<_>>();

        // Fetch all rolling stocks using /light_rolling_stock
        let app = create_test_service().await;
        let req = TestRequest::get().uri("/light_rolling_stock/").to_request();
        let response = call_service(&app, req).await;
        let response: PaginatedResponse<LightRollingStockWithLiveries> =
            assert_status_and_read!(response, StatusCode::OK);
        let count = response.count;
        let uri = format!("/light_rolling_stock/?page_size={count}");
        let req = TestRequest::get().uri(&uri).to_request();
        let response = call_service(&app, req).await;
        let response: PaginatedResponse<LightRollingStockWithLiveries> =
            assert_status_and_read!(response, StatusCode::OK);

        // Ensure that AT LEAST all the rolling stocks create above are returned, in order
        let vec_ids = response
            .results
            .iter()
            .map(|x| x.rolling_stock.id)
            .collect::<Vec<_>>();
        assert!(is_sorted(&vec_ids));
        let ids = HashSet::from_iter(vec_ids.into_iter());

        // Since tests are not properly isolated, some rolling stock fixture may "leak" from another test, so maybe ids.len() > expected_ids.len()
        assert!(expected_ids.is_subset(&ids));
    }
}
