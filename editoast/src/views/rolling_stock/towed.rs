use std::sync::Arc;

use crate::error::InternalError;
use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use authz::Role;
use axum::Extension;
use axum::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use database::DbConnectionPoolV2;
use diesel_async::scoped_futures::ScopedFutureExt as _;
use editoast_derive::EditoastError;
use editoast_models::TowedRollingStock;
use editoast_models::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use schemas::TowedRollingStock as TowedRollingStockForm;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "towedrollingstocks")]
pub enum TowedRollingStockError {
    #[error("Towed rolling stock '{towed_rolling_stock_id}' could not be found")]
    #[editoast_error(status = 404)]
    IdNotFound { towed_rolling_stock_id: i64 },

    #[error("Towed rolling stock '{towed_rolling_stock_id}' is locked")]
    #[editoast_error(status = 409)]
    IsLocked { towed_rolling_stock_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct PostTowedRollingStockQueryParams {
    #[serde(default)]
    locked: bool,
}

/// Create a towed rolling stock
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "rolling_stock",
    params(PostTowedRollingStockQueryParams),
    request_body = TowedRollingStockForm,
    responses(
        (status = 200, description = "The created towed rolling stock", body = TowedRollingStock)
    )
)]
pub(in crate::views) async fn post(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(query_params): Query<PostTowedRollingStockQueryParams>,
    Json(towed_rolling_stock_form): Json<TowedRollingStockForm>,
) -> Result<Json<TowedRollingStock>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let conn = &mut db_pool.get().await?;
    let rolling_stock_changeset: Changeset<TowedRollingStock> = towed_rolling_stock_form.into();

    let rolling_stock = rolling_stock_changeset
        .locked(query_params.locked)
        .version(0)
        .create(conn)
        .await?;

    Ok(Json(rolling_stock))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct TowedRollingStockCountList {
    results: Vec<TowedRollingStock>,
    #[serde(flatten)]
    stats: PaginationStats,
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(PaginationQueryParams<50>),
    responses(
        (status = 200, body = inline(TowedRollingStockCountList)),
    )
)]
pub(in crate::views) async fn get_list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(page_settings): Query<PaginationQueryParams<50>>,
) -> Result<Json<TowedRollingStockCountList>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let settings = page_settings
        .into_selection_settings()
        .order_by(|| TowedRollingStock::ID.asc());
    let (towed_rolling_stocks, stats) =
        TowedRollingStock::list_paginated(&mut db_pool.get().await?, settings).await?;

    Ok(Json(TowedRollingStockCountList {
        results: towed_rolling_stocks,
        stats,
    }))
}

#[derive(Debug, IntoParams, Deserialize)]
pub struct TowedRollingStockIdParam {
    towed_rolling_stock_id: i64,
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(TowedRollingStockIdParam),
    responses(
        (status = 200, body = TowedRollingStock, description = "The requested towed rolling stock"),
    )
)]
pub(in crate::views) async fn get_by_id(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TowedRollingStockIdParam {
        towed_rolling_stock_id,
    }): Path<TowedRollingStockIdParam>,
) -> Result<Json<TowedRollingStock>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let towed_rolling_stock =
        TowedRollingStock::retrieve_or_fail(db_pool.get().await?, towed_rolling_stock_id, || {
            TowedRollingStockError::IdNotFound {
                towed_rolling_stock_id,
            }
        })
        .await?;
    Ok(Json(towed_rolling_stock))
}

#[editoast_derive::route]
#[utoipa::path(
    put, path = "",
    tag = "rolling_stock",
    params(TowedRollingStockIdParam),
    request_body = TowedRollingStockForm,
    responses(
        (status = 200, description = "The modified towed rolling stock", body = TowedRollingStock)
    )
)]
pub(in crate::views) async fn put_by_id(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TowedRollingStockIdParam {
        towed_rolling_stock_id,
    }): Path<TowedRollingStockIdParam>,
    Json(towed_rolling_stock_form): Json<TowedRollingStockForm>,
) -> Result<Json<TowedRollingStock>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let new_towed_rolling_stock = db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                let existing_rolling_stock = TowedRollingStock::retrieve_or_fail(
                    conn.clone(),
                    towed_rolling_stock_id,
                    || TowedRollingStockError::IdNotFound {
                        towed_rolling_stock_id,
                    },
                )
                .await?;

                if existing_rolling_stock.locked {
                    return Err(TowedRollingStockError::IsLocked {
                        towed_rolling_stock_id,
                    }
                    .into());
                }

                if towed_rolling_stock_form != existing_rolling_stock.clone().into() {
                    let mut towed_rolling_stock_changeset: Changeset<TowedRollingStock> =
                        towed_rolling_stock_form.clone().into();
                    towed_rolling_stock_changeset.version =
                        Some(&existing_rolling_stock.version + 1);
                    let new_towed_rolling_stock = towed_rolling_stock_changeset
                        .update(&mut conn.clone(), towed_rolling_stock_id)
                        .await?
                        .ok_or(TowedRollingStockError::IdNotFound {
                            towed_rolling_stock_id,
                        })?;
                    Ok(new_towed_rolling_stock)
                } else {
                    Ok(existing_rolling_stock)
                }
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(new_towed_rolling_stock))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub(in crate::views) struct TowedRollingStockLockedForm {
    /// New locked value
    pub locked: bool,
}

#[editoast_derive::route]
#[utoipa::path(
    patch, path = "",
    tag = "rolling_stock",
    params(TowedRollingStockIdParam),
    request_body = TowedRollingStockLockedForm,
    responses(
        (status = 204, description = "No content when successful")
    )
)]
pub(in crate::views) async fn patch_by_id_locked(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(towed_rolling_stock_id): Path<i64>,
    Json(TowedRollingStockLockedForm { locked }): Json<TowedRollingStockLockedForm>,
) -> Result<StatusCode> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    TowedRollingStock::changeset()
        .locked(locked)
        .update_or_fail(conn, towed_rolling_stock_id, || {
            TowedRollingStockError::IdNotFound {
                towed_rolling_stock_id,
            }
        })
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::TowedRollingStockCountList;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;
    use axum::http::StatusCode;
    use common::units;
    use editoast_models::TowedRollingStock;

    use serde_json::json;
    use uuid::Uuid;

    const LOCKED: bool = true;
    const UNLOCKED: bool = false;

    async fn create_towed_rolling_stock(
        app: &TestApp,
        name: &str,
        locked: bool,
    ) -> TowedRollingStock {
        let towed_rolling_stock_json = json!({
            "name": name,
            "label": name,
            "locked": locked,
            "mass": 42000,
            "length": 16500,
            "comfort_acceleration": 0.05,
            "startup_acceleration": 0.05,
            "inertia_coefficient": 1.0,
            "rolling_resistance": {
                "type": "yoda",
                "A": 1000.0,
                "B": 100.0,
                "C": 10.0,
            },
            "const_gamma": 1.0,
        });

        let request = app
            .post("/towed_rolling_stock")
            .add_query_param("locked", locked)
            .json(&towed_rolling_stock_json);

        app.fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into()
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_and_list_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let towed_rolling_stock = create_towed_rolling_stock(&app, &name, LOCKED).await;

        let towed_rolling_stocks: TowedRollingStockCountList = app
            .fetch(
                app.get("/towed_rolling_stock")
                    .add_query_param("page_size", 50),
            )
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert!(
            towed_rolling_stocks
                .results
                .iter()
                .any(|trs| trs.id == towed_rolling_stock.id)
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_unknown_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let id: i64 = rand::random();

        app.fetch(app.get(&format!("/towed_rolling_stock/{id}")))
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_and_get_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let created_towed_rolling_stock = create_towed_rolling_stock(&app, &name, LOCKED).await;

        assert_eq!(created_towed_rolling_stock.name, name);

        let id = created_towed_rolling_stock.id;

        let get_towed_rolling_stock: TowedRollingStock = app
            .fetch(app.get(&format!("/towed_rolling_stock/{id}")))
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(get_towed_rolling_stock, created_towed_rolling_stock);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn modify_unknown_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let towed_rolling_stock = create_towed_rolling_stock(&app, &name, UNLOCKED).await;

        let id: i64 = rand::random(); // <-- doesn't exist
        app.fetch(
            app.put(&format!("/towed_rolling_stock/{id}"))
                .json(&towed_rolling_stock),
        )
        .await
        .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn modify_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let mut towed_rolling_stock = create_towed_rolling_stock(&app, &name, UNLOCKED).await;

        let id = towed_rolling_stock.id;
        towed_rolling_stock.mass = units::kilogram::new(13000.0);
        let updated_towed_rolling_stock: TowedRollingStock = app
            .fetch(
                app.put(&format!("/towed_rolling_stock/{id}"))
                    .json(&towed_rolling_stock),
            )
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(updated_towed_rolling_stock.name, name);
        assert_eq!(
            updated_towed_rolling_stock.mass,
            units::kilogram::new(13000.0)
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn modify_lock_on_unknown_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let id: i64 = rand::random(); // <-- doesn't exist
        app.fetch(
            app.patch(&format!("/towed_rolling_stock/{id}/locked"))
                .json(&json!({ "locked": false })),
        )
        .await
        .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn modify_locked_towed_rolling_stock_fails() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let mut towed_rolling_stock = create_towed_rolling_stock(&app, &name, LOCKED).await;

        let id = towed_rolling_stock.id;
        towed_rolling_stock.mass = units::kilogram::new(13000.0);
        app.fetch(
            app.put(&format!("/towed_rolling_stock/{id}"))
                .json(&towed_rolling_stock),
        )
        .await
        .assert_status(StatusCode::CONFLICT);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn modify_locked_towed_rolling_stock_after_unlocked() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let mut towed_rolling_stock = create_towed_rolling_stock(&app, &name, LOCKED).await;

        let id = towed_rolling_stock.id;
        towed_rolling_stock.mass = units::kilogram::new(13000.0);
        app.fetch(
            app.patch(&format!("/towed_rolling_stock/{id}/locked"))
                .json(&json!({ "locked": false })),
        )
        .await
        .assert_status(StatusCode::NO_CONTENT);
        app.fetch(
            app.put(&format!("/towed_rolling_stock/{id}"))
                .json(&towed_rolling_stock),
        )
        .await
        .assert_status(StatusCode::OK);
    }
}
