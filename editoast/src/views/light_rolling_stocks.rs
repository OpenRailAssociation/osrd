use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;

use crate::decl_paginated_response;
use crate::error::Result;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::LightRollingStockModel;
use crate::modelsv2::Retrieve;
use crate::views::pagination::PaginatedResponse;
use crate::views::pagination::PaginationQueryParam;
use crate::views::rolling_stocks::RollingStockError;
use crate::views::rolling_stocks::RollingStockIdParam;
use crate::views::rolling_stocks::RollingStockKey;
use crate::views::rolling_stocks::RollingStockNameParam;

use super::rolling_stocks::light_rolling_stock::LightRollingStockWithLiveries;

crate::routes! {
    "/light_rolling_stock" => {
        list,
        "/name/{rolling_stock_name}" => {
            get_by_name,
        },
        "/{rolling_stock_id}" => {
            get,
        },
    },
}

decl_paginated_response!(
    PaginatedResponseOfLightRollingStockWithLiveries,
    LightRollingStockWithLiveries
);

editoast_common::schemas! {
    PaginatedResponseOfLightRollingStockWithLiveries,
    LightRollingStockWithLiveries,
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
    db_pool: Data<DbConnectionPool>,
    page_settings: Query<PaginationQueryParam>,
) -> Result<Json<PaginatedResponse<LightRollingStockWithLiveries>>> {
    let (page, per_page) = page_settings.validate(1000)?.warn_page_size(100).unpack();
    let result = LightRollingStockModel::list(db_pool, page, per_page).await?;

    let results: Vec<LightRollingStockWithLiveries> =
        result.results.into_iter().map(|l| l.into()).collect();

    let result = PaginatedResponse {
        count: result.count,
        previous: result.previous,
        next: result.next,
        results,
    };

    Ok(Json(result))
}

/// Retrieve a rolling stock's light representation by its id
#[utoipa::path(
    tag = "rolling_stock",
    params(RollingStockIdParam),
    responses(
        (status = 200, body = LightRollingStockWithLiveries, description = "The rolling stock with their simplified effort curves"),
    )
)]
#[get("")]
async fn get(
    db_pool: Data<DbConnectionPool>,
    rolling_stock_id: Path<i64>,
) -> Result<Json<LightRollingStockWithLiveries>> {
    let rolling_stock_id = rolling_stock_id.into_inner();
    let conn = &mut db_pool.get().await?;
    let rolling_stock = LightRollingStockModel::retrieve_or_fail(conn, rolling_stock_id, || {
        RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
        }
    })
    .await?;
    let rollig_stock_with_liveries: LightRollingStockWithLiveries =
        rolling_stock.with_liveries(db_pool).await?.into();
    Ok(Json(rollig_stock_with_liveries))
}

/// Retrieve a rolling stock's light representation by its name
#[utoipa::path(
    tag = "rolling_stock",
    params(RollingStockNameParam),
    responses(
        (status = 200, body = LightRollingStockWithLiveries, description = "The rolling stock with their simplified effort curves"),
    )
)]
#[get("")]
async fn get_by_name(
    db_pool: Data<DbConnectionPool>,
    rolling_stock_name: Path<String>,
) -> Result<Json<LightRollingStockWithLiveries>> {
    let rolling_stock_name = rolling_stock_name.into_inner();
    let conn = &mut db_pool.get().await?;
    let rolling_stock =
        LightRollingStockModel::retrieve_or_fail(conn, rolling_stock_name.clone(), || {
            RollingStockError::KeyNotFound {
                rolling_stock_key: RollingStockKey::Name(rolling_stock_name),
            }
        })
        .await?;
    let rollig_stock_with_liveries: LightRollingStockWithLiveries =
        rolling_stock.with_liveries(db_pool).await?.into();
    Ok(Json(rollig_stock_with_liveries))
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use actix_web::web::Data;
    use rstest::*;

    use super::LightRollingStockWithLiveries;
    use crate::assert_response_error_type_match;
    use crate::assert_status_and_read;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::named_fast_rolling_stock;
    use crate::fixtures::tests::rolling_stock_livery;
    use crate::modelsv2::DbConnectionPool;
    use crate::views::pagination::PaginatedResponse;
    use crate::views::pagination::PaginationError;
    use crate::views::tests::create_test_service;

    #[actix_test]
    async fn list_light_rolling_stock() {
        let app = create_test_service().await;
        let req = TestRequest::get().uri("/light_rolling_stock").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn get_light_rolling_stock(db_pool: Data<DbConnectionPool>) {
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
    async fn get_light_rolling_stock_by_name(db_pool: Data<DbConnectionPool>) {
        // GIVEN
        let app = create_test_service().await;
        let rolling_stock = named_fast_rolling_stock(
            "fast_rolling_stock_get_light_rolling_stock_",
            db_pool.clone(),
        )
        .await;

        let req = TestRequest::get()
            .uri(format!("/light_rolling_stock/name/{}", rolling_stock.name).as_str())
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
    async fn list_light_rolling_stock_increasing_ids(db_pool: Data<DbConnectionPool>) {
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
            .map(|x| x.rolling_stock.model.id)
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

    #[rstest]
    async fn light_rolling_stock_max_page_size() {
        let app = create_test_service().await;
        let req = TestRequest::get()
            .uri("/light_rolling_stock/?page_size=1010")
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_response_error_type_match!(
            response,
            PaginationError::InvalidPageSize {
                provided_page_size: 1010,
                max_page_size: 1000
            }
        );
    }
}
