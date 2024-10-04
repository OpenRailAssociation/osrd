use crate::error::InternalError;
use crate::error::Result;
use crate::models::prelude::*;
use crate::models::towed_rolling_stock::TowedRollingStockModel;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParam;
use crate::views::pagination::PaginationStats;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::Extension;
use axum::Json;
use diesel_async::scoped_futures::ScopedFutureExt as _;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::ROLLING_STOCK_RAILJSON_VERSION;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

crate::routes! {
    "/towed_rolling_stock" => {
        get_list,
        post,
        "/{towed_rolling_stock_id}" => {
            get_by_id,
            patch_by_id,
            "/locked" => patch_by_id_locked,
        },
    },
}

editoast_common::schemas! {
    TowedRollingStock,
    TowedRollingStockCountList,
    TowedRollingStockForm,
    TowedRollingStockLockedForm,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(serde::Deserialize, PartialEq))]
struct TowedRollingStock {
    id: i64,
    name: String,
    railjson_version: String,
    locked: bool,

    mass: f64,
    length: f64,
    comfort_acceleration: f64,
    startup_acceleration: f64,
    inertia_coefficient: f64,
    rolling_resistance: RollingResistance,
    gamma: Gamma,
}

impl From<TowedRollingStockModel> for TowedRollingStock {
    fn from(towed_rolling_stock: TowedRollingStockModel) -> Self {
        Self {
            id: towed_rolling_stock.id,
            name: towed_rolling_stock.name,
            railjson_version: towed_rolling_stock.railjson_version,
            locked: towed_rolling_stock.locked,
            mass: towed_rolling_stock.mass,
            length: towed_rolling_stock.length,
            comfort_acceleration: towed_rolling_stock.comfort_acceleration,
            startup_acceleration: towed_rolling_stock.startup_acceleration,
            inertia_coefficient: towed_rolling_stock.inertia_coefficient,
            rolling_resistance: towed_rolling_stock.rolling_resistance,
            gamma: towed_rolling_stock.gamma,
        }
    }
}
#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "towedrollingstocks")]
pub enum TowedRollingStockError {
    #[error("Towed rolling stock '{towed_rolling_stock_id}' could not be found")]
    #[editoast_error(status = 404)]
    IdNotFound { towed_rolling_stock_id: i64 },

    #[error("Towed rolling stock '{towed_rolling_stock_id}' is locked")]
    #[editoast_error(status = 409)]
    IsLocked { towed_rolling_stock_id: i64 },
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct TowedRollingStockForm {
    pub name: String,
    pub locked: bool,

    pub mass: f64,
    pub length: f64,
    pub comfort_acceleration: f64,
    pub startup_acceleration: f64,
    pub inertia_coefficient: f64,
    pub rolling_resistance: RollingResistance,
    pub gamma: Gamma,
}

impl From<TowedRollingStockForm> for Changeset<TowedRollingStockModel> {
    fn from(towed_rolling_stock_form: TowedRollingStockForm) -> Self {
        TowedRollingStockModel::changeset()
            .railjson_version(ROLLING_STOCK_RAILJSON_VERSION.to_string())
            .name(towed_rolling_stock_form.name)
            .locked(towed_rolling_stock_form.locked)
            .mass(towed_rolling_stock_form.mass)
            .length(towed_rolling_stock_form.length)
            .comfort_acceleration(towed_rolling_stock_form.comfort_acceleration)
            .startup_acceleration(towed_rolling_stock_form.startup_acceleration)
            .inertia_coefficient(towed_rolling_stock_form.inertia_coefficient)
            .rolling_resistance(towed_rolling_stock_form.rolling_resistance)
            .gamma(towed_rolling_stock_form.gamma)
    }
}

/// Create a rolling stock
#[utoipa::path(
    post, path = "",
    tag = "rolling_stock",
    request_body = TowedRollingStockForm,
    responses(
        (status = 200, description = "The created towed rolling stock", body = TowedRollingStock)
    )
)]
async fn post(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Json(towed_rolling_stock_form): Json<TowedRollingStockForm>,
) -> Result<Json<TowedRollingStock>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    let conn = &mut db_pool.get().await?;
    let rolling_stock_changeset: Changeset<TowedRollingStockModel> =
        towed_rolling_stock_form.into();

    let rolling_stock_model = rolling_stock_changeset.version(0).create(conn).await?;

    Ok(Json(TowedRollingStock::from(rolling_stock_model)))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct TowedRollingStockCountList {
    #[schema(value_type = Vec<TowedRollingStock>)]
    results: Vec<TowedRollingStock>,
    #[serde(flatten)]
    stats: PaginationStats,
}

#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(PaginationQueryParam),
    responses(
        (status = 200, body = inline(TowedRollingStockCountList)),
    )
)]
async fn get_list(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Query(page_settings): Query<PaginationQueryParam>,
) -> Result<Json<TowedRollingStockCountList>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    let settings = page_settings
        .validate(50)?
        .into_selection_settings()
        .order_by(|| TowedRollingStockModel::ID.asc());
    let (towed_rolling_stocks, stats) =
        TowedRollingStockModel::list_paginated(&mut db_pool.get().await?, settings).await?;

    Ok(Json(TowedRollingStockCountList {
        results: towed_rolling_stocks
            .into_iter()
            .map(TowedRollingStock::from)
            .collect(),
        stats,
    }))
}

#[derive(Debug, IntoParams, Deserialize)]
pub struct TowedRollingStockIdParam {
    towed_rolling_stock_id: i64,
}

#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(TowedRollingStockIdParam),
    responses(
        (status = 200, body = TowedRollingStock, description = "The requested towed rolling stock"),
    )
)]
async fn get_by_id(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Path(TowedRollingStockIdParam {
        towed_rolling_stock_id,
    }): Path<TowedRollingStockIdParam>,
) -> Result<Json<TowedRollingStock>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let towed_rolling_stock = TowedRollingStockModel::retrieve_or_fail(
        &mut db_pool.get().await?,
        towed_rolling_stock_id,
        || TowedRollingStockError::IdNotFound {
            towed_rolling_stock_id,
        },
    )
    .await?;
    Ok(Json(TowedRollingStock::from(towed_rolling_stock)))
}

#[utoipa::path(
    patch, path = "",
    tag = "rolling_stock",
    params(TowedRollingStockIdParam),
    request_body = TowedRollingStockForm,
    responses(
        (status = 200, description = "The created towed rolling stock", body = TowedRollingStock)
    )
)]
async fn patch_by_id(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Path(TowedRollingStockIdParam {
        towed_rolling_stock_id,
    }): Path<TowedRollingStockIdParam>,
    Json(towed_rolling_stock_form): Json<TowedRollingStockForm>,
) -> Result<Json<TowedRollingStock>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let new_towed_rolling_stock = db_pool
        .get()
        .await?
        .transaction::<_, InternalError, _>(|conn| {
            async move {
                let existing_rolling_stock = TowedRollingStockModel::retrieve_or_fail(
                    &mut conn.clone(),
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

                let mut new_towed_rolling_stock =
                    Changeset::<TowedRollingStockModel>::from(towed_rolling_stock_form)
                        .update(&mut conn.clone(), towed_rolling_stock_id)
                        .await?
                        .ok_or(TowedRollingStockError::IdNotFound {
                            towed_rolling_stock_id,
                        })?;

                if new_towed_rolling_stock != existing_rolling_stock {
                    new_towed_rolling_stock.version += 1;
                    new_towed_rolling_stock.save(&mut conn.clone()).await?;
                }
                Ok(TowedRollingStock::from(new_towed_rolling_stock))
            }
            .scope_boxed()
        })
        .await?;

    Ok(Json(new_towed_rolling_stock))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
struct TowedRollingStockLockedForm {
    /// New locked value
    pub locked: bool,
}

#[utoipa::path(
    patch, path = "",
    tag = "rolling_stock",
    params(TowedRollingStockIdParam),
    request_body = TowedRollingStockLockedForm,
    responses(
        (status = 204, description = "No content when successful")
    )
)]
async fn patch_by_id_locked(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Path(towed_rolling_stock_id): Path<i64>,
    Json(TowedRollingStockLockedForm { locked }): Json<TowedRollingStockLockedForm>,
) -> Result<StatusCode> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let conn = &mut db_pool.get().await?;

    // FIXME: check that the towed rolling stock exists (the Option<RollingStockModel> is ignored here)
    // should return a 404 instead of a 204 in case the identifier doesn't exist.
    TowedRollingStockModel::changeset()
        .locked(locked)
        .update(conn, towed_rolling_stock_id)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::TowedRollingStock;
    use super::TowedRollingStockCountList;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;
    use axum::http::StatusCode;
    use rstest::rstest;
    use serde_json::json;
    use uuid::Uuid;

    const LOCKED: bool = true;
    const UNLOCKED: bool = false;

    fn create_towed_rolling_stock(app: &TestApp, name: &str, locked: bool) -> TowedRollingStock {
        let towed_rolling_stock_json = json!({
            "name": name,
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
            "gamma": {
                "type": "CONST",
                "value": 1.0,
            },
        });

        let request = app
            .post("/towed_rolling_stock")
            .json(&towed_rolling_stock_json);

        app.fetch(request).assert_status(StatusCode::OK).json_into()
    }

    #[rstest]
    async fn create_and_list_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let towed_rolling_stock = create_towed_rolling_stock(&app, &name, LOCKED);

        let towed_rolling_stocks: TowedRollingStockCountList = app
            .fetch(app.get("/towed_rolling_stock"))
            .assert_status(StatusCode::OK)
            .json_into();

        assert!(towed_rolling_stocks
            .results
            .iter()
            .any(|trs| trs.id == towed_rolling_stock.id));
    }

    #[rstest]
    async fn get_unknown_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let id: i64 = rand::random();

        app.fetch(app.get(&format!("/towed_rolling_stock/{id}")))
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn create_and_get_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let created_towed_rolling_stock = create_towed_rolling_stock(&app, &name, LOCKED);

        assert_eq!(created_towed_rolling_stock.name, name);

        let id = created_towed_rolling_stock.id;

        let get_towed_rolling_stock: TowedRollingStock = app
            .fetch(app.get(&format!("/towed_rolling_stock/{id}")))
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(get_towed_rolling_stock, created_towed_rolling_stock);
    }

    #[rstest]
    async fn modify_unknown_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let towed_rolling_stock = create_towed_rolling_stock(&app, &name, UNLOCKED);

        let id: i64 = rand::random(); // <-- doesn't exist
        app.fetch(
            app.patch(&format!("/towed_rolling_stock/{id}"))
                .json(&towed_rolling_stock),
        )
        .assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn modify_towed_rolling_stock() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let mut towed_rolling_stock = create_towed_rolling_stock(&app, &name, UNLOCKED);

        let id = towed_rolling_stock.id;
        towed_rolling_stock.mass = 13000.0;
        let updated_towed_rolling_stock: TowedRollingStock = app
            .fetch(
                app.patch(&format!("/towed_rolling_stock/{id}"))
                    .json(&towed_rolling_stock),
            )
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(updated_towed_rolling_stock.name, name);
        assert_eq!(updated_towed_rolling_stock.mass, 13000.0);
    }

    #[rstest]
    async fn modify_locked_towed_rolling_stock_fails() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let mut towed_rolling_stock = create_towed_rolling_stock(&app, &name, LOCKED);

        let id = towed_rolling_stock.id;
        towed_rolling_stock.mass = 13000.0;
        app.fetch(
            app.patch(&format!("/towed_rolling_stock/{id}"))
                .json(&towed_rolling_stock),
        )
        .assert_status(StatusCode::CONFLICT);
    }

    #[rstest]
    async fn modify_locked_towed_rolling_stock_after_unlocked() {
        let app = TestAppBuilder::default_app();

        let name = Uuid::new_v4().to_string();
        let mut towed_rolling_stock = create_towed_rolling_stock(&app, &name, LOCKED);

        let id = towed_rolling_stock.id;
        towed_rolling_stock.mass = 13000.0;
        app.fetch(
            app.patch(&format!("/towed_rolling_stock/{id}/locked"))
                .json(&json!({ "locked": false })),
        )
        .assert_status(StatusCode::NO_CONTENT);
        app.fetch(
            app.patch(&format!("/towed_rolling_stock/{id}"))
                .json(&towed_rolling_stock),
        )
        .assert_status(StatusCode::OK);
    }
}
