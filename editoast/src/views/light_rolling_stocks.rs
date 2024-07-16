use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;

use crate::decl_paginated_response;
use crate::error::Result;
use crate::modelsv2::LightRollingStockModel;
use crate::modelsv2::Retrieve;
use crate::views::pagination::PaginatedResponse;
use crate::views::pagination::PaginationQueryParam;
use crate::views::rolling_stocks::RollingStockError;
use crate::views::rolling_stocks::RollingStockIdParam;
use crate::views::rolling_stocks::RollingStockKey;
use crate::views::rolling_stocks::RollingStockNameParam;
use editoast_models::DbConnectionPoolV2;

use super::rolling_stocks::light_rolling_stock::LightRollingStockWithLiveries;

crate::routes! {
    "/light_rolling_stock" => {
        list,
        "/name/{rolling_stock_name}" => get_by_name,
        "/{rolling_stock_id}" => get,
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
    get, path = "",
    tag = "rolling_stock",
    params(PaginationQueryParam),
    responses(
        (status = 200, body = PaginatedResponseOfLightRollingStockWithLiveries),
    )
)]
async fn list(
    State(db_pool): State<DbConnectionPoolV2>,
    Query(page_settings): Query<PaginationQueryParam>,
) -> Result<Json<PaginatedResponse<LightRollingStockWithLiveries>>> {
    let conn = &mut db_pool.get().await?;
    let (page, per_page) = page_settings.validate(1000)?.warn_page_size(100).unpack();
    let result = LightRollingStockModel::list(conn, page, per_page).await?;

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
    get, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam),
    responses(
        (status = 200, body = LightRollingStockWithLiveries, description = "The rolling stock with their simplified effort curves"),
    )
)]
async fn get(
    State(db_pool): State<DbConnectionPoolV2>,
    Path(rolling_stock_id): Path<i64>,
) -> Result<Json<LightRollingStockWithLiveries>> {
    let conn = &mut db_pool.get().await?;
    let rolling_stock = LightRollingStockModel::retrieve_or_fail(conn, rolling_stock_id, || {
        RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(rolling_stock_id),
        }
    })
    .await?;
    let rollig_stock_with_liveries: LightRollingStockWithLiveries =
        rolling_stock.with_liveries(conn).await?.into();
    Ok(Json(rollig_stock_with_liveries))
}

/// Retrieve a rolling stock's light representation by its name
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(RollingStockNameParam),
    responses(
        (status = 200, body = LightRollingStockWithLiveries, description = "The rolling stock with their simplified effort curves"),
    )
)]
async fn get_by_name(
    State(db_pool): State<DbConnectionPoolV2>,
    Path(rolling_stock_name): Path<String>,
) -> Result<Json<LightRollingStockWithLiveries>> {
    let conn = &mut db_pool.get().await?;
    let rolling_stock =
        LightRollingStockModel::retrieve_or_fail(conn, rolling_stock_name.clone(), || {
            RollingStockError::KeyNotFound {
                rolling_stock_key: RollingStockKey::Name(rolling_stock_name),
            }
        })
        .await?;
    let rollig_stock_with_liveries: LightRollingStockWithLiveries =
        rolling_stock.with_liveries(conn).await?.into();
    Ok(Json(rollig_stock_with_liveries))
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;
    use std::ops::DerefMut;

    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::*;

    use super::LightRollingStockWithLiveries;
    use crate::error::InternalError;
    use crate::modelsv2::fixtures::create_fast_rolling_stock;
    use crate::modelsv2::fixtures::create_rolling_stock_livery_fixture;
    use crate::views::pagination::PaginatedResponse;
    use crate::views::test_app::TestAppBuilder;

    fn is_sorted(data: &[i64]) -> bool {
        for elem in data.windows(2) {
            if elem[0] >= elem[1] {
                return false;
            }
        }
        true
    }

    #[rstest]
    async fn list_light_rolling_stock() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/light_rolling_stock");
        app.fetch(request).assert_status(StatusCode::OK);
    }

    #[rstest]
    async fn get_light_rolling_stock() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), rs_name).await;

        let request = app.get(format!("/light_rolling_stock/{}", fast_rolling_stock.id).as_str());

        // WHEN
        let response: LightRollingStockWithLiveries =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // THEN
        assert_eq!(response.rolling_stock.id, fast_rolling_stock.id);
    }

    #[rstest]
    async fn get_light_rolling_stock_by_name() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), rs_name).await;

        let request = app.get(format!("/light_rolling_stock/name/{}", rs_name).as_str());

        // WHEN
        let response: LightRollingStockWithLiveries =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // THEN
        assert_eq!(response.rolling_stock.id, fast_rolling_stock.id);
        assert_eq!(response.rolling_stock.name, fast_rolling_stock.name);
    }

    #[rstest]
    async fn get_unexisting_light_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let request = app.get(format!("/light_rolling_stock/{}", -1).as_str());

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn list_light_rolling_stock_increasing_ids() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let generated_rolling_stock = (0..10)
            .zip(std::iter::repeat(&db_pool).map(|p| p.get()))
            .map(|(rs_id, conn)| async move {
                let fixtures = create_rolling_stock_livery_fixture(
                    conn.await.unwrap().deref_mut(),
                    &format!("rs_name_{}", rs_id),
                )
                .await;
                let fixtures: Result<_, InternalError> = Ok(fixtures);
                fixtures
            });

        let generated_fixtures = futures::future::try_join_all(generated_rolling_stock)
            .await
            .unwrap();

        let expected_rs_ids = generated_fixtures
            .iter()
            .map(|(_, rs, _)| rs.id)
            .collect::<HashSet<_>>();

        let request = app.get("/light_rolling_stock/");
        let response: PaginatedResponse<LightRollingStockWithLiveries> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        let count = response.count;
        let uri = format!("/light_rolling_stock/?page_size={count}");
        let request = app.get(&uri);
        let response: PaginatedResponse<LightRollingStockWithLiveries> =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        // Ensure that AT LEAST all the rolling stocks create above are returned, in order
        let vec_ids = response
            .results
            .iter()
            .map(|x| x.rolling_stock.id)
            .collect::<Vec<_>>();
        assert!(is_sorted(&vec_ids));
        let ids = HashSet::from_iter(vec_ids.into_iter());

        // Since tests are not properly isolated, some rolling stock fixture may "leak" from another test, so maybe ids.len() > expected_ids.len()
        assert!(expected_rs_ids.is_subset(&ids));
    }

    #[rstest]
    async fn light_rolling_stock_max_page_size() {
        let app = TestAppBuilder::default_app();

        let request = app.get("/light_rolling_stock/?page_size=1010");

        let response: InternalError = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into();

        assert_eq!(response.error_type, "editoast:pagination:InvalidPageSize");
        assert_eq!(response.context["provided_page_size"], 1010);
        assert_eq!(response.context["max_page_size"], 1000);
    }
}
