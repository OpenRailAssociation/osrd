use axum::extract::Json;
use axum::extract::State;
use axum::Extension;
use chrono::NaiveDateTime;
use chrono::Utc;
use derivative::Derivative;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use serde::de::Error as SerdeError;
use serde::Deserialize;
use serde::Serialize;
use std::result::Result as StdResult;
use thiserror::Error;
use utoipa::ToSchema;

use crate::core::pathfinding::TrackRange as CoreTrackRange;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::prelude::*;
use crate::models::work_schedules::WorkSchedule;
use crate::models::work_schedules::WorkScheduleGroup;
use crate::models::work_schedules::WorkScheduleType;
use crate::views::path::projection::Intersection;
use crate::views::path::projection::PathProjection;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use crate::AppState;
use editoast_schemas::infra::{Direction, TrackRange};

crate::routes! {
    "/work_schedules" => {
        create,
        "/project_path" => project_path,
    },
}

editoast_common::schemas! {
    WorkScheduleCreateForm,
    WorkScheduleCreateResponse,
    WorkScheduleItemForm,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "work_schedule")]
enum WorkScheduleError {
    #[error("Name '{name}' already used")]
    #[editoast_error(status = 400)]
    NameAlreadyUsed { name: String },
}

pub fn map_diesel_error(e: InternalError, name: impl AsRef<str>) -> InternalError {
    if e.message.contains(
        r#"duplicate key value violates unique constraint "work_schedule_group_name_key""#,
    ) {
        WorkScheduleError::NameAlreadyUsed {
            name: name.as_ref().to_string(),
        }
        .into()
    } else {
        e
    }
}

#[derive(Serialize, Derivative, ToSchema)]
struct WorkScheduleItemForm {
    pub start_date_time: NaiveDateTime,
    pub end_date_time: NaiveDateTime,
    pub track_ranges: Vec<TrackRange>,
    pub obj_id: String,
    #[schema(inline)]
    pub work_schedule_type: WorkScheduleType,
}

impl<'de> Deserialize<'de> for WorkScheduleItemForm {
    fn deserialize<D>(deserializer: D) -> StdResult<WorkScheduleItemForm, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Internal {
            start_date_time: NaiveDateTime,
            end_date_time: NaiveDateTime,
            track_ranges: Vec<TrackRange>,
            obj_id: String,
            work_schedule_type: WorkScheduleType,
        }
        let internal = Internal::deserialize(deserializer)?;

        // Check dates
        if internal.start_date_time >= internal.end_date_time {
            return Err(SerdeError::custom(format!(
                "The work_schedule start date '{}' must be before the end date '{}'",
                internal.start_date_time, internal.end_date_time
            )));
        }

        Ok(WorkScheduleItemForm {
            start_date_time: internal.start_date_time,
            end_date_time: internal.end_date_time,
            track_ranges: internal.track_ranges,
            obj_id: internal.obj_id,
            work_schedule_type: internal.work_schedule_type,
        })
    }
}

impl WorkScheduleItemForm {
    pub fn into_work_schedule_changeset(
        self,
        work_schedule_group_id: i64,
    ) -> Changeset<WorkSchedule> {
        WorkSchedule::changeset()
            .start_date_time(self.start_date_time)
            .end_date_time(self.end_date_time)
            .track_ranges(self.track_ranges)
            .obj_id(self.obj_id)
            .work_schedule_type(self.work_schedule_type)
            .work_schedule_group_id(work_schedule_group_id)
    }
}

/// This structure is used by the post endpoint to create a work schedule
#[derive(Serialize, Deserialize, ToSchema)]
struct WorkScheduleCreateForm {
    work_schedule_group_name: String,
    work_schedules: Vec<WorkScheduleItemForm>,
}

#[derive(Serialize, Deserialize, ToSchema)]
struct WorkScheduleCreateResponse {
    work_schedule_group_id: i64,
}

#[utoipa::path(
    post, path = "",
    tag = "work_schedules",
    request_body = WorkScheduleCreateForm,
    responses(
        (status = 201, body = WorkScheduleCreateResponse, description = "The id of the created work schedule group"),
    )
)]
async fn create(
    State(app_state): State<AppState>,
    Extension(authorizer): AuthorizerExt,
    Json(WorkScheduleCreateForm {
        work_schedule_group_name,
        work_schedules,
    }): Json<WorkScheduleCreateForm>,
) -> Result<Json<WorkScheduleCreateResponse>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::WorkScheduleWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let conn = &mut db_pool.get().await?;

    // Create the work_schedule_group
    let work_schedule_group = WorkScheduleGroup::changeset()
        .name(work_schedule_group_name.clone())
        .creation_date(Utc::now().naive_utc())
        .create(conn)
        .await;
    let work_schedule_group =
        work_schedule_group.map_err(|e| map_diesel_error(e, work_schedule_group_name))?;

    // Create work schedules
    let work_schedules_changesets = work_schedules
        .into_iter()
        .map(|work_schedule| work_schedule.into_work_schedule_changeset(work_schedule_group.id))
        .collect::<Vec<_>>();
    let _work_schedules: Vec<_> =
        WorkSchedule::create_batch(conn, work_schedules_changesets).await?;

    Ok(Json(WorkScheduleCreateResponse {
        work_schedule_group_id: work_schedule_group.id,
    }))
}

#[derive(Serialize, Deserialize, ToSchema)]
struct WorkScheduleProjectForm {
    work_schedule_group_id: i64,
    #[schema(value_type = Vec<TrackRange>)]
    path_track_ranges: Vec<CoreTrackRange>,
}

/// Represents the projection of a work schedule on a path.
#[derive(Serialize, Deserialize, ToSchema, PartialEq, Debug)]
struct WorkScheduleProjection {
    #[serde(rename = "type")]
    #[schema(inline)]
    /// The type of the work schedule.
    pub work_schedule_type: WorkScheduleType,
    /// The date and time when the work schedule takes effect.
    pub start_date_time: NaiveDateTime,
    /// The date and time when the work schedule ends.
    pub end_date_time: NaiveDateTime,
    /// a list of intervals `(a, b)` that represent the projections of the work schedule track ranges:
    /// - `a` is the distance from the beginning of the path to the beginning of the track range
    /// - `b` is the distance from the beginning of the path to the end of the track range
    pub path_position_ranges: Vec<Intersection>,
}

#[utoipa::path(
    post, path = "",
    tag = "work_schedules",
    request_body = inline(WorkScheduleProjectForm),
    responses(
        (
            status = 201,
            body = inline(Vec<WorkScheduleProjection>),
            description = "Returns a list of work schedules whose track ranges intersect the given path"
        ),
    )
)]
async fn project_path(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Json(WorkScheduleProjectForm {
        work_schedule_group_id,
        path_track_ranges,
    }): Json<WorkScheduleProjectForm>,
) -> Result<Json<Vec<WorkScheduleProjection>>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::WorkScheduleRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    // get all work_schedule of the group
    let conn = &mut db_pool.get().await?;
    let settings: SelectionSettings<WorkSchedule> = SelectionSettings::new()
        .filter(move || WorkSchedule::WORK_SCHEDULE_GROUP_ID.eq(work_schedule_group_id));
    let work_schedules = WorkSchedule::list(conn, settings).await?;

    let projections = work_schedules
        .into_iter()
        .map(|ws| {
            let ws_track_ranges: Vec<_> = ws
                .clone()
                .track_ranges
                .into_iter()
                .map(|tr| CoreTrackRange {
                    track_section: tr.track,
                    begin: (tr.begin * 1000.0) as u64,
                    end: (tr.end * 1000.0) as u64,
                    direction: Direction::StartToStop,
                })
                .collect();

            let path_projection = PathProjection::new(&ws_track_ranges);
            // project this work_schedule on the path
            (ws, path_projection.get_intersections(&path_track_ranges))
        })
        .filter_map(|(ws, path_position_ranges)| {
            if path_position_ranges.is_empty() {
                None
            } else {
                Some(WorkScheduleProjection {
                    work_schedule_type: ws.work_schedule_type,
                    start_date_time: ws.start_date_time,
                    end_date_time: ws.end_date_time,
                    path_position_ranges,
                })
            }
        })
        .collect();
    Ok(Json(projections))
}

#[cfg(test)]
pub mod test {
    use axum::http::StatusCode;
    use chrono::NaiveDate;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::{
        models::fixtures::create_work_schedules_fixture_set, views::test_app::TestAppBuilder,
    };

    #[rstest]
    async fn work_schedule_create() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let request = app.post("/work_schedules").json(&json!({
            "work_schedule_group_name": "work schedule group name",
            "work_schedules": [{
                "start_date_time": "2024-01-01T08:00:00",
                "end_date_time": "2024-01-01T09:00:00",
                "track_ranges": [],
                "obj_id": "work_schedule_obj_id",
                "work_schedule_type": "CATENARY"
            }]
        }));

        // WHEN
        let work_schedule_response = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<WorkScheduleCreateResponse>();

        // THEN
        let created_group = WorkScheduleGroup::retrieve(
            &mut pool.get_ok(),
            work_schedule_response.work_schedule_group_id,
        )
        .await
        .expect("Failed to retrieve work schedule group");
        assert!(created_group.is_some());
    }

    #[rstest]
    async fn work_schedule_create_fail_start_date_after_end_date() {
        let app = TestAppBuilder::default_app();

        let request = app.post("/work_schedules").json(&json!({
            "work_schedule_group_name": "work schedule group name",
            "work_schedules": [{
                "start_date_time": "2024-01-01T08:00:00",
                "end_date_time": "2024-01-01T07:00:00",
                "track_ranges": [],
                "obj_id": "work_schedule_obj_id",
                "work_schedule_type": "CATENARY"
            }]
        }));

        app.fetch(request)
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[rstest]
    async fn work_schedule_create_fail_name_already_used() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        WorkScheduleGroup::changeset()
            .name("duplicated work schedule group name".to_string())
            .creation_date(Utc::now().naive_utc())
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create work schedule group");

        let request = app.post("/work_schedules").json(&json!({
            "work_schedule_group_name": "duplicated work schedule group name",
            "work_schedules": [{
                "start_date_time": "2024-01-01T08:00:00",
                "end_date_time": "2024-01-01T09:00:00",
                "track_ranges": [],
                "obj_id": "work_schedule_obj_id",
                "work_schedule_type": "CATENARY"
            }]
        }));

        let work_schedule_response = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into::<InternalError>();

        assert_eq!(
            &work_schedule_response.error_type,
            "editoast:work_schedule:NameAlreadyUsed"
        );
    }

    #[rstest]
    #[case::one_work_schedule_with_two_track_ranges(
        vec![
            vec![
                TrackRange::new("a", 0.0, 100.0),
                TrackRange::new("b", 0.0, 50.0),
            ]
        ],
        vec![
            vec![(0, 150000)],
        ]
    )]
    #[case::one_work_schedule_with_two_disjoint_track_ranges(
        vec![
            vec![
                TrackRange::new("a", 0.0, 100.0),
                TrackRange::new("d", 0.0, 100.0),
            ]
        ],
        vec![
            vec![(0, 100000), (300000, 400000)],
        ]
    )]
    #[case::one_work_schedule_but_no_intersection(
        vec![
            vec![
                TrackRange::new("d", 100.0, 150.0),
            ]
        ],
        vec![]
    )]
    #[case::two_work_schedules(
        vec![
            vec![
                TrackRange::new("a", 0.0, 100.0),
                TrackRange::new("c", 50.0, 100.0),
            ],
            vec![TrackRange::new("d", 50.0, 100.0)],
        ],
        vec![
            vec![(0, 100000), (250000, 300000)],
            vec![(350000, 400000)]
        ],
    )]
    async fn work_schedule_project_path_on_ws_group(
        #[case] work_schedule_track_ranges: Vec<Vec<TrackRange>>,
        #[case] expected_path_position_ranges: Vec<Vec<(u64, u64)>>,
    ) {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();
        let conn = &mut pool.get_ok();

        // create work schedules
        let working_schedules_changeset = work_schedule_track_ranges
            .into_iter()
            .enumerate()
            .map(|(index, track_ranges)| {
                let start_date_time =
                    NaiveDate::from_ymd_opt(2024, 1, (index + 1).try_into().unwrap())
                        .unwrap()
                        .and_hms_opt(0, 0, 0)
                        .unwrap();
                let end_date_time =
                    NaiveDate::from_ymd_opt(2024, 1, (index + 2).try_into().unwrap())
                        .unwrap()
                        .and_hms_opt(0, 0, 0)
                        .unwrap();
                WorkSchedule::changeset()
                    .start_date_time(start_date_time)
                    .end_date_time(end_date_time)
                    .track_ranges(track_ranges)
                    .obj_id(format!("work_schedule_{}", index))
                    .work_schedule_type(WorkScheduleType::Track)
            })
            .collect();

        let (work_schedule_group, work_schedules) =
            create_work_schedules_fixture_set(conn, working_schedules_changeset).await;

        let request = app.post("/work_schedules/project_path").json(&json!({
            "work_schedule_group_id": work_schedule_group.id,
            "path_track_ranges": [
                {
                    "track_section": "a",
                    "begin": 0,
                    "end": 100000,
                    "direction": "START_TO_STOP"
                },
                {
                    "track_section": "b",
                    "begin": 0,
                    "end": 100000,
                    "direction": "START_TO_STOP"
                },
                {
                    "track_section": "c",
                    "begin": 0,
                    "end": 100000,
                    "direction": "START_TO_STOP"
                },
                {
                    "track_section": "d",
                    "begin": 0,
                    "end": 100000,
                    "direction": "START_TO_STOP"
                }
            ]
        }));

        // WHEN
        let work_schedule_project_response = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<Vec<WorkScheduleProjection>>();

        // THEN
        let expected: Vec<WorkScheduleProjection> = expected_path_position_ranges
            .into_iter()
            .enumerate()
            .map(|(index, position_ranges)| WorkScheduleProjection {
                work_schedule_type: work_schedules[index].work_schedule_type,
                start_date_time: work_schedules[index].start_date_time,
                end_date_time: work_schedules[index].end_date_time,
                path_position_ranges: position_ranges
                    .into_iter()
                    .map(Intersection::from)
                    .collect(),
            })
            .collect();

        assert_eq!(work_schedule_project_response, expected);
    }
}
