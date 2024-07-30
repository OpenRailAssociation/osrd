use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::Extension;
use editoast_authz::BuiltinRole;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::ModeEffortCurves;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStockLivery;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use itertools::Itertools;
use serde::Serialize;
use std::collections::HashMap;
use utoipa::ToSchema;

use super::RollingStockError;
use super::RollingStockIdParam;
use super::RollingStockKey;
use super::RollingStockNameParam;
use crate::error::Result;
use crate::modelsv2::rolling_stock_livery::RollingStockLiveryModel;
use crate::modelsv2::Retrieve;
use crate::modelsv2::RollingStockModel;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParam;
use crate::views::pagination::PaginationStats;
use crate::List;
use crate::SelectionSettings;

#[cfg(test)]
use serde::Deserialize;

use super::AuthorizationError;
use super::AuthorizerExt;

crate::routes! {
    "/light_rolling_stock" => {
        list,
        "/name/{rolling_stock_name}" => get_by_name,
        "/{rolling_stock_id}" => get,
    },
}

editoast_common::schemas! {
    LightEffortCurves,
    LightModeEffortCurves,
    LightRollingStock,
    LightRollingStockWithLiveries,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct LightRollingStockWithLiveries {
    #[serde(flatten)]
    rolling_stock: LightRollingStock,
    liveries: Vec<RollingStockLivery>,
}

impl LightRollingStockWithLiveries {
    async fn try_fetch(
        conn: &mut DbConnection,
        light_rolling_stock: RollingStockModel,
    ) -> Result<Self> {
        let light_rolling_stock_id = light_rolling_stock.id;
        let liveries = RollingStockLiveryModel::list(
            conn,
            SelectionSettings::new().filter(move || {
                RollingStockLiveryModel::ROLLING_STOCK_ID.eq(light_rolling_stock_id)
            }),
        )
        .await?
        .into_iter()
        .map_into()
        .collect();
        Ok(Self {
            rolling_stock: light_rolling_stock.into(),
            liveries,
        })
    }
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct LightRollingStockWithLiveriesCountList {
    #[schema(value_type = Vec<LightRollingStockWithLiveries>)]
    results: Vec<LightRollingStockWithLiveries>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Paginated list of rolling stock with a lighter response
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(PaginationQueryParam),
    responses(
        (status = 200, body = inline(LightRollingStockWithLiveriesCountList)),
    )
)]
async fn list(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Query(page_settings): Query<PaginationQueryParam>,
) -> Result<Json<LightRollingStockWithLiveriesCountList>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    let settings = page_settings
        .validate(1000)?
        .warn_page_size(100)
        .into_selection_settings()
        .order_by(|| RollingStockModel::ID.asc());
    let (rolling_stocks, stats) =
        RollingStockModel::list_paginated(&mut db_pool.get().await?, settings).await?;

    let results = rolling_stocks.into_iter().zip(db_pool.iter_conn()).map(
        |(rolling_stock, conn)| async move {
            LightRollingStockWithLiveries::try_fetch(&mut conn.await?, rolling_stock).await
        },
    );

    let results = futures::future::try_join_all(results).await?;

    Ok(Json(LightRollingStockWithLiveriesCountList {
        results,
        stats,
    }))
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
    Extension(authorizer): AuthorizerExt,
    Path(light_rolling_stock_id): Path<i64>,
) -> Result<Json<LightRollingStockWithLiveries>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    let rolling_stock = RollingStockModel::retrieve_or_fail(
        &mut db_pool.get().await?,
        light_rolling_stock_id,
        || RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Id(light_rolling_stock_id),
        },
    )
    .await?;
    let light_rolling_stock_with_liveries =
        LightRollingStockWithLiveries::try_fetch(&mut db_pool.get().await?, rolling_stock).await?;
    Ok(Json(light_rolling_stock_with_liveries))
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
    Extension(authorizer): AuthorizerExt,
    Path(light_rolling_stock_name): Path<String>,
) -> Result<Json<LightRollingStockWithLiveries>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::RollingStockCollectionRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    let rolling_stock = RollingStockModel::retrieve_or_fail(
        &mut db_pool.get().await?,
        light_rolling_stock_name.clone(),
        || RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Name(light_rolling_stock_name),
        },
    )
    .await?;
    let light_rolling_stock_with_liveries =
        LightRollingStockWithLiveries::try_fetch(&mut db_pool.get().await?, rolling_stock).await?;
    Ok(Json(light_rolling_stock_with_liveries))
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct LightRollingStock {
    id: i64,
    name: String,
    railjson_version: String,
    locked: bool,
    effort_curves: LightEffortCurves,
    base_power_class: Option<String>,
    length: f64,
    max_speed: f64,
    startup_time: f64,
    startup_acceleration: f64,
    comfort_acceleration: f64,
    gamma: Gamma,
    inertia_coefficient: f64,
    mass: f64,
    rolling_resistance: RollingResistance,
    loading_gauge: LoadingGaugeType,
    metadata: Option<RollingStockMetadata>,
    power_restrictions: HashMap<String, String>,
    energy_sources: Vec<EnergySource>,
    supported_signaling_systems: RollingStockSupportedSignalingSystems,
}

impl From<RollingStockModel> for LightRollingStock {
    fn from(
        RollingStockModel {
            id,
            railjson_version,
            name,
            effort_curves,
            metadata,
            length,
            max_speed,
            startup_time,
            startup_acceleration,
            comfort_acceleration,
            gamma,
            inertia_coefficient,
            base_power_class,
            mass,
            rolling_resistance,
            loading_gauge,
            power_restrictions,
            energy_sources,
            locked,
            supported_signaling_systems,
            ..
        }: RollingStockModel,
    ) -> Self {
        LightRollingStock {
            id,
            name,
            railjson_version,
            locked,
            effort_curves: effort_curves.into(),
            base_power_class,
            length,
            max_speed,
            startup_time,
            startup_acceleration,
            comfort_acceleration,
            gamma,
            inertia_coefficient,
            mass,
            rolling_resistance,
            loading_gauge,
            metadata,
            power_restrictions,
            energy_sources,
            supported_signaling_systems,
        }
    }
}

// Light effort curves schema for LightRollingStock
#[derive(Debug, Clone, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct LightModeEffortCurves {
    is_electric: bool,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
#[serde(deny_unknown_fields)]
struct LightEffortCurves {
    modes: HashMap<String, LightModeEffortCurves>,
    default_mode: String,
}

impl From<EffortCurves> for LightEffortCurves {
    fn from(
        EffortCurves {
            modes,
            default_mode,
        }: EffortCurves,
    ) -> Self {
        let modes = modes
            .into_iter()
            .map(|(mode, curve)| (mode, curve.into()))
            .collect();
        Self {
            modes,
            default_mode,
        }
    }
}

impl From<ModeEffortCurves> for LightModeEffortCurves {
    fn from(value: ModeEffortCurves) -> Self {
        Self {
            is_electric: value.is_electric,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rstest::*;

    use super::{LightRollingStockWithLiveries, LightRollingStockWithLiveriesCountList};
    use crate::error::InternalError;
    use crate::modelsv2::fixtures::create_fast_rolling_stock;
    use crate::modelsv2::fixtures::create_rolling_stock_livery_fixture;
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
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

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
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

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
                    &mut conn.await.unwrap(),
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
        let response: LightRollingStockWithLiveriesCountList =
            app.fetch(request).assert_status(StatusCode::OK).json_into();
        let count = response.stats.count;
        let uri = format!("/light_rolling_stock/?page_size={count}");
        let request = app.get(&uri);
        let response: LightRollingStockWithLiveriesCountList =
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
