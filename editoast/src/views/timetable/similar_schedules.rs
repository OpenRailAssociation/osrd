mod new_schedule;

use axum::Extension;
use axum::Json;
use axum::extract::State;
use chrono::DateTime;
use chrono::Utc;
use editoast_authz::Role;
use editoast_derive::EditoastError;
use editoast_models::DbConnection;
use serde::Deserialize;
use serde::Serialize;
use smol_str::SmolStr;
use utoipa::ToSchema;

use crate::error::Result;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::models::RollingStock;
use crate::models::prelude::*;

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

struct RollingStockCharacteristics {
    name: String,
    speed_limit_tag: Option<String>,
}

#[derive(Clone, Deserialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq))]
#[schema(as = SimilarScheduleWaypoint)]
struct Waypoint {
    ci: u64,
    #[schema(value_type = String)]
    ch: SmolStr,
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

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "timetable:similar_schedules")]
enum SimilarSchedulesError {
    #[error(transparent)]
    #[editoast_error(status = 400)]
    InvalidPath(#[from] new_schedule::ScheduleError),
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

    let mut conn = db_pool.get().await?;

    // Step 1: input validation and preprocessing
    // ------------------------------------------

    validate_rolling_stock_input(&mut conn, &rolling_stock, &speed_limit_tag_ids).await?;

    let waypoints = squash_successive_waypoints(waypoints);
    let wp_count = waypoints.len();
    let new_schedule_waypoints = waypoints.into_iter().map(|Waypoint { ci, ch, stop }| {
        if stop {
            new_schedule::Waypoint::stop(ci, Some(ch))
        } else {
            new_schedule::Waypoint::passing_by(ci, Some(ch))
        }
    });
    let new_schedule = new_schedule::NewSchedule::new(new_schedule_waypoints)
        .map_err(SimilarSchedulesError::from)?;
    let segments = new_schedule.into_segments();

    tracing::debug!(
        n_segments = segments.len(),
        n_waypoints = wp_count,
        "pre-processing complete"
    );

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

async fn validate_rolling_stock_input(
    conn: &mut DbConnection,
    RollingStockCharacteristics {
        name,
        speed_limit_tag,
        ..
    }: &RollingStockCharacteristics,
    speed_limit_tag_ids: &SpeedLimitTagIds,
) -> Result<()> {
    if !RollingStock::exists(conn, name.clone()).await? {
        panic!("no such rolling stock, ok bye now");
    }

    if speed_limit_tag
        .as_ref()
        .is_some_and(|tag| !speed_limit_tag_ids.contains(tag))
    {
        panic!("speed limit tag not found");
    }

    Ok(())
}

fn squash_successive_waypoints(waypoints: Vec<Waypoint>) -> Vec<Waypoint> {
    let mut result = Vec::<Waypoint>::with_capacity(waypoints.len());
    for waypoint in waypoints {
        if let Some(prev) = result.last_mut() {
            if prev.ci == waypoint.ci && prev.ch == waypoint.ch {
                prev.stop |= waypoint.stop;
                continue;
            }
        }
        result.push(waypoint);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    use pretty_assertions::assert_eq;
    use smol_str::ToSmolStr;

    #[test]
    fn test_squash_waypoints() {
        let waypoints = Vec::new();
        assert_eq!(squash_successive_waypoints(waypoints), Vec::new());

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
            Waypoint {
                ci: 2,
                ch: "b".to_smolstr(),
                stop: false,
            },
        ];
        assert_eq!(squash_successive_waypoints(waypoints.clone()), waypoints);

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            }]
        );

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: true,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: true,
            }]
        );

        let waypoints = vec![
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
            Waypoint {
                ci: 1,
                ch: "a".to_smolstr(),
                stop: false,
            },
            Waypoint {
                ci: 2,
                ch: "b".to_smolstr(),
                stop: false,
            },
        ];
        assert_eq!(
            squash_successive_waypoints(waypoints),
            vec![
                Waypoint {
                    ci: 1,
                    ch: "a".to_smolstr(),
                    stop: false,
                },
                Waypoint {
                    ci: 2,
                    ch: "b".to_smolstr(),
                    stop: false,
                },
            ]
        );
    }
}
