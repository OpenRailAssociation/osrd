use super::pagination::PaginatedList;
use crate::core::pathfinding::TrackRange as CoreTrackRange;
use crate::error::Result;
use crate::models::prelude::*;
use crate::models::work_schedules;
use crate::models::work_schedules::WorkSchedule;
use crate::models::work_schedules::WorkScheduleGroup;
use crate::models::work_schedules::WorkScheduleType;
use crate::views::operational_studies::Ordering;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use crate::views::path::projection::Intersection;
use crate::views::path::projection::PathProjection;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use axum::Extension;
use chrono::DateTime;
use chrono::Utc;
use derivative::Derivative;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::Direction;
use editoast_schemas::infra::TrackRange;
use itertools::Either;
use serde::de::Error as SerdeError;
use serde::Deserialize;
use serde::Serialize;
use std::result::Result as StdResult;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;
use uuid::Uuid;

crate::routes! {
    "/work_schedules" => {
        create,
        "/project_path" => project_path,
        "/group" => {
            create_group,
            list_groups,
            "/{id}" => {
                delete_group,
                get_group,
                put_in_group,
            },
        },
    },
}

editoast_common::schemas! {
    WorkSchedule,
    WorkScheduleItemForm,
    WorkScheduleType,
}

#[derive(IntoParams, Deserialize)]
struct WorkScheduleGroupIdParam {
    /// A work schedule group ID
    id: i64,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "work_schedule")]
enum WorkScheduleError {
    #[error("Name '{name}' already used")]
    #[editoast_error(status = 400)]
    NameAlreadyUsed { name: String },
    #[error("Work schedule group '{id}' not found")]
    #[editoast_error(status = 404)]
    WorkScheduleGroupNotFound { id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(Either<work_schedules::Error, work_schedules::WsGroupError>),
}

impl From<work_schedules::Error> for WorkScheduleError {
    fn from(e: work_schedules::Error) -> Self {
        WorkScheduleError::Database(Either::Left(e))
    }
}

impl From<work_schedules::WsGroupError> for WorkScheduleError {
    fn from(e: work_schedules::WsGroupError) -> Self {
        match e {
            work_schedules::WsGroupError::NameAlreadyUsed { name } => {
                WorkScheduleError::NameAlreadyUsed { name }
            }
            e => WorkScheduleError::Database(Either::Right(e)),
        }
    }
}

#[derive(Serialize, Derivative, ToSchema)]
struct WorkScheduleItemForm {
    pub start_date_time: DateTime<Utc>,
    pub end_date_time: DateTime<Utc>,
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
            start_date_time: DateTime<Utc>,
            end_date_time: DateTime<Utc>,
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
    request_body = inline(WorkScheduleCreateForm),
    responses(
        (status = 201, body = inline(WorkScheduleCreateResponse), description = "The id of the created work schedule group"),
    )
)]
async fn create(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(WorkScheduleCreateForm {
        work_schedule_group_name,
        work_schedules,
    }): Json<WorkScheduleCreateForm>,
) -> Result<Json<WorkScheduleCreateResponse>> {
    // Create the group (using the method for the create group endpoint)
    let work_schedule_group = create_group(
        State(db_pool.clone()),
        Extension(auth),
        Json(WorkScheduleGroupCreateForm {
            work_schedule_group_name: Some(work_schedule_group_name),
        }),
    )
    .await?;

    let conn = &mut db_pool.get().await?;

    // Create work schedules
    let work_schedules_changesets = work_schedules
        .into_iter()
        .map(|work_schedule| {
            work_schedule.into_work_schedule_changeset(work_schedule_group.work_schedule_group_id)
        })
        .collect::<Vec<_>>();
    let _work_schedules: Vec<_> = WorkSchedule::create_batch(conn, work_schedules_changesets)
        .await
        .map_err(WorkScheduleError::from)?;

    Ok(Json(WorkScheduleCreateResponse {
        work_schedule_group_id: work_schedule_group.work_schedule_group_id,
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
    pub start_date_time: DateTime<Utc>,
    /// The date and time when the work schedule ends.
    pub end_date_time: DateTime<Utc>,
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
    Extension(auth): AuthenticationExt,
    Json(WorkScheduleProjectForm {
        work_schedule_group_id,
        path_track_ranges,
    }): Json<WorkScheduleProjectForm>,
) -> Result<Json<Vec<WorkScheduleProjection>>> {
    let authorized = auth
        .check_roles([BuiltinRole::WorkScheduleRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
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

#[derive(Serialize, Deserialize, ToSchema)]
struct WorkScheduleGroupCreateForm {
    work_schedule_group_name: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema)]
struct WorkScheduleGroupCreateResponse {
    work_schedule_group_id: i64,
}

#[utoipa::path(
    post, path = "",
    tag = "work_schedules",
    request_body = inline(WorkScheduleGroupCreateForm),
    responses(
        (status = 200, body = inline(WorkScheduleGroupCreateResponse), description = "The id of the created work schedule group"),
    )
)]
async fn create_group(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(WorkScheduleGroupCreateForm {
        work_schedule_group_name,
    }): Json<WorkScheduleGroupCreateForm>,
) -> Result<Json<WorkScheduleGroupCreateResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::WorkScheduleWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let group_name = work_schedule_group_name.unwrap_or(Uuid::new_v4().to_string());

    // Create the work_schedule_group
    let work_schedule_group = WorkScheduleGroup::changeset()
        .name(group_name.clone())
        .creation_date(Utc::now())
        .create(conn)
        .await
        .map_err(WorkScheduleError::from)?;

    Ok(Json(WorkScheduleGroupCreateResponse {
        work_schedule_group_id: work_schedule_group.id,
    }))
}

#[utoipa::path(
    delete, path = "",
    tag = "work_schedules",
    params(WorkScheduleGroupIdParam),
    responses(
        (status = 204, description = "The work schedule group has been deleted"),
        (status = 404, description = "The work schedule group does not exist"),
    )
)]
async fn delete_group(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(WorkScheduleGroupIdParam { id: group_id }): Path<WorkScheduleGroupIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::WorkScheduleWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    WorkScheduleGroup::delete_static_or_fail(conn, group_id, || {
        WorkScheduleError::WorkScheduleGroupNotFound { id: group_id }
    })
    .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "",
    tag = "work_schedules",
    responses(
        (status = 201, body = Vec<i64>, description = "The existing work schedule group ids"),
    )
)]
async fn list_groups(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<Vec<i64>>> {
    let authorized = auth
        .check_roles([BuiltinRole::WorkScheduleRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let selection_setting = SelectionSettings::new();
    let work_schedule_group_ids = WorkScheduleGroup::list(conn, selection_setting)
        .await?
        .iter()
        .map(|group| group.id)
        .collect::<Vec<i64>>();

    Ok(Json(work_schedule_group_ids))
}

#[utoipa::path(
    put, path = "",
    tag = "work_schedules",
    request_body = Vec<WorkScheduleItemForm>,
    params(WorkScheduleGroupIdParam),
    responses(
        (status = 200, description = "The work schedules have been created", body = Vec<WorkSchedule>),
        (status = 404, description = "Work schedule group not found"),
    )
)]
async fn put_in_group(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(WorkScheduleGroupIdParam { id: group_id }): Path<WorkScheduleGroupIdParam>,
    Json(work_schedules): Json<Vec<WorkScheduleItemForm>>,
) -> Result<Json<Vec<WorkSchedule>>> {
    let authorized = auth
        .check_roles([BuiltinRole::WorkScheduleWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    conn.transaction(|conn| {
        Box::pin(async move {
            // Check that the group exists
            WorkScheduleGroup::retrieve_or_fail(&mut conn.clone(), group_id, || {
                WorkScheduleError::WorkScheduleGroupNotFound { id: group_id }
            })
            .await?;

            // Create work schedules
            let work_schedules_changesets = work_schedules
                .into_iter()
                .map(|work_schedule| work_schedule.into_work_schedule_changeset(group_id))
                .collect::<Vec<_>>();
            let work_schedules =
                WorkSchedule::create_batch(&mut conn.clone(), work_schedules_changesets)
                    .await
                    .map_err(WorkScheduleError::from)?;

            Ok(Json(work_schedules))
        })
    })
    .await
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct GroupContentResponse {
    #[schema(value_type = Vec<WorkSchedule>)]
    results: Vec<WorkSchedule>,
    #[serde(flatten)]
    stats: PaginationStats,
}

#[derive(Debug, Clone, serde::Deserialize, utoipa::IntoParams)]
#[into_params(parameter_in = Query)]
pub struct WorkScheduleOrderingParam {
    #[serde(default)]
    pub ordering: Ordering,
}

#[utoipa::path(
    get, path = "",
    tag = "work_schedules",
    params(PaginationQueryParams, WorkScheduleGroupIdParam, WorkScheduleOrderingParam),
    responses(
        (status = 200, description = "The work schedules in the group", body = inline(GroupContentResponse)),
        (status = 404, description = "Work schedule group not found"),
    )
)]
async fn get_group(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(WorkScheduleGroupIdParam { id: group_id }): Path<WorkScheduleGroupIdParam>,
    Query(pagination_params): Query<PaginationQueryParams>,
    Query(ordering_params): Query<WorkScheduleOrderingParam>,
) -> Result<Json<GroupContentResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::WorkScheduleRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let ordering = ordering_params.ordering;
    let settings = pagination_params
        .validate(100)?
        .into_selection_settings()
        .filter(move || WorkSchedule::WORK_SCHEDULE_GROUP_ID.eq(group_id))
        .order_by(move || ordering.as_work_schedule_ordering());

    let conn = &mut db_pool.get().await?;

    // Check that the group exists
    WorkScheduleGroup::retrieve_or_fail(conn, group_id, || {
        WorkScheduleError::WorkScheduleGroupNotFound { id: group_id }
    })
    .await?;

    let (work_schedules, stats) = WorkSchedule::list_paginated(conn, settings).await?;

    Ok(Json(GroupContentResponse {
        results: work_schedules,
        stats,
    }))
}

#[cfg(test)]
pub mod tests {
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
                "start_date_time": "2024-01-01T08:00:00Z",
                "end_date_time": "2024-01-01T09:00:00Z",
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
                "start_date_time": "2024-01-01T08:00:00Z",
                "end_date_time": "2024-01-01T07:00:00Z",
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
            .creation_date(Utc::now())
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create work schedule group");

        let request = app.post("/work_schedules").json(&json!({
            "work_schedule_group_name": "duplicated work schedule group name",
            "work_schedules": [{
                "start_date_time": "2024-01-01T08:00:00Z",
                "end_date_time": "2024-01-01T09:00:00Z",
                "track_ranges": [],
                "obj_id": "work_schedule_obj_id",
                "work_schedule_type": "CATENARY"
            }]
        }));

        let work_schedule_response = app
            .fetch(request)
            .assert_status(StatusCode::BAD_REQUEST)
            .json_into::<crate::error::InternalError>();

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
                        .unwrap()
                        .and_utc();
                let end_date_time =
                    NaiveDate::from_ymd_opt(2024, 1, (index + 2).try_into().unwrap())
                        .unwrap()
                        .and_hms_opt(0, 0, 0)
                        .unwrap()
                        .and_utc();
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

    #[rstest]
    async fn work_schedule_endpoints_workflow() {
        let app = TestAppBuilder::default_app();

        // Create a new group
        let create_group_request = app.post("/work_schedules/group").json(&json!({}));
        let group_creation_response = app
            .fetch(create_group_request)
            .assert_status(StatusCode::OK)
            .json_into::<WorkScheduleGroupCreateResponse>();
        let group_id = group_creation_response.work_schedule_group_id;
        let work_schedule_url = format!("/work_schedules/group/{group_id}");

        // Add a work schedule
        let ref_obj_id = Uuid::new_v4().to_string();
        let request = app.put(&work_schedule_url).json(&json!([{
                "start_date_time": "2024-01-01T08:00:00Z",
                "end_date_time": "2024-01-01T09:00:00Z",
                "track_ranges": [],
                "obj_id": ref_obj_id,
                "work_schedule_type": "CATENARY"
            }]
        ));
        app.fetch(request).assert_status(StatusCode::OK);

        // Get the content of the group
        let request = app.get(&work_schedule_url);
        let response = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<GroupContentResponse>();
        let work_schedules = response.results;
        assert_eq!(1, work_schedules.len());
        assert_eq!(ref_obj_id, work_schedules[0].obj_id);

        // Delete it
        let request = app.delete(&work_schedule_url);
        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        // Try to access it
        let request = app.get(&work_schedule_url);
        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }
}
