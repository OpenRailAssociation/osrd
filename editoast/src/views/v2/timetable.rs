use actix_web::delete;
use actix_web::get;
use actix_web::post;
use actix_web::put;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use actix_web::HttpResponse;
use chrono::DateTime;
use chrono::Utc;
use derivative::Derivative;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::decl_paginated_response;
use crate::error::Result;
use crate::models::List;
use crate::models::NoParams;
use crate::modelsv2::timetable::Timetable;
use crate::modelsv2::timetable::TimetableWithTrains;
use crate::modelsv2::Create;
use crate::modelsv2::DeleteStatic;
use crate::modelsv2::Model;
use crate::modelsv2::Retrieve;
use crate::modelsv2::Update;
use crate::views::pagination::PaginatedResponse;
use crate::views::pagination::PaginationQueryParam;
use crate::views::timetable::ConflictType;
use crate::CoreClient;
use crate::DbPool;
use crate::RedisClient;

crate::routes! {
    "/v2/timetable" => {
        post,
        list,
        "/{id}" => {
            delete,
            get,
            put,
            conflicts,
        }
    },
}

editoast_common::schemas! {
    PaginatedResponseOfTimetable,
    TimetableForm,
    TimetableResult,
    TimetableDetailedResult,
    Conflict,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "timetable")]
enum TimetableError {
    #[error("Timetable '{timetable_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { timetable_id: i64 },
}

/// Creation form for a Timetable
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct TimetableForm {
    #[serde(default)]
    pub electrical_profile_set_id: Option<i64>,
}

/// Creation form for a Timetable
#[derive(Debug, Default, Serialize, Deserialize, Derivative, ToSchema)]
struct TimetableResult {
    pub id: i64,
    pub electrical_profile_set_id: Option<i64>,
}

impl From<Timetable> for TimetableResult {
    fn from(timetable: Timetable) -> Self {
        Self {
            id: timetable.id,
            electrical_profile_set_id: timetable.electrical_profile_set_id,
        }
    }
}

/// Creation form for a Timetable
#[derive(Debug, Default, Serialize, Deserialize, Derivative, ToSchema)]
struct TimetableDetailedResult {
    #[serde(flatten)]
    #[schema(inline)]
    pub timetable: TimetableResult,
    pub train_ids: Vec<i64>,
}

impl From<TimetableWithTrains> for TimetableDetailedResult {
    fn from(val: TimetableWithTrains) -> Self {
        Self {
            timetable: TimetableResult {
                id: val.id,
                electrical_profile_set_id: val.electrical_profile_set_id,
            },
            train_ids: val.train_ids,
        }
    }
}

#[derive(IntoParams, Deserialize)]
struct TimetableIdParam {
    /// A timetable ID
    id: i64,
}

/// Return a specific timetable with its associated schedules
#[utoipa::path(
    tag = "timetablev2",
    params(TimetableIdParam),
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = TimetableDetailedResult),
        (status = 404, description = "Timetable not found"),
    ),
)]
#[get("")]
async fn get(
    db_pool: Data<DbPool>,
    timetable_id: Path<TimetableIdParam>,
) -> Result<Json<TimetableDetailedResult>> {
    let timetable_id = timetable_id.id;
    // Return the timetable

    let conn = &mut db_pool.get().await?;
    let timetable = TimetableWithTrains::retrieve_or_fail(conn, timetable_id, || {
        TimetableError::NotFound { timetable_id }
    })
    .await?;

    Ok(Json(timetable.into()))
}

decl_paginated_response!(PaginatedResponseOfTimetable, TimetableResult);
/// Return all timetables
#[utoipa::path(
    tag = "timetablev2",
    params(PaginationQueryParam),
    responses(
        (status = 200, description = "List timetables", body = PaginatedResponseOfTimetable),
    ),
)]
#[get("")]
async fn list(
    db_pool: Data<DbPool>,
    pagination_params: Query<PaginationQueryParam>,
) -> Result<Json<PaginatedResponse<TimetableResult>>> {
    let (page, per_page) = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .unpack();
    let conn = &mut db_pool.get().await?;
    let timetable = Timetable::list_conn(conn, page, per_page, NoParams).await?;
    Ok(Json(timetable.into()))
}

/// Return a specific timetable with its associated schedules
#[utoipa::path(
    tag = "timetablev2",
    request_body = TimetableForm,
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = TimetableResult),
        (status = 404, description = "Timetable not found"),
    ),
)]
#[post("")]
async fn post(db_pool: Data<DbPool>, data: Json<TimetableForm>) -> Result<Json<TimetableResult>> {
    let conn = &mut db_pool.get().await?;

    let elec_profile_set = data.into_inner().electrical_profile_set_id;
    let changeset = Timetable::changeset().electrical_profile_set_id(elec_profile_set);
    let timetable = changeset.create(conn).await?;

    Ok(Json(timetable.into()))
}

/// Update a specific timetable with its associated schedules
#[utoipa::path(
    tag = "timetablev2",
    params(TimetableIdParam),
    responses(
        (status = 200, description = "Timetable with train schedules ids", body = TimetableDetailedResult),
        (status = 404, description = "Timetable not found"),
    ),
)]
#[put("")]
async fn put(
    db_pool: Data<DbPool>,
    timetable_id: Path<TimetableIdParam>,
    data: Json<TimetableForm>,
) -> Result<Json<TimetableDetailedResult>> {
    let timetable_id = timetable_id.id;
    let conn = &mut db_pool.get().await?;

    let elec_profile_set = data.into_inner().electrical_profile_set_id;
    let changeset = Timetable::changeset().electrical_profile_set_id(elec_profile_set);
    changeset
        .update_or_fail(conn, timetable_id, || TimetableError::NotFound {
            timetable_id,
        })
        .await?;

    let timetable = TimetableWithTrains::retrieve_or_fail(conn, timetable_id, || {
        TimetableError::NotFound { timetable_id }
    })
    .await?;
    Ok(Json(timetable.into()))
}

/// Return a specific timetable with its associated schedules
#[utoipa::path(
    tag = "timetablev2",
    params(TimetableIdParam),
    responses(
        (status = 204, description = "No content"),
        (status = 404, description = "Timetable not found"),
    ),
)]
#[delete("")]
async fn delete(
    db_pool: Data<DbPool>,
    timetable_id: Path<TimetableIdParam>,
) -> Result<HttpResponse> {
    let timetable_id = timetable_id.id;
    let conn = &mut db_pool.get().await?;
    Timetable::delete_static_or_fail(conn, timetable_id, || TimetableError::NotFound {
        timetable_id,
    })
    .await?;
    Ok(HttpResponse::NoContent().finish())
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as=ConflictV2)]
pub struct Conflict {
    pub train_ids: Vec<i64>,
    pub train_names: Vec<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub conflict_type: ConflictType,
}

/// Retrieve the list of conflict of the timetable (invalid trains are ignored)
#[utoipa::path(
    tag = "timetablev2",
    params(
        ("id" = i64, Path, description = "The timetable id"),
        ("infra_id" = i64, Query, description = "The infra id"),
    ),
    responses(
        (status = 200, description = "list of conflict", body = Vec<ConflictV2>),
    ),
)]
#[get("/conflicts")]
pub async fn conflicts(
    _db_pool: Data<DbPool>,
    _redis_client: Data<RedisClient>,
    _core_client: Data<CoreClient>,
    _infra_id: Query<i64>,
) -> Result<Json<Vec<Conflict>>> {
    // TODO
    // issue: https://github.com/OpenRailAssociation/osrd/issues/6854
    Ok(Json(vec![Conflict {
        train_ids: vec![0, 1],
        train_names: vec!["train.1".into(), "train.2".into()],
        start_time: DateTime::from_timestamp(1710496800, 0).expect("invalid timestamp"),
        end_time: DateTime::from_timestamp(1710497400, 0).expect("invalid timestamp"),
        conflict_type: ConflictType::Routing,
    }]))
}

#[cfg(test)]
mod tests {

    use actix_web::test::call_and_read_body_json;
    use actix_web::test::call_service;
    use actix_web::test::TestRequest;
    use rstest::rstest;
    use serde_json::json;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::timetable_v2;
    use crate::fixtures::tests::TestFixture;
    use crate::modelsv2::Delete;
    use crate::views::tests::create_test_service;

    #[rstest]
    async fn get_timetable(#[future] timetable_v2: TestFixture<Timetable>, db_pool: Data<DbPool>) {
        let service = create_test_service().await;
        let timetable = timetable_v2.await;

        let url = format!("/v2/timetable/{}", timetable.id());

        // Should succeed
        let request = TestRequest::get().uri(&url).to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_success());

        // Delete the timetable
        assert!(timetable
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
    async fn timetable_post(db_pool: Data<DbPool>) {
        let service = create_test_service().await;

        // Insert timetable
        let request = TestRequest::post()
            .uri("/v2/timetable")
            .set_json(json!({ "electrical_profil_set_id": None::<i64>}))
            .to_request();
        let response: TimetableResult = call_and_read_body_json(&service, request).await;

        // Delete the timetable
        assert!(
            Timetable::delete_static(&mut db_pool.get().await.unwrap(), response.id)
                .await
                .unwrap()
        );
    }

    #[rstest]
    async fn timetable_delete(#[future] timetable_v2: TestFixture<Timetable>) {
        let timetable = timetable_v2.await;
        let service = create_test_service().await;
        let request = TestRequest::delete()
            .uri(format!("/v2/timetable/{}", timetable.id()).as_str())
            .to_request();
        assert!(call_service(&service, request).await.status().is_success());
    }

    #[rstest]
    async fn timetable_list(#[future] timetable_v2: TestFixture<Timetable>) {
        timetable_v2.await;
        let service = create_test_service().await;
        let request = TestRequest::get().uri("/v2/timetable/").to_request();
        assert!(call_service(&service, request).await.status().is_success());
    }
}
