use axum::Extension;
use axum::Json;
use axum::extract::State;
use chrono::DateTime;
use chrono::Utc;
use editoast_authz::Role;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;

editoast_common::schemas! {
    Waypoint,
    WaypointResponse,
}

crate::routes! {
    "/similar_schedules" => {
        similar_schedules,
    },
}

#[derive(Debug, Deserialize, ToSchema)]
#[expect(dead_code)]
struct RollingStockCharacteristics {
    name: String,
    speed_limit_tag: Option<String>,
}

#[derive(Clone, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarScheduleWaypoint)]
struct Waypoint {
    ci: i64,
    ch: String,
    stop: bool,
}

impl std::fmt::Debug for Waypoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}:{}{}",
            self.ci,
            self.ch,
            if self.stop { "[STOP]" } else { "" },
        )
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[expect(dead_code)]
struct Request {
    #[schema(inline)]
    rolling_stock: RollingStockCharacteristics,
    #[schema(value_type = Vec<SimilarScheduleWaypoint>)]
    waypoints: Vec<Waypoint>,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarScheduleWaypointResponse)]
struct WaypointResponse {
    ci: i64,
    ch: String,
}

#[derive(Debug, Serialize, ToSchema)]
struct SimilarScheduleItem {
    schedule_id: String,
    start_time: DateTime<Utc>,
    #[schema(value_type = SimilarScheduleWaypointResponse)]
    begin: WaypointResponse,
    #[schema(value_type = SimilarScheduleWaypointResponse)]
    end: WaypointResponse,
}

#[derive(Debug, Serialize, ToSchema)]
struct Response {
    #[schema(inline)]
    similar_schedules: Vec<SimilarScheduleItem>,
}

#[utoipa::path(
    post, path = "",
    tag = "similar_schedules,stdcm,sncf",
    request_body = inline(Request),
    responses(
        (
            status = 200,
            description = "A combination of reference train schedules identifiers similar to the provided schedule",
            body = inline(Response),
        ),
    ),
)]
async fn similar_schedules(
    Extension(auth): AuthenticationExt,
    State(AppState { .. }): State<AppState>,
    Json(Request { .. }): Json<Request>,
) -> Result<Json<Response>> {
    let authorized = auth
        .check_roles([Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let similar_schedules = Response {
        similar_schedules: vec![
            SimilarScheduleItem {
                schedule_id: "mock_similar_schedule_1".to_string(),
                start_time: DateTime::parse_from_rfc3339("2025-05-14T00:00:00Z")
                    .unwrap()
                    .to_utc(),
                begin: WaypointResponse {
                    ci: 123,
                    ch: "A1".to_string(),
                },
                end: WaypointResponse {
                    ci: 456,
                    ch: "B1".to_string(),
                },
            },
            SimilarScheduleItem {
                schedule_id: "mock_similar_schedule_2".to_string(),
                start_time: DateTime::parse_from_rfc3339("2025-05-14T00:00:00Z")
                    .unwrap()
                    .to_utc(),
                begin: WaypointResponse {
                    ci: 123,
                    ch: "A1".to_string(),
                },
                end: WaypointResponse {
                    ci: 456,
                    ch: "B1".to_string(),
                },
            },
        ],
    };

    Ok(Json(similar_schedules))
}
