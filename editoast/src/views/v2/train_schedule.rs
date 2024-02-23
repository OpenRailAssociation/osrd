use std::collections::HashSet;

use crate::error::Result;
use crate::modelsv2::train_schedule::{TrainSchedule, TrainScheduleChangeset};
use crate::modelsv2::Model;
use crate::schema::v2::trainschedule::{Distribution, TrainScheduleBase};
use crate::DbPool;
use actix_web::web::{Data, Json, Path};
use actix_web::{delete, get, post, put, HttpResponse};
use editoast_derive::EditoastError;
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use utoipa::{IntoParams, ToSchema};

crate::routes! {
    "/v2/train_schedule" => {
        post,
        delete,
        "/{id}" => {
            get,
            put,
        }
    },
}

crate::schemas! {
    Distribution,
    TrainScheduleBase,
    TrainScheduleForm,
    TrainScheduleResult,
    BatchDeletionRequest,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule_v2")]
pub enum TrainScheduleError {
    #[error("Train Schedule '{train_schedule_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { train_schedule_id: i64 },
    #[error("{number} train schedule(s) could not be found")]
    #[editoast_error(status = 404)]
    BatchTrainScheduleNotFound { number: usize },
}

#[derive(IntoParams, Deserialize)]
struct TrainScheduleIdParam {
    /// A train schedule ID
    id: i64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
struct TrainScheduleResult {
    id: i64,
    timetable_id: i64,
    #[serde(flatten)]
    train_schedule: TrainScheduleBase,
}

impl From<TrainSchedule> for TrainScheduleResult {
    fn from(value: TrainSchedule) -> Self {
        Self {
            id: value.id,
            timetable_id: value.timetable_id,
            train_schedule: TrainScheduleBase {
                train_name: value.train_name,
                labels: value.labels.into_iter().flatten().collect(),
                rolling_stock_name: value.rolling_stock_name,
                start_time: value.start_time,
                schedule: value.schedule,
                margins: value.margins,
                initial_speed: value.initial_speed,
                comfort: value.comfort,
                path: value.path,
                constraint_distribution: value.constraint_distribution,
                speed_limit_tag: value.speed_limit_tag.map(Into::into),
                power_restrictions: value.power_restrictions,
                options: value.options,
            },
        }
    }
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrainScheduleForm {
    pub timetable_id: i64,
    #[serde(flatten)]
    pub train_schedule: TrainScheduleBase,
}

impl From<TrainScheduleForm> for TrainScheduleChangeset {
    fn from(value: TrainScheduleForm) -> Self {
        let TrainScheduleForm {
            timetable_id,
            train_schedule: ts,
        } = value;

        TrainSchedule::changeset()
            .timetable_id(timetable_id)
            .comfort(ts.comfort)
            .constraint_distribution(ts.constraint_distribution)
            .initial_speed(ts.initial_speed)
            .labels(ts.labels.into_iter().map(Some).collect())
            .margins(ts.margins)
            .path(ts.path)
            .power_restrictions(ts.power_restrictions)
            .rolling_stock_name(ts.rolling_stock_name)
            .schedule(ts.schedule)
            .speed_limit_tag(ts.speed_limit_tag.map(|s| s.0))
            .start_time(ts.start_time)
            .train_name(ts.train_name)
            .options(ts.options)
    }
}

#[derive(Debug, Deserialize, ToSchema)]
struct BatchDeletionRequest {
    ids: HashSet<i64>,
}

/// Create train schedule by batch
#[utoipa::path(
    tag = "train_schedulev2",
    request_body = Vec<TrainScheduleForm>,
    responses(
        (status = 200, description = "The train schedule", body = Vec<TrainScheduleResult>)
    )
)]
#[post("")]
async fn post(
    db_pool: Data<DbPool>,
    data: Json<Vec<TrainScheduleForm>>,
) -> Result<Json<Vec<TrainScheduleResult>>> {
    use crate::modelsv2::CreateBatch;

    let changesets: Vec<TrainScheduleChangeset> =
        data.into_inner().into_iter().map_into().collect();
    let conn = &mut db_pool.get().await?;

    // Create a batch of train_schedule
    let train_schedule: Vec<_> = TrainSchedule::create_batch(conn, changesets).await?;
    Ok(Json(train_schedule.into_iter().map_into().collect()))
}

/// Return a specific timetable with its associated schedules
#[utoipa::path(
    tag = "train_schedulev2",
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule", body = TrainScheduleResult)
    )
)]
#[get("")]
async fn get(
    db_pool: Data<DbPool>,
    train_schedule_id: Path<TrainScheduleIdParam>,
) -> Result<Json<TrainScheduleResult>> {
    use crate::modelsv2::Retrieve;

    let train_schedule_id = train_schedule_id.id;
    let conn = &mut db_pool.get().await?;

    // Return the timetable
    let train_schedule = TrainSchedule::retrieve_or_fail(conn, train_schedule_id, || {
        TrainScheduleError::NotFound { train_schedule_id }
    })
    .await?;
    Ok(Json(train_schedule.into()))
}

/// Delete a train schedule and its result
#[utoipa::path(
    tag = "train_schedulev2",
    request_body = inline(BatchDeletionRequest),
    responses(
        (status = 204, description = "All train schedules have been deleted")
    )
)]
#[delete("")]
async fn delete(db_pool: Data<DbPool>, data: Json<BatchDeletionRequest>) -> Result<HttpResponse> {
    use crate::modelsv2::DeleteBatch;

    let conn = &mut db_pool.get().await?;
    let train_ids = data.into_inner().ids;
    TrainSchedule::delete_batch_or_fail(conn, train_ids, |number| {
        TrainScheduleError::BatchTrainScheduleNotFound { number }
    })
    .await?;

    Ok(HttpResponse::NoContent().finish())
}

/// Update  train schedule at once
#[utoipa::path(
    tag = "train_schedulev2,timetable",
    request_body = TrainScheduleForm,
    params(TrainScheduleIdParam),
    responses(
        (status = 200, description = "The train schedule have been updated", body = TrainScheduleResult)
    )
)]
#[put("")]
async fn put(
    db_pool: Data<DbPool>,
    train_schedule_id: Path<TrainScheduleIdParam>,
    data: Json<TrainScheduleForm>,
) -> Result<Json<TrainScheduleResult>> {
    use crate::modelsv2::Update;
    let conn = &mut db_pool.get().await?;

    let train_id = train_schedule_id.id;
    let ts_changeset: TrainScheduleChangeset = data.into_inner().into();

    let ts_result = ts_changeset
        .update_or_fail(conn, train_id, || TrainScheduleError::NotFound {
            train_schedule_id: train_id,
        })
        .await?;

    Ok(Json(ts_result.into()))
}

#[cfg(test)]
mod tests {

    use super::*;
    use crate::fixtures::tests::{
        db_pool, timetable_v2, train_schedule_v2, TestFixture, TrainScheduleV2FixtureSet,
    };
    use crate::modelsv2::timetable::Timetable;
    use crate::modelsv2::{Delete, DeleteStatic};
    use crate::views::tests::create_test_service;
    use actix_web::test::{call_and_read_body_json, call_service, TestRequest};
    use rstest::rstest;
    use serde_json::json;

    #[rstest]
    async fn get_trainschedule(
        #[future] train_schedule_v2: TrainScheduleV2FixtureSet,
        db_pool: Data<DbPool>,
    ) {
        let service = create_test_service().await;
        let fixture = train_schedule_v2.await;
        let url = format!("/v2/train_schedule/{}", fixture.train_schedule.id());

        // Should succeed
        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_success());

        // Delete the train_schedule
        assert!(fixture
            .train_schedule
            .model
            .delete(&mut db_pool.get().await.unwrap())
            .await
            .unwrap());

        // Should fail
        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_client_error());
    }

    #[rstest]
    async fn train_schedule_post(
        #[future] timetable_v2: TestFixture<Timetable>,
        db_pool: Data<DbPool>,
    ) {
        let service = create_test_service().await;

        let timetable = timetable_v2.await;
        // Insert train_schedule
        let train_schedule_base: TrainScheduleBase =
            serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                .expect("Unable to parse");
        let train_schedule = TrainScheduleForm {
            timetable_id: timetable.id(),
            train_schedule: train_schedule_base,
        };
        let request = TestRequest::post()
            .uri("/v2/train_schedule")
            .set_json(json!(vec![train_schedule]))
            .to_request();
        let response: Vec<TrainScheduleResult> = call_and_read_body_json(&service, request).await;
        assert_eq!(response.len(), 1);
        let train_id = response[0].id;

        // Delete the train_schedule
        assert!(
            TrainSchedule::delete_static(&mut db_pool.get().await.unwrap(), train_id)
                .await
                .is_ok()
        );
    }

    #[rstest]
    async fn train_schedule_delete(#[future] train_schedule_v2: TrainScheduleV2FixtureSet) {
        let fixture = train_schedule_v2.await;
        let service = create_test_service().await;
        let request = TestRequest::delete()
            .uri("/v2/train_schedule/")
            .set_json(json!({"ids": vec![fixture.train_schedule.id()]}))
            .to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_success());

        // Delete should fail

        let request = TestRequest::delete()
            .uri("/v2/train_schedule/")
            .set_json(json!({"ids": vec![fixture.train_schedule.id()]}))
            .to_request();
        assert_eq!(call_service(&service, request).await.status().as_u16(), 404);
    }

    #[rstest]
    async fn train_schedule_put(#[future] train_schedule_v2: TrainScheduleV2FixtureSet) {
        let TrainScheduleV2FixtureSet {
            timetable,
            train_schedule,
        } = train_schedule_v2.await;
        let service = create_test_service().await;
        let rs_name = String::from("NEW ROLLING_STOCK");
        let train_schedule_base: TrainScheduleBase = TrainScheduleBase {
            rolling_stock_name: rs_name.clone(),
            ..serde_json::from_str(include_str!("../../tests/train_schedules/simple.json"))
                .expect("Unable to parse")
        };
        let train_schedule_form = TrainScheduleForm {
            timetable_id: timetable.id(),
            train_schedule: train_schedule_base,
        };
        let request = TestRequest::put()
            .uri(format!("/v2/train_schedule/{}", train_schedule.id()).as_str())
            .set_json(json!(train_schedule_form))
            .to_request();

        let response: TrainScheduleResult = call_and_read_body_json(&service, request).await;
        assert_eq!(response.train_schedule.rolling_stock_name, rs_name)
    }
}
