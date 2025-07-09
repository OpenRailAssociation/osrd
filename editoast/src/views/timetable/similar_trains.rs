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
    "/similar_trains" => similar_trains,
}

#[derive(Debug, Deserialize, ToSchema)]
#[expect(dead_code)]
struct RollingStockCharacteristics {
    name: String,
    speed_limit_tag: Option<String>,
}

#[derive(Clone, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarTrainWaypoint)]
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
    #[schema(value_type = Vec<SimilarTrainWaypoint>)]
    waypoints: Vec<Waypoint>,
    infra_id: i64,
    timetable_id: i64,
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarTrainWaypointResponse)]
struct WaypointResponse {
    ci: i64,
    ch: String,
}

#[derive(Debug, Serialize, ToSchema)]
struct SimilarTrainItem {
    train_name: String,
    start_time: DateTime<Utc>,
    #[schema(value_type = SimilarTrainWaypointResponse)]
    begin: WaypointResponse,
    #[schema(value_type = SimilarTrainWaypointResponse)]
    end: WaypointResponse,
}

#[derive(Debug, Serialize, ToSchema)]
struct Response {
    #[schema(inline)]
    similar_trains: Vec<SimilarTrainItem>,
}

#[utoipa::path(
    post, path = "",
    tag = "similar_trains,stdcm,sncf",
    request_body = inline(Request),
    responses(
        (
            status = 200,
            description = "A combination of reference train identifiers similar to the provided train",
            body = inline(Response),
        ),
    ),
)]
async fn similar_trains(
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

    let similar_trains = Response {
        similar_trains: vec![
            SimilarTrainItem {
                train_name: "mock_similar_train_1".to_string(),
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
            SimilarTrainItem {
                train_name: "mock_similar_train_2".to_string(),
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

    Ok(Json(similar_trains))
}
