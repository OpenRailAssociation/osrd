mod error;
mod request;
mod response;

use axum::Extension;
use axum::Json;
use axum::extract::State;
use chrono::DateTime;
use editoast_authz::Role;
use request::Request;
use request::Segment;
use response::Response;

use crate::error::Result;
use crate::models::TrainSchedule;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;

editoast_common::schemas! {
    request::schemas(),
    response::schemas(),
}

crate::routes! {
    "/similar_schedules" => {
        similar_schedules,
    },
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
    State(AppState {
        db_pool,
        speed_limit_tag_ids,
        ..
    }): State<AppState>,
    Json(Request {
        rolling_stock,
        waypoints,
    }): Json<Request>,
) -> Result<Json<Response>> {
    let authorized = auth
        .check_roles([Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Step 1: input validation and preprocessing
    // ------------------------------------------

    rolling_stock
        .validate(&mut db_pool.get().await?, &speed_limit_tag_ids)
        .await?;
    let waypoints = request::Waypoint::squash_successive_waypoints(waypoints);
    let waypoints_count = waypoints.len();
    let segments = Segment::split_segments(waypoints)?;

    tracing::debug!(
        n_segments = segments.len(),
        n_waypoints = waypoints_count,
        "pre-processing complete"
    );

    // Step 2: query train schedules and build the search graph
    // ------------------------------------------------------------

    let train_schedules = TrainSchedule::get_by_rolling_stock_name_and_speed_limit_tag(
        db_pool.get().await?,
        rolling_stock.name,
        rolling_stock.speed_limit_tag,
    )
    .await?;

    for segment in segments {
        let start_waypoint = segment.start()?;
        let end_waypoint = segment.end()?;
        let similar_schedules = train_schedules
            .iter()
            .filter(|ts| ts.contains_stops_in_order(start_waypoint.ci, end_waypoint.ci))
            .collect::<Vec<_>>();
        tracing::info!("TEST similar_schedules count: {}", similar_schedules.len());

        if similar_schedules.is_empty() {
            return Ok(Json(Response {
                similar_schedules: vec![],
            }));
        }
    }

    let similar_schedules = Response {
        similar_schedules: vec![
            response::SimilarScheduleItem {
                schedule_id: "mock_similar_schedule_1".to_string(),
                start_time: DateTime::parse_from_rfc3339("2025-05-14T00:00:00Z")
                    .unwrap()
                    .to_utc(),
                begin: response::Waypoint {
                    ci: 123,
                    ch: "A1".to_string(),
                },
                end: response::Waypoint {
                    ci: 456,
                    ch: "B1".to_string(),
                },
            },
            response::SimilarScheduleItem {
                schedule_id: "mock_similar_schedule_2".to_string(),
                start_time: DateTime::parse_from_rfc3339("2025-05-14T00:00:00Z")
                    .unwrap()
                    .to_utc(),
                begin: response::Waypoint {
                    ci: 123,
                    ch: "A1".to_string(),
                },
                end: response::Waypoint {
                    ci: 456,
                    ch: "B1".to_string(),
                },
            },
        ],
    };

    Ok(Json(similar_schedules))
}
