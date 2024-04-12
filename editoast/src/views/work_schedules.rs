use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use chrono::NaiveDateTime;
use chrono::Utc;
use derivative::Derivative;
use editoast_derive::EditoastError;
use serde::de::Error as SerdeError;
use serde::Deserialize;
use serde::Serialize;
use std::result::Result as StdResult;
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::error::Result;
use crate::modelsv2::work_schedules::WorkSchedule;
use crate::modelsv2::work_schedules::WorkScheduleGroup;
use crate::modelsv2::work_schedules::WorkScheduleType;
use crate::modelsv2::Changeset;
use crate::modelsv2::Create;
use crate::modelsv2::CreateBatch;
use crate::modelsv2::Model;
use crate::DbPool;
use editoast_schemas::infra::TrackRange;

crate::routes! {
    "/work_schedules" => {
        create,
    }
}

editoast_common::schemas! {
    WorkScheduleCreateForm,
    WorkScheduleCreateResponse,
    WorkScheduleItemForm,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "work_schedule")]
pub enum WorkScheduleError {
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
    tag = "work_schedules",
    request_body = WorkScheduleCreateForm,
    responses(
        (status = 201, body = WorkScheduleCreateResponse, description = "The id of the created work schedule group"),
    )
)]
#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<WorkScheduleCreateForm>,
) -> Result<Json<WorkScheduleCreateResponse>> {
    let conn = &mut db_pool.get().await?;

    let work_schedule_create_form = data.into_inner();

    // Create the work_schedule_group
    let work_schedule_group = WorkScheduleGroup::changeset()
        .name(work_schedule_create_form.work_schedule_group_name.clone())
        .creation_date(Utc::now().naive_utc())
        .create(conn)
        .await;
    let work_schedule_group = work_schedule_group
        .map_err(|e| map_diesel_error(e, work_schedule_create_form.work_schedule_group_name))?;

    // Create work schedules
    let work_schedules_changesets = work_schedule_create_form
        .work_schedules
        .into_iter()
        .map(|work_schedule| work_schedule.into_work_schedule_changeset(work_schedule_group.id))
        .collect::<Vec<_>>();
    let _work_schedules: Vec<_> =
        WorkSchedule::create_batch(conn, work_schedules_changesets).await?;

    Ok(Json(WorkScheduleCreateResponse {
        work_schedule_group_id: work_schedule_group.id,
    }))
}

#[cfg(test)]
pub mod test {
    use actix_web::http::StatusCode;
    use actix_web::test::{call_service, read_body_json, TestRequest};
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::assert_response_error_type_match;
    use crate::fixtures::tests::{db_pool, TestFixture};
    use crate::modelsv2::Retrieve;
    use crate::views::tests::create_test_service;

    async fn create_work_schedule_group_fixture(
        db_pool: Data<DbPool>,
        work_schedule_response: WorkScheduleCreateResponse,
    ) -> TestFixture<WorkScheduleGroup> {
        let mut conn = db_pool.get().await.unwrap();
        let created_group =
            WorkScheduleGroup::retrieve(&mut conn, work_schedule_response.work_schedule_group_id)
                .await
                .unwrap();
        assert!(created_group.is_some());
        TestFixture::new(created_group.unwrap(), db_pool.clone())
    }

    #[rstest]
    async fn work_schedule_create(db_pool: Data<DbPool>) {
        // GIVEN
        let app = create_test_service().await;
        let req = TestRequest::post()
            .uri("/work_schedules")
            .set_json(json!({
                "work_schedule_group_name": "work schedule group name",
                "work_schedules": [{
                    "start_date_time": "2024-01-01T08:00:00",
                    "end_date_time": "2024-01-01T09:00:00",
                    "track_ranges": [],
                    "obj_id": "work_schedule_obj_id",
                    "work_schedule_type": "CATENARY"
                }]
            }))
            .to_request();

        // WHEN
        let response = call_service(&app, req).await;

        // THEN
        assert_eq!(response.status(), StatusCode::OK);
        let work_schedule_response: WorkScheduleCreateResponse = read_body_json(response).await;
        let _fixture =
            create_work_schedule_group_fixture(db_pool.clone(), work_schedule_response).await;
    }

    #[rstest]
    async fn work_schedule_create_fail_start_date_after_end_date() {
        // GIVEN
        let app = create_test_service().await;
        let req = TestRequest::post()
            .uri("/work_schedules")
            .set_json(json!({
                "work_schedule_group_name": "work schedule group name",
                "work_schedules": [{
                    "start_date_time": "2024-01-01T08:00:00",
                    "end_date_time": "2024-01-01T07:00:00",
                    "track_ranges": [],
                    "obj_id": "work_schedule_obj_id",
                    "work_schedule_type": "CATENARY"
                }]
            }))
            .to_request();

        // WHEN
        let response = call_service(&app, req).await;

        // THEN
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn work_schedule_create_fail_name_already_used(db_pool: Data<DbPool>) {
        // GIVEN
        let app = create_test_service().await;
        let payload = json!({
            "work_schedule_group_name": "duplicated work schedule group name",
            "work_schedules": [{
                "start_date_time": "2024-01-01T08:00:00",
                "end_date_time": "2024-01-01T09:00:00",
                "track_ranges": [],
                "obj_id": "work_schedule_obj_id",
                "work_schedule_type": "CATENARY"
            }]
        });

        let req = TestRequest::post()
            .uri("/work_schedules")
            .set_json(payload.clone())
            .to_request();
        let first_response = call_service(&app, req).await;
        assert_eq!(first_response.status(), StatusCode::OK);
        let work_schedule_response: WorkScheduleCreateResponse =
            read_body_json(first_response).await;
        let _fixture =
            create_work_schedule_group_fixture(db_pool.clone(), work_schedule_response).await;

        // WHEN
        let req = TestRequest::post()
            .uri("/work_schedules")
            .set_json(payload.clone())
            .to_request();

        // THEN
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_response_error_type_match!(
            response,
            WorkScheduleError::NameAlreadyUsed {
                name: String::from("duplicated work schedule group name"),
            }
        );
    }
}
