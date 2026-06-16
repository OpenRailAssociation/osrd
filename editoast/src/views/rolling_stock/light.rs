use authz::RollingStockPrivilege;
use authz::v2::Authorizer;
use authz::v2::rolling_stock_privileges;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use common::units;
use common::units::quantities::Length;
use database::DbConnection;
use itertools::Itertools as _;
use models::prelude::*;
use models::rolling_stock::RollingStock;
use models::rolling_stock::TrainMainCategory;
use models::rolling_stock_livery::RollingStockLivery;
use schemas::rolling_stock::EffortCurves;
use schemas::rolling_stock::LoadingGaugeType;
use schemas::rolling_stock::ModeEffortCurves;
use schemas::rolling_stock::RollingStockMetadata;
use schemas::rolling_stock::SupportedSignalingSystem;
use serde::Serialize;
use std::collections::HashMap;
use std::collections::HashSet;
use uom::si::f64::Mass;
use uom::si::f64::Velocity;
use utoipa::ToSchema;

use super::RollingStockError;
use super::RollingStockIdParam;
use super::RollingStockKey;
use super::RollingStockNameParam;
use crate::AppState;
use crate::authorizers::SystemAuthorizer;
use crate::error::Result;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;

#[cfg(test)]
use serde::Deserialize;

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct LightRollingStockWithLiveries {
    #[serde(flatten)]
    rolling_stock: LightRollingStock,
    #[schema(value_type = Vec<RollingStockLivery>)]
    liveries: Vec<schemas::rolling_stock::RollingStockLivery>,
}

impl LightRollingStockWithLiveries {
    async fn try_fetch(conn: &mut DbConnection, light_rolling_stock: RollingStock) -> Result<Self> {
        let light_rolling_stock_id = light_rolling_stock.id;
        let liveries = RollingStockLivery::list(
            conn,
            SelectionSettings::new()
                .filter(move || RollingStockLivery::ROLLING_STOCK_ID.eq(light_rolling_stock_id)),
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
pub(in crate::views) struct LightRollingStockWithLiveriesCountList {
    #[schema(value_type = Vec<LightRollingStockWithLiveries>)]
    results: Vec<LightRollingStockWithLiveries>,
    #[serde(flatten)]
    stats: PaginationStats,
}

/// Paginated list of rolling stock with a lighter response
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(PaginationQueryParams<1000>),
    responses(
        (status = 200, body = inline(LightRollingStockWithLiveriesCountList)),
    )
)]
pub(in crate::views) async fn list(
    State(AppState {
        db_pool, openfga, ..
    }): State<AppState>,

    Extension(authn_state): Extension<crate::authentication::State>,
    Query(page_settings): Query<PaginationQueryParams<1000>>,
) -> Result<Json<LightRollingStockWithLiveriesCountList>> {
    let conn = &mut db_pool.get().await?;
    let default_settings = page_settings.into_selection_settings();
    let settings = if let Some(user) = authn_state.user() {
        let system_authorizer = SystemAuthorizer::new_infallible(&openfga);
        let Ok(authorized_rolling_stocks) = system_authorizer
            .authorize(authz::v2::rolling_stock_list(
                user,
                RollingStockPrivilege::CanRead,
            ))
            .await?
            .access()
            .await?;
        match authorized_rolling_stocks {
            authz::v2::ResourcesList::All => default_settings,
            authz::v2::ResourcesList::Privileged(authorized_rolling_stocks) => default_settings
                .filter(move || {
                    RollingStock::ID.eq_any(
                        authorized_rolling_stocks
                            .iter()
                            .map(|rolling_stock| rolling_stock.0)
                            .collect(),
                    )
                }),
        }
    } else {
        default_settings
    };

    let (rolling_stocks, stats) =
        RollingStock::list_paginated(conn, settings.order_by(move || RollingStock::ID.asc()))
            .await?;

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
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(RollingStockIdParam),
    responses(
        (status = 200, body = LightRollingStockWithLiveries, description = "The rolling stock with their simplified effort curves"),
    )
)]
pub(in crate::views) async fn get(
    State(AppState {
        openfga, db_pool, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Path(light_rolling_stock_id): Path<i64>,
) -> Result<Json<LightRollingStockWithLiveries>> {
    if let Some(user) = authn_state.user() {
        let authorizer = authn_state.authorizer(&openfga);
        crate::authorizers::require(
            &authorizer,
            rolling_stock_privileges(user, authz::RollingStock(light_rolling_stock_id)),
            &RollingStockPrivilege::CanRead,
        )
        .await?;
    }

    let rolling_stock =
        RollingStock::retrieve_or_fail(db_pool.get().await?, light_rolling_stock_id, || {
            RollingStockError::KeyNotFound {
                rolling_stock_key: RollingStockKey::Id(light_rolling_stock_id),
            }
        })
        .await?;
    let light_rolling_stock_with_liveries =
        LightRollingStockWithLiveries::try_fetch(&mut db_pool.get().await?, rolling_stock).await?;
    Ok(Json(light_rolling_stock_with_liveries))
}

/// Retrieve a rolling stock's light representation by its name
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "rolling_stock",
    params(RollingStockNameParam),
    responses(
        (status = 200, body = LightRollingStockWithLiveries, description = "The rolling stock with their simplified effort curves"),
    )
)]
pub(in crate::views) async fn get_by_name(
    State(AppState {
        openfga, db_pool, ..
    }): State<AppState>,
    Extension(authn_state): Extension<crate::authentication::State>,
    Path(light_rolling_stock_name): Path<String>,
) -> Result<Json<LightRollingStockWithLiveries>> {
    let rolling_stock = RollingStock::retrieve_or_fail(
        db_pool.get().await?,
        light_rolling_stock_name.clone(),
        || RollingStockError::KeyNotFound {
            rolling_stock_key: RollingStockKey::Name(light_rolling_stock_name),
        },
    )
    .await?;

    if let Some(user) = authn_state.user() {
        let authorizer = authn_state.authorizer(&openfga);
        crate::authorizers::require(
            &authorizer,
            rolling_stock_privileges(user, authz::RollingStock(rolling_stock.id)),
            &RollingStockPrivilege::CanRead,
        )
        .await?;
    }

    let light_rolling_stock_with_liveries =
        LightRollingStockWithLiveries::try_fetch(&mut db_pool.get().await?, rolling_stock).await?;
    Ok(Json(light_rolling_stock_with_liveries))
}

// WARNING: endpoints returning this struct are not protected by roles so this response MUST NOT expose sensitive information.
#[editoast_derive::annotate_units]
#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct LightRollingStock {
    id: i64,
    name: String,
    railjson_version: String,
    locked: bool,
    effort_curves: LightEffortCurves,
    #[schema(required)]
    base_power_class: Option<String>,
    #[serde(with = "units::meter")]
    length: Length,
    #[serde(with = "units::meter_per_second")]
    max_speed: Velocity,
    #[serde(with = "units::kilogram")]
    mass: Mass,
    loading_gauge: LoadingGaugeType,
    #[schema(required)]
    metadata: Option<RollingStockMetadata>,
    power_restrictions: HashMap<String, String>,
    supported_signaling_systems: HashSet<SupportedSignalingSystem>,
    primary_category: TrainMainCategory,
    other_categories: Vec<TrainMainCategory>,
}

impl From<RollingStock> for LightRollingStock {
    fn from(
        RollingStock {
            id,
            railjson_version,
            name,
            effort_curves,
            metadata,
            length,
            max_speed,
            base_power_class,
            mass,
            loading_gauge,
            power_restrictions,
            locked,
            supported_signaling_systems,
            primary_category,
            other_categories,
            ..
        }: RollingStock,
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
            mass,
            loading_gauge,
            metadata,
            power_restrictions,
            supported_signaling_systems,
            primary_category,
            other_categories,
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
    use authz::Role;
    use authz::RollingStockGrant;
    use pretty_assertions::assert_eq;
    use std::collections::HashSet;

    use models::prelude::*;
    use schemas::RollingStock;

    use super::LightRollingStockWithLiveries;
    use super::LightRollingStockWithLiveriesCountList;
    use crate::error::InternalError;
    use crate::fixtures::create_fast_rolling_stock;
    use crate::views::test_app;
    use crate::views::test_app::TestRequestExt;

    fn is_sorted(data: &[i64]) -> bool {
        for elem in data.windows(2) {
            if elem[0] >= elem[1] {
                return false;
            }
        }
        true
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_light_rolling_stock() {
        let app = test_app!().skip_authz().build();
        app.get("/light_rolling_stock").await.assert_status_ok();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn rolling_stock_list_filters_authorized_rolling_stocks() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let rolling_stock_grant =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "fast_rolling_stock_grant").await;
        let rolling_stock_no_grant =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "fast_rolling_stock_no_grant").await;
        // Regular user with the correct roles should see only the rolling stock he is associated with:
        let user = app
            .user("user_identity", "user_name")
            .with_rolling_stock_grant(rolling_stock_grant.id, RollingStockGrant::Reader)
            .create()
            .await;
        let response: LightRollingStockWithLiveriesCountList = app
            .get("/light_rolling_stock")
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            response
                .results
                .iter()
                .map(|rolling_stock| rolling_stock.rolling_stock.id)
                .collect::<Vec<_>>(),
            vec![rolling_stock_grant.id]
        );
        // TODO: separate in two tests (admins_can_list_all_rolling_stocks and user_can_list_their_rolling_stocks)
        // An admin should see all the rolling stocks:
        let admin = app
            .user("admin", "admin")
            .with_roles([Role::Admin])
            .create()
            .await;
        let response: LightRollingStockWithLiveriesCountList = app
            .get("/light_rolling_stock/")
            .by_user(admin.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            response
                .results
                .iter()
                .map(|rolling_stock| rolling_stock.rolling_stock.id)
                .collect::<Vec<_>>(),
            vec![rolling_stock_grant.id, rolling_stock_no_grant.id]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_light_rolling_stock() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        // a user with a read grant on the rolling stock
        let user = app
            .user("authorized", "Authorized")
            .with_rolling_stock_grant(fast_rolling_stock.id, authz::RollingStockGrant::Reader)
            .create()
            .await;

        // WHEN
        let response: LightRollingStockWithLiveries = app
            .get(format!("/light_rolling_stock/{}", fast_rolling_stock.id).as_str())
            .by_user(&user.info)
            .await
            .assert_status_ok()
            .json();

        // THEN
        assert_eq!(response.rolling_stock.id, fast_rolling_stock.id);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_light_rolling_stock_by_name() {
        // GIVEN
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        let fast_rolling_stock = create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        // a user with a read grant on the rolling stock
        let user = app
            .user("authorized", "Authorized")
            .with_rolling_stock_grant(fast_rolling_stock.id, authz::RollingStockGrant::Reader)
            .create()
            .await;

        // WHEN
        let response: LightRollingStockWithLiveries = app
            .get(format!("/light_rolling_stock/name/{rs_name}").as_str())
            .by_user(&user.info)
            .await
            .assert_status_ok()
            .json();

        // THEN
        assert_eq!(response.rolling_stock.id, fast_rolling_stock.id);
        assert_eq!(response.rolling_stock.name, fast_rolling_stock.name);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_unexisting_light_rolling_stock() {
        let app = test_app!().skip_authz().build();

        app.get(format!("/light_rolling_stock/{}", -1).as_str())
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_light_rolling_stock_without_permission() {
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "fast_rolling_stock_name").await;

        // a user that has the role to reach the endpoint but no read grant on the rolling stock
        let user = app
            .user("unauthorized", "Unauthorized")
            .with_roles([authz::Role::OperationalStudies])
            .create()
            .await;

        app.get(format!("/light_rolling_stock/{}", fast_rolling_stock.id).as_str())
            .by_user(&user.info)
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_light_rolling_stock_by_name_without_permission() {
        let app = test_app!().build();
        let db_pool = app.db_pool();

        let rs_name = "fast_rolling_stock_name";
        create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        // a user that has the role to reach the endpoint but no read grant on the rolling stock
        let user = app
            .user("unauthorized", "Unauthorized")
            .with_roles([authz::Role::OperationalStudies])
            .create()
            .await;

        app.get(format!("/light_rolling_stock/name/{rs_name}").as_str())
            .by_user(&user.info)
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_light_rolling_stock_increasing_ids() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

        let generated_rolling_stock = (0..10)
            .zip(std::iter::repeat(&db_pool).map(|p| p.get()))
            .map(|(rs_id, conn)| async move {
                let mut conn = conn.await?;
                let rs = Changeset::<models::rolling_stock::RollingStock>::from(
                    RollingStock::from(schemas::fixtures::simple_rolling_stock()),
                )
                .name(format!(
                    "test_list_light_rolling_stock_increasing_ids_{rs_id}"
                ))
                .locked(false)
                .version(0)
                .create(&mut conn)
                .await
                .expect("Failed to create rolling stock");

                Ok::<_, InternalError>(rs)
            });

        let generated_fixtures = futures::future::try_join_all(generated_rolling_stock)
            .await
            .unwrap();

        let expected_rs_ids = generated_fixtures
            .iter()
            .map(|rs| rs.id)
            .collect::<HashSet<_>>();

        let response: LightRollingStockWithLiveriesCountList = app
            .get("/light_rolling_stock/")
            .await
            .assert_status_ok()
            .json();
        let count = response.stats.count;
        let uri = format!("/light_rolling_stock/?page_size={count}");
        let response: LightRollingStockWithLiveriesCountList =
            app.get(&uri).await.assert_status_ok().json();

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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn light_rolling_stock_max_page_size() {
        let app = test_app!().skip_authz().build();

        app.get("/light_rolling_stock/?page_size=1010")
            .await
            .assert_status_bad_request();
    }
}
