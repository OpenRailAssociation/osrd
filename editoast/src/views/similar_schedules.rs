use axum::extract::State;
use axum::Extension;
use axum::Json;
use editoast_authz::Role;
use editoast_models::DbConnectionPoolV2;

use super::AuthenticationExt;
use super::AuthorizationError;

crate::routes! {
    "/ref_schedules" => ref_schedules,
}

#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
struct RollingStockCharacteristics {
    name: String,
    towed_rolling_stock: Option<String>,
    speed_limit_tag: Option<String>,
    mass: Option<u64>,
}

#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
struct Waypoint {
    ci: i64,
    ch: String,
    stop: bool,
}

#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
struct RefSchedulesRequest {
    #[schema(inline)]
    rolling_stock: RollingStockCharacteristics,
    #[schema(inline)]
    waypoints: Vec<Waypoint>,
}

#[utoipa::path(
    post, path = "",
    tag = "ref_schedules,stdcm,sncf",
    request_body = inline(RefSchedulesRequest),
    responses(
        (
            status = 200,
            description = "A combination of reference train schedules identifiers similar to the provided schedule",
            body = Vec<String>,
            example = json!(["0098", "1234"])
        ),
    ),
)]
async fn ref_schedules(
    Extension(auth): AuthenticationExt,
    State(db_pool): State<DbConnectionPoolV2>,
    Json(RefSchedulesRequest {
        rolling_stock,
        waypoints,
    }): Json<RefSchedulesRequest>,
) -> crate::error::Result<Json<Vec<String>>> {
    let authorized = auth
        .check_roles([Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    tracing::info!(
        ?rolling_stock,
        ?waypoints,
        "recieved request, planes are best tho"
    );

    Ok(Json(vec!["12345".to_owned(), "6789".to_owned()]))
}
