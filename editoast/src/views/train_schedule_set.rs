use axum::extract::Query;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use itertools::Itertools;
use schemas::paced_train::TrainSchedule;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::timetable::train_schedule::TrainScheduleResponse;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use editoast_models::TrainScheduleSet;
use editoast_models::train_schedule::TrainScheduleChangeset;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "train_schedule_set")]
pub enum TrainScheduleSetError {
    #[error("Train schedule set '{train_schedule_set_id}' could not be found")]
    #[editoast_error(status = 404)]
    NotFound { train_schedule_set_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[derive(Serialize, Deserialize, ToSchema, Debug, PartialEq)]
pub(in crate::views) struct TrainScheduleSetResponse {
    #[serde(flatten)]
    train_schedule_set: TrainScheduleSet,
    train_schedule_count: u64,
}

impl TrainScheduleSetResponse {
    pub async fn try_fetch(
        conn: &mut DbConnection,
        train_schedule_set: TrainScheduleSet,
    ) -> Result<Self> {
        let train_schedule_count =
            TrainScheduleSet::train_schedule_count(train_schedule_set.id, conn).await? as u64;
        Ok(Self {
            train_schedule_set,
            train_schedule_count,
        })
    }
}
#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleSetForm {
    catalog_entry_id: Option<i64>,
    name: Option<String>,
    description: String,
    published: bool,
    timetable_type: schemas::timetable_type::TimetableType,
}

impl TrainScheduleSetForm {
    pub fn into_changeset(self) -> Changeset<TrainScheduleSet> {
        TrainScheduleSet::changeset()
            .catalog_entry_id(self.catalog_entry_id)
            .name(self.name)
            .description(self.description)
            .published(self.published)
            .timetable_type(editoast_models::timetable_type::TimetableType(
                self.timetable_type,
            ))
    }
}

#[derive(IntoParams, Deserialize)]
pub(in crate::views) struct TrainScheduleSetIdParam {
    /// A train schedule set ID
    id: i64,
}

#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "train_schedule_set",
    request_body = TrainScheduleSetForm,
    responses(
        (status = 201, description = "Train schedule set", body = TrainScheduleSetResponse),
    ),
)]
pub(in crate::views) async fn post(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Json(train_schedule_set_form): Json<TrainScheduleSetForm>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;
    let changeset = train_schedule_set_form.into_changeset();
    let train_schedule_set = changeset.create(conn).await?;

    Ok((
        StatusCode::CREATED,
        Json(TrainScheduleSetResponse {
            train_schedule_set,
            train_schedule_count: 0,
        }),
    ))
}

#[derive(IntoParams, Serialize, Deserialize, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct TrainScheduleSetQueryParams {
    catalog_entry_id: Option<i64>,
    published: Option<bool>,
    timetable_type: Option<schemas::timetable_type::TimetableType>,
}

#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "train_schedule_set",
    params(TrainScheduleSetIdParam),
    responses(
        (status = 200, description = "Train schedule set", body = TrainScheduleSetResponse),
        (status = 404, description = "Train schedule set not found"),
    ),
)]
pub(in crate::views) async fn get_by_id(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(TrainScheduleSetIdParam {
        id: train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
) -> Result<Json<TrainScheduleSetResponse>> {
    let train_schedule_set =
        TrainScheduleSet::retrieve_or_fail(db_pool.get().await?, train_schedule_set_id, || {
            TrainScheduleSetError::NotFound {
                train_schedule_set_id,
            }
        })
        .await?;

    let train_schedule_set_response =
        TrainScheduleSetResponse::try_fetch(&mut db_pool.get().await?, train_schedule_set).await?;
    Ok(Json(train_schedule_set_response))
}

#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tag = "train_schedule_set",
    params(TrainScheduleSetQueryParams),
    responses(
        (status = 200, description = "list of train schedule sets", body = inline(Vec<TrainScheduleSetResponse>)),
    ),
)]
pub(in crate::views) async fn get(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Query(TrainScheduleSetQueryParams {
        catalog_entry_id,
        published,
        timetable_type,
    }): Query<TrainScheduleSetQueryParams>,
) -> Result<Json<Vec<TrainScheduleSetResponse>>> {
    let conn = &mut db_pool.get().await?;

    let mut settings = SelectionSettings::new();

    if let Some(catalog_entry_id) = catalog_entry_id {
        settings =
            settings.filter(move || TrainScheduleSet::CATALOG_ENTRY_ID.eq(Some(catalog_entry_id)));
    }

    if let Some(published) = published {
        settings = settings.filter(move || TrainScheduleSet::PUBLISHED.eq(published));
    }

    if let Some(timetable_type) = timetable_type {
        settings = settings.filter(move || {
            TrainScheduleSet::TIMETABLE_TYPE.eq(editoast_models::timetable_type::TimetableType(
                timetable_type,
            ))
        });
    }

    let train_schedule_sets = TrainScheduleSet::list(conn, settings).await?;

    let results = train_schedule_sets
        .into_iter()
        .zip(db_pool.iter_conn())
        .map(|(train_schedule_set, conn)| async move {
            TrainScheduleSetResponse::try_fetch(&mut conn.await?, train_schedule_set).await
        });

    let results = futures::future::try_join_all(results).await?;
    Ok(Json(results))
}

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleSetUpdateForm {
    catalog_entry_id: Option<i64>,
    name: Option<String>,
    description: String,
    published: bool,
}

impl TrainScheduleSetUpdateForm {
    pub fn into_changeset(self) -> Changeset<TrainScheduleSet> {
        TrainScheduleSet::changeset()
            .catalog_entry_id(self.catalog_entry_id)
            .name(self.name)
            .description(self.description)
            .published(self.published)
    }
}
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    put, path = "",
    tag = "train_schedule_set",
    params(TrainScheduleSetIdParam),
    request_body = TrainScheduleSetUpdateForm,
    responses(
        (status = 200, description = "Train schedule set", body = TrainScheduleSetResponse),
        (status = 404, description = "Train schedule set not found"),
    ),
)]
pub(in crate::views) async fn put(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(TrainScheduleSetIdParam {
        id: train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
    Json(train_schedule_set_form): Json<TrainScheduleSetUpdateForm>,
) -> Result<Json<TrainScheduleSetResponse>> {
    let conn = &mut db_pool.get().await?;
    let changeset = train_schedule_set_form.into_changeset();
    let train_schedule_set = changeset
        .update_or_fail(conn, train_schedule_set_id, || {
            TrainScheduleSetError::NotFound {
                train_schedule_set_id,
            }
        })
        .await?;

    let train_schedule_set_response =
        TrainScheduleSetResponse::try_fetch(&mut db_pool.get().await?, train_schedule_set).await?;

    Ok(Json(train_schedule_set_response))
}

#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    delete, path = "",
        tag = "train_schedule_set",
    params(TrainScheduleSetIdParam),
    responses(
        (status = 204, description = "the train schedule set is deleted"),
        (status = 404, description = "Train schedule set not found"),
    ),
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(TrainScheduleSetIdParam {
        id: train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
) -> Result<impl IntoResponse> {
    TrainScheduleSet::delete_static_or_fail(
        &mut db_pool.get().await?,
        train_schedule_set_id,
        || TrainScheduleSetError::NotFound {
            train_schedule_set_id,
        },
    )
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Create train schedules by batch
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tags = ["train_schedule_set", "train_schedule"],
    params(TrainScheduleSetIdParam),
    request_body = Vec<TrainSchedule>,
    responses(
        (status = 201, description = "The created train schedules", body = Vec<TrainScheduleResponse>)
    )
)]
pub(in crate::views) async fn post_train_schedule(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(TrainScheduleSetIdParam {
        id: train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
    Json(train_schedules): Json<Vec<TrainSchedule>>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;

    let train_schedule_set_exists = TrainScheduleSet::exists(conn, train_schedule_set_id).await?;
    if !train_schedule_set_exists {
        return Err(TrainScheduleSetError::NotFound {
            train_schedule_set_id,
        }
        .into());
    }

    let changesets = train_schedules
        .into_iter()
        .map(TrainScheduleChangeset::from)
        .map(|cs| cs.train_schedule_set_id(train_schedule_set_id))
        .collect::<Vec<_>>();

    // Create a batch of train schedules
    let train_schedules: Vec<_> =
        editoast_models::TrainSchedule::create_batch(conn, changesets).await?;
    let response: Vec<TrainScheduleResponse> = train_schedules.into_iter().map_into().collect();

    Ok((StatusCode::CREATED, Json(response)))
}

/// List train schedules for a train schedule set
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    get, path = "",
    tags = ["train_schedule_set", "train_schedule"],
    params(TrainScheduleSetIdParam),
    responses(
        (status = 200, description = "The train schedules", body = Vec<TrainScheduleResponse>),
        (status = 404, description = "Train schedule set not found"),
    )
)]
pub(in crate::views) async fn get_train_schedules(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(TrainScheduleSetIdParam {
        id: train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
) -> Result<Json<Vec<TrainScheduleResponse>>> {
    let conn = &mut db_pool.get().await?;

    let train_schedule_set_exists = TrainScheduleSet::exists(conn, train_schedule_set_id).await?;
    if !train_schedule_set_exists {
        return Err(TrainScheduleSetError::NotFound {
            train_schedule_set_id,
        }
        .into());
    }

    let settings = SelectionSettings::new().filter(move || {
        editoast_models::TrainSchedule::TRAIN_SCHEDULE_SET_ID.eq(train_schedule_set_id)
    });

    let train_schedules = editoast_models::TrainSchedule::list(conn, settings).await?;
    Ok(Json(train_schedules.into_iter().map_into().collect()))
}

#[cfg(test)]
mod tests {

    use crate::error::InternalError;
    use crate::fixtures::create_catalog_entry;
    use crate::fixtures::create_train_schedule_set;
    use crate::fixtures::simple_paced_train_base;
    use crate::views::test_app;
    use crate::views::timetable::train_schedule::TrainScheduleResponse;
    use crate::views::train_schedule_set::TrainScheduleSetForm;
    use crate::views::train_schedule_set::TrainScheduleSetResponse;
    use crate::views::train_schedule_set::TrainScheduleSetUpdateForm;
    use chrono::Duration;
    use common::units::second;
    use database::DbConnection;
    use editoast_models::CatalogEntry;
    use editoast_models::TrainScheduleSet;
    use editoast_models::prelude::*;
    use reqwest::StatusCode;

    async fn create_train_schedule_set_linked_to_catalog_entry(
        conn: &mut DbConnection,
    ) -> (TrainScheduleSet, CatalogEntry) {
        let catalog_entry = create_catalog_entry(conn).await;
        let train_schedule_set = TrainScheduleSet::changeset()
            .catalog_entry_id(Some(catalog_entry.id))
            .name(Some("test_with_catalog_entry".into()))
            .create(conn)
            .await
            .expect("Failed to create train schedule set");
        (train_schedule_set, catalog_entry)
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_train_schedule() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let train_schedule_1 = simple_paced_train_base();
        let mut train_schedule_2 = simple_paced_train_base();
        train_schedule_2.paced.as_mut().unwrap().time_window =
            Duration::minutes(120).try_into().unwrap();
        train_schedule_2.paced.as_mut().unwrap().interval =
            Duration::seconds(30).try_into().unwrap();

        let train_schedules = vec![train_schedule_1, train_schedule_2.clone()];

        let response: Vec<TrainScheduleResponse> = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&train_schedules)
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        assert!(response.len() == 2);

        let settings = SelectionSettings::default()
            .filter(move || {
                editoast_models::TrainSchedule::TRAIN_SCHEDULE_SET_ID.eq(train_schedule_set.id)
            })
            .limit(25)
            .offset(0);

        let list_result = editoast_models::TrainSchedule::list(&mut pool.get_ok(), settings)
            .await
            .expect("Failed to fetch train schedules");

        assert!(list_result.len() == 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_train_schedule_in_hourly_train_schedule_set() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let train_schedule_set = TrainScheduleSet::changeset()
            .name(Some("hourly_train_schedule_set".into()))
            .timetable_type(editoast_models::timetable_type::TimetableType(
                schemas::timetable_type::TimetableType::Hourly,
            ))
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create train schedule set");
        let mut train_schedule_1 = simple_paced_train_base();
        let mut train_schedule_2 = simple_paced_train_base();
        train_schedule_1.train_occurrence.start_time = second::i64::new(5 * 60);
        train_schedule_2.train_occurrence.start_time = second::i64::new(5 * 60);
        train_schedule_1.paced.as_mut().unwrap().time_window =
            Duration::minutes(120).try_into().unwrap();
        train_schedule_1.paced.as_mut().unwrap().interval =
            Duration::minutes(30).try_into().unwrap();
        train_schedule_2.paced.as_mut().unwrap().time_window =
            Duration::minutes(120).try_into().unwrap();
        train_schedule_2.paced.as_mut().unwrap().interval =
            Duration::minutes(15).try_into().unwrap();

        let train_schedules = vec![train_schedule_1, train_schedule_2.clone()];

        let response: Vec<TrainScheduleResponse> = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&train_schedules)
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        assert!(response.len() == 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_unique_train_schedule_in_hourly_train_schedule_set() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let train_schedule_set = TrainScheduleSet::changeset()
            .name(Some("hourly_train_schedule_set".into()))
            .timetable_type(editoast_models::timetable_type::TimetableType(
                schemas::timetable_type::TimetableType::Hourly,
            ))
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create train schedule set");
        let mut train_schedule_1 = simple_paced_train_base();
        let mut train_schedule_2 = simple_paced_train_base();
        train_schedule_1.train_occurrence.start_time = second::i64::new(5 * 60);
        train_schedule_2.train_occurrence.start_time = second::i64::new(5 * 60);
        train_schedule_1.paced = None;
        train_schedule_2.paced.as_mut().unwrap().time_window =
            Duration::minutes(120).try_into().unwrap();
        train_schedule_2.paced.as_mut().unwrap().interval =
            Duration::minutes(30).try_into().unwrap();

        let train_schedules = vec![train_schedule_1, train_schedule_2.clone()];

        let response: InternalError = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&train_schedules)
            .await
            .assert_status_internal_server_error()
            .json();

        assert_eq!(&response.error_type, "editoast:ModelError")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_invalid_start_time_train_schedule_in_hourly_train_schedule_set() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let train_schedule_set = TrainScheduleSet::changeset()
            .name(Some("hourly_train_schedule_set".into()))
            .timetable_type(editoast_models::timetable_type::TimetableType(
                schemas::timetable_type::TimetableType::Hourly,
            ))
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create train schedule set");
        let mut train_schedule_1 = simple_paced_train_base();
        train_schedule_1.train_occurrence.start_time = second::i64::new(121 * 60);
        train_schedule_1.paced.as_mut().unwrap().time_window =
            Duration::minutes(120).try_into().unwrap();
        train_schedule_1.paced.as_mut().unwrap().interval =
            Duration::minutes(30).try_into().unwrap();

        let train_schedules = vec![train_schedule_1.clone()];

        let response: InternalError = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&train_schedules)
            .await
            .assert_status_internal_server_error()
            .json();

        assert_eq!(&response.error_type, "editoast:ModelError")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_trains_for_train_schedule_set() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let train_schedule_1 = simple_paced_train_base();
        let mut train_schedule_2 = simple_paced_train_base();
        train_schedule_2.paced.as_mut().unwrap().time_window =
            Duration::minutes(90).try_into().unwrap();
        train_schedule_2.paced.as_mut().unwrap().interval =
            Duration::seconds(45).try_into().unwrap();

        let _: Vec<TrainScheduleResponse> = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&vec![train_schedule_1, train_schedule_2])
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        let response: Vec<TrainScheduleResponse> = app
            .get(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .await
            .assert_status_ok()
            .json();

        assert_eq!(response.len(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_train_schedule_set_without_catalog_entry() {
        let app = test_app!().skip_authz().build();
        let train_schedule_set_form = TrainScheduleSetForm {
            catalog_entry_id: None,
            name: Some("test".to_string()),
            description: String::default(),
            published: false,
            timetable_type: schemas::timetable_type::TimetableType::Calendar,
        };
        let response: TrainScheduleSetResponse = app
            .post("/train_schedule_sets")
            .json(&train_schedule_set_form)
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        let expected_response = TrainScheduleSet {
            id: 1,
            catalog_entry_id: None,
            name: Some("test".to_string()),
            description: String::default(),
            published: false,
            timetable_type: Default::default(),
        };

        assert_eq!(
            response,
            TrainScheduleSetResponse {
                train_schedule_set: expected_response,
                train_schedule_count: 0
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_train_schedule_set_with_catalog_entry() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let catalog_entry = create_catalog_entry(&mut db_pool.get().await.unwrap()).await;
        let catalog_entry_id = catalog_entry.id;
        let train_schedule_set_form = TrainScheduleSetForm {
            catalog_entry_id: Some(catalog_entry_id),
            name: Some("test".to_string()),
            description: String::default(),
            published: false,
            timetable_type: schemas::timetable_type::TimetableType::Calendar,
        };
        let response: TrainScheduleSetResponse = app
            .post("/train_schedule_sets")
            .json(&train_schedule_set_form)
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        let expected_response = TrainScheduleSet {
            id: 1,
            catalog_entry_id: Some(catalog_entry_id),
            name: Some("test".to_string()),
            description: String::default(),
            published: false,
            timetable_type: editoast_models::timetable_type::TimetableType(
                schemas::timetable_type::TimetableType::Calendar,
            ),
        };

        assert_eq!(
            response,
            TrainScheduleSetResponse {
                train_schedule_set: expected_response,
                train_schedule_count: 0
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_train_schedule_set() {
        let app = test_app!().skip_authz().build();

        let db_pool = app.db_pool();
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;

        let response: TrainScheduleSetResponse = app
            .get(&format!("/train_schedule_sets/{}", train_schedule_set.id))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(
            response,
            TrainScheduleSetResponse {
                train_schedule_set: TrainScheduleSet {
                    id: 1,
                    catalog_entry_id: None,
                    name: None,
                    description: String::default(),
                    published: false,
                    timetable_type: Default::default(),
                },
                train_schedule_count: 0
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_train_schedule_set_with_catalog_entry() {
        let app = test_app!().skip_authz().build();

        let db_pool = app.db_pool();
        let (train_schedule_set, catalog_entry) =
            create_train_schedule_set_linked_to_catalog_entry(&mut db_pool.get().await.unwrap())
                .await;

        let response: TrainScheduleSetResponse = app
            .get(&format!("/train_schedule_sets/{}", train_schedule_set.id))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(
            response,
            TrainScheduleSetResponse {
                train_schedule_set: TrainScheduleSet {
                    id: 1,
                    catalog_entry_id: Some(catalog_entry.id),
                    name: Some("test_with_catalog_entry".into()),
                    description: String::default(),
                    published: false,
                    timetable_type: Default::default(),
                },
                train_schedule_count: 0
            }
        );
    }

    async fn create_train_schedule_set_published(conn: &mut DbConnection) -> TrainScheduleSet {
        let catalog_entry = create_catalog_entry(conn).await;
        TrainScheduleSet::changeset()
            .catalog_entry_id(Some(catalog_entry.id))
            .name(Some("test".to_string()))
            .description(String::default())
            .published(true)
            .create(conn)
            .await
            .expect("Failed to create train schedule set")
    }

    async fn create_train_schedule_with_timetable_type(conn: &mut DbConnection, timetable_type: editoast_models::timetable_type::TimetableType) -> TrainScheduleSet {
        let catalog_entry = create_catalog_entry(conn).await;
        TrainScheduleSet::changeset()
            .catalog_entry_id(Some(catalog_entry.id))
            .name(Some("test".to_string()))
            .description(String::default())
            .timetable_type(timetable_type)
            .create(conn)
            .await
            .expect("Failed to create train schedule set")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_train_schedule_sets() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let train_schedule_set_1 =
            create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set_2 =
            create_train_schedule_with_timetable_type(&mut db_pool.get().await.unwrap(), editoast_models::timetable_type::TimetableType(
                schemas::timetable_type::TimetableType::Hourly
            )).await;
        let response: Vec<TrainScheduleSetResponse> = app
            .get("/train_schedule_sets?timetable_type=HOURLY")
            .await
            .assert_status_ok()
            .json();
        assert_eq!(response.len(), 1);
        assert_eq!(
            response,
            vec![TrainScheduleSetResponse {
                train_schedule_set: train_schedule_set_2,
                train_schedule_count: 0,
            }]
        );

        let response: Vec<TrainScheduleSetResponse> = app
            .get("/train_schedule_sets?timetable_type=CALENDAR")
            .await
            .assert_status_ok()
            .json();
        assert_eq!(response.len(), 1);
        assert_eq!(
            response,
            vec![TrainScheduleSetResponse {
                train_schedule_set: train_schedule_set_1.clone(),
                train_schedule_count: 0,
            }]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_train_schedule_sets_with_timetable_type() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let train_schedule_set_1 =
            create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set_2 =
            create_train_schedule_set_published(&mut db_pool.get().await.unwrap()).await;
        let response: Vec<TrainScheduleSetResponse> = app
            .get("/train_schedule_sets?published=false")
            .await
            .assert_status_ok()
            .json();
        assert_eq!(response.len(), 1);
        assert_eq!(
            response,
            vec![TrainScheduleSetResponse {
                train_schedule_set: train_schedule_set_1,
                train_schedule_count: 0,
            }]
        );

        let response: Vec<TrainScheduleSetResponse> = app
            .get("/train_schedule_sets?published=true")
            .await
            .assert_status_ok()
            .json();
        assert_eq!(response.len(), 1);
        assert_eq!(
            response,
            vec![TrainScheduleSetResponse {
                train_schedule_set: train_schedule_set_2.clone(),
                train_schedule_count: 0,
            }]
        );

        let response: Vec<TrainScheduleSetResponse> = app
            .get("/train_schedule_sets?catalog_entry_id=1")
            .await
            .assert_status_ok()
            .json();
        assert_eq!(response.len(), 1);
        assert_eq!(
            response,
            vec![TrainScheduleSetResponse {
                train_schedule_set: train_schedule_set_2,
                train_schedule_count: 0,
            }]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_train_schedule_set() {
        let app = test_app!().skip_authz().build();

        let db_pool = app.db_pool();
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set_id = train_schedule_set.id;
        app.delete(&format!("/train_schedule_sets/{}", train_schedule_set_id))
            .await
            .assert_status_no_content();

        assert!(
            !TrainScheduleSet::exists(&mut db_pool.get().await.unwrap(), train_schedule_set_id)
                .await
                .unwrap()
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn put_train_schedule_set() {
        let app = test_app!().skip_authz().build();

        let db_pool = app.db_pool();
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set_id = train_schedule_set.id;
        let train_schedule_set_form = TrainScheduleSetUpdateForm {
            catalog_entry_id: None,
            name: Some("test_updated".to_string()),
            description: "test description".to_string(),
            published: false,
        };
        let response: TrainScheduleSetResponse = app
            .put(&format!("/train_schedule_sets/{}", train_schedule_set_id))
            .json(&train_schedule_set_form)
            .await
            .assert_status_ok()
            .json();

        assert_eq!(
            response,
            TrainScheduleSetResponse {
                train_schedule_set: TrainScheduleSet {
                    id: train_schedule_set_id,
                    catalog_entry_id: None,
                    name: Some("test_updated".to_string()),
                    description: "test description".to_string(),
                    published: false,
                    timetable_type: editoast_models::timetable_type::TimetableType(
                        schemas::timetable_type::TimetableType::Calendar
                    ),
                },
                train_schedule_count: 0
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn put_train_schedule_set_with_catalog_entry() {
        let app = test_app!().skip_authz().build();

        let db_pool = app.db_pool();
        let catalog_entry = create_catalog_entry(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set_id = train_schedule_set.id;
        let train_schedule_set_form = TrainScheduleSetUpdateForm {
            catalog_entry_id: Some(catalog_entry.id),
            name: Some("test_updated".to_string()),
            description: "test description".to_string(),
            published: true,
        };
        let response: TrainScheduleSetResponse = app
            .put(&format!("/train_schedule_sets/{}", train_schedule_set_id))
            .json(&train_schedule_set_form)
            .await
            .assert_status_ok()
            .json();

        assert_eq!(
            response,
            TrainScheduleSetResponse {
                train_schedule_set: TrainScheduleSet {
                    id: train_schedule_set_id,
                    catalog_entry_id: Some(catalog_entry.id),
                    name: Some("test_updated".to_string()),
                    description: "test description".to_string(),
                    published: true,
                    timetable_type: Default::default(),
                },
                train_schedule_count: 0
            }
        );
    }
}
