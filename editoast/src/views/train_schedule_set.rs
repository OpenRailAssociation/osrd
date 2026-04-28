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
use crate::models;
use crate::models::train_schedule::TrainScheduleChangeset;
use crate::views::timetable::train_schedule::TrainScheduleResponse;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use editoast_models::TrainScheduleSet;
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
}

impl TrainScheduleSetForm {
    pub fn into_changeset(self) -> Changeset<TrainScheduleSet> {
        TrainScheduleSet::changeset()
            .catalog_entry_id(self.catalog_entry_id)
            .name(self.name)
            .description(self.description)
            .published(self.published)
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
    Json(train_schedule_set_create_form): Json<TrainScheduleSetForm>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;
    let changeset = train_schedule_set_create_form.into_changeset();
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

#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    put, path = "",
    tag = "train_schedule_set",
    params(TrainScheduleSetIdParam),
    request_body = TrainScheduleSetForm,
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
    Json(train_schedule_set_form): Json<TrainScheduleSetForm>,
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
    let train_schedules: Vec<_> = models::TrainSchedule::create_batch(conn, changesets).await?;
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

    let settings = SelectionSettings::new()
        .filter(move || models::TrainSchedule::TRAIN_SCHEDULE_SET_ID.eq(train_schedule_set_id));

    let train_schedules = models::TrainSchedule::list(conn, settings).await?;
    Ok(Json(train_schedules.into_iter().map_into().collect()))
}

#[cfg(test)]
mod tests {
    use crate::models;
    use crate::models::fixtures::create_catalog_entry;
    use crate::models::fixtures::create_train_schedule_set;
    use crate::models::fixtures::simple_paced_train_base;
    use crate::views::test_app::TestAppBuilder;
    use crate::views::timetable::train_schedule::TrainScheduleResponse;
    use crate::views::train_schedule_set::TrainScheduleSetForm;
    use crate::views::train_schedule_set::TrainScheduleSetResponse;
    use chrono::Duration;
    use database::DbConnection;
    use editoast_models::CatalogEntry;
    use editoast_models::TrainScheduleSet;
    use editoast_models::prelude::*;
    use reqwest::StatusCode;
    use schemas::TrainScheduleExceptionChangeGroups;
    use schemas::fixtures::simple_created_exception_with_change_groups;
    use schemas::fixtures::simple_modified_exception_with_change_groups;
    use schemas::paced_train::ExceptionType;
    use schemas::paced_train::PacedTrainException;
    use schemas::paced_train::PathAndScheduleChangeGroup;
    use schemas::primitives::PositiveDuration;
    use schemas::train_schedule::MarginValue;
    use schemas::train_schedule::Margins;

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
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let train_schedule_1 = simple_paced_train_base();
        let mut train_schedule_2 = simple_paced_train_base();
        train_schedule_2.paced.as_mut().unwrap().time_window =
            Duration::minutes(120).try_into().unwrap();
        train_schedule_2.paced.as_mut().unwrap().interval =
            Duration::seconds(30).try_into().unwrap();

        let train_schedules = vec![train_schedule_1, train_schedule_2.clone()];

        let request = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&train_schedules);

        let response: Vec<TrainScheduleResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        assert!(response.len() == 2);

        let settings = SelectionSettings::default()
            .filter(move || models::TrainSchedule::TRAIN_SCHEDULE_SET_ID.eq(train_schedule_set.id))
            .limit(25)
            .offset(0);

        let list_result = models::TrainSchedule::list(&mut pool.get_ok(), settings)
            .await
            .expect("Failed to fetch train schedules");

        assert!(list_result.len() == 2);
        assert_eq!(
            list_result[0].exceptions,
            train_schedule_2.paced.unwrap().exceptions
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_paced_train_exceptions() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let mut paced_train_1 = simple_paced_train_base();
        let exception_1 = PacedTrainException {
            key: "exception_key_1".into(),
            exception_type: ExceptionType::Created {},
            disabled: false,
            change_groups: TrainScheduleExceptionChangeGroups::default(),
        };

        let exception_2 = PacedTrainException {
            key: "exception_key_2".into(),
            exception_type: ExceptionType::Modified {
                occurrence_index: 1,
            },
            disabled: true,
            change_groups: TrainScheduleExceptionChangeGroups {
                path_and_schedule: Some(PathAndScheduleChangeGroup {
                    power_restrictions: vec![],
                    schedule: vec![],
                    path: vec![],
                    margins: Margins {
                        boundaries: vec![],
                        values: vec![MarginValue::Percentage(5.0)],
                    },
                }),
                ..Default::default()
            },
        };

        paced_train_1.paced.as_mut().unwrap().exceptions =
            vec![exception_1.clone(), exception_2.clone()];

        let request = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&vec![paced_train_1.clone()]);

        let _: Vec<TrainScheduleResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        let settings = SelectionSettings::default()
            .filter(move || models::TrainSchedule::TRAIN_SCHEDULE_SET_ID.eq(train_schedule_set.id))
            .limit(25)
            .offset(0);

        let list_result = models::TrainSchedule::list(&mut pool.get_ok(), settings)
            .await
            .expect("Failed to fetch paced trains");

        assert_eq!(&list_result[0].exceptions[0], &exception_1);
        assert_eq!(&list_result[0].exceptions[1], &exception_2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_paced_train_with_out_of_bound_exceptions() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let mut paced_train = simple_paced_train_base();
        paced_train.paced.as_mut().unwrap().interval =
            PositiveDuration::new(chrono::Duration::seconds(50));
        paced_train.paced.as_mut().unwrap().time_window =
            PositiveDuration::new(chrono::Duration::seconds(120));

        let exception = simple_modified_exception_with_change_groups("modified_exception", 3);
        paced_train.paced.as_mut().unwrap().exceptions = vec![exception];

        let request = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&vec![paced_train.clone()]);

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY)
            .string();
        assert!(response.contains(
            "Modified exception 'modified_exception' references invalid occurrence index 3"
        ))
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_paced_train_with_duplicated_exceptions() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let mut paced_train_1 = simple_paced_train_base();

        paced_train_1.paced.as_mut().unwrap().exceptions = vec![
            simple_created_exception_with_change_groups("duplicated_key_1"),
            simple_modified_exception_with_change_groups("duplicated_key_1", 0),
        ];

        let request = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&vec![paced_train_1.clone()]);

        let response = app
            .fetch(request)
            .await
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY)
            .bytes();
        assert!(
            String::from_utf8(response)
                .unwrap()
                .contains("Duplicate exception key: 'duplicated_key_1'")
        )
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_paced_trains_for_train_schedule_set() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let train_schedule_1 = simple_paced_train_base();
        let mut train_schedule_2 = simple_paced_train_base();
        train_schedule_2.paced.as_mut().unwrap().time_window =
            Duration::minutes(90).try_into().unwrap();
        train_schedule_2.paced.as_mut().unwrap().interval =
            Duration::seconds(45).try_into().unwrap();

        let request = app
            .post(
                format!(
                    "/train_schedule_sets/{}/train_schedules",
                    train_schedule_set.id
                )
                .as_str(),
            )
            .json(&vec![train_schedule_1, train_schedule_2]);

        let _: Vec<TrainScheduleResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        let request = app.get(
            format!(
                "/train_schedule_sets/{}/train_schedules",
                train_schedule_set.id
            )
            .as_str(),
        );

        let response: Vec<TrainScheduleResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(response.len(), 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_train_schedule_set_without_catalog_entry() {
        let app = TestAppBuilder::default_app();
        let train_schedule_set_form = TrainScheduleSetForm {
            catalog_entry_id: None,
            name: Some("test".to_string()),
            description: String::default(),
            published: false,
        };
        let request = app
            .post("/train_schedule_sets")
            .json(&train_schedule_set_form);
        let response: TrainScheduleSetResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        let expected_response = TrainScheduleSet {
            id: 1,
            catalog_entry_id: None,
            name: Some("test".to_string()),
            description: String::default(),
            published: false,
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
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let catalog_entry = create_catalog_entry(&mut db_pool.get().await.unwrap()).await;
        let catalog_entry_id = catalog_entry.id;
        let train_schedule_set_form = TrainScheduleSetForm {
            catalog_entry_id: Some(catalog_entry_id),
            name: Some("test".to_string()),
            description: String::default(),
            published: false,
        };
        let request = app
            .post("/train_schedule_sets")
            .json(&train_schedule_set_form);
        let response: TrainScheduleSetResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        let expected_response = TrainScheduleSet {
            id: 1,
            catalog_entry_id: Some(catalog_entry_id),
            name: Some("test".to_string()),
            description: String::default(),
            published: false,
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
        let app = TestAppBuilder::default_app();

        let db_pool = app.db_pool();
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;

        let request = app.get(&format!("/train_schedule_sets/{}", train_schedule_set.id));
        let response: TrainScheduleSetResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(
            response,
            TrainScheduleSetResponse {
                train_schedule_set: TrainScheduleSet {
                    id: 1,
                    catalog_entry_id: None,
                    name: None,
                    description: String::default(),
                    published: false,
                },
                train_schedule_count: 0
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_train_schedule_set_with_catalog_entry() {
        let app = TestAppBuilder::default_app();

        let db_pool = app.db_pool();
        let (train_schedule_set, catalog_entry) =
            create_train_schedule_set_linked_to_catalog_entry(&mut db_pool.get().await.unwrap())
                .await;

        let request = app.get(&format!("/train_schedule_sets/{}", train_schedule_set.id));
        let response: TrainScheduleSetResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(
            response,
            TrainScheduleSetResponse {
                train_schedule_set: TrainScheduleSet {
                    id: 1,
                    catalog_entry_id: Some(catalog_entry.id),
                    name: Some("test_with_catalog_entry".into()),
                    description: String::default(),
                    published: false,
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_train_schedule_sets() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let train_schedule_set_1 =
            create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set_2 =
            create_train_schedule_set_published(&mut db_pool.get().await.unwrap()).await;
        let request = app.get("/train_schedule_sets?published=false");
        let response: Vec<TrainScheduleSetResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(response.len(), 1);
        assert_eq!(
            response,
            vec![TrainScheduleSetResponse {
                train_schedule_set: train_schedule_set_1,
                train_schedule_count: 0,
            }]
        );

        let request = app.get("/train_schedule_sets?published=true");
        let response: Vec<TrainScheduleSetResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(response.len(), 1);
        assert_eq!(
            response,
            vec![TrainScheduleSetResponse {
                train_schedule_set: train_schedule_set_2.clone(),
                train_schedule_count: 0,
            }]
        );

        let request = app.get("/train_schedule_sets?catalog_entry_id=1");
        let response: Vec<TrainScheduleSetResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
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
        let app = TestAppBuilder::default_app();

        let db_pool = app.db_pool();
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set_id = train_schedule_set.id;
        let request = app.delete(&format!("/train_schedule_sets/{}", train_schedule_set_id));
        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        assert!(
            !TrainScheduleSet::exists(&mut db_pool.get().await.unwrap(), train_schedule_set_id)
                .await
                .unwrap()
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn put_train_schedule_set() {
        let app = TestAppBuilder::default_app();

        let db_pool = app.db_pool();
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set_id = train_schedule_set.id;
        let train_schedule_set_form = TrainScheduleSetForm {
            catalog_entry_id: None,
            name: Some("test_updated".to_string()),
            description: "test description".to_string(),
            published: false,
        };
        let request = app
            .put(&format!("/train_schedule_sets/{}", train_schedule_set_id))
            .json(&train_schedule_set_form);
        let response: TrainScheduleSetResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(
            response,
            TrainScheduleSetResponse {
                train_schedule_set: TrainScheduleSet {
                    id: train_schedule_set_id,
                    catalog_entry_id: None,
                    name: Some("test_updated".to_string()),
                    description: "test description".to_string(),
                    published: false,
                },
                train_schedule_count: 0
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn put_train_schedule_set_with_catalog_entry() {
        let app = TestAppBuilder::default_app();

        let db_pool = app.db_pool();
        let catalog_entry = create_catalog_entry(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set = create_train_schedule_set(&mut db_pool.get().await.unwrap()).await;
        let train_schedule_set_id = train_schedule_set.id;
        let train_schedule_set_form = TrainScheduleSetForm {
            catalog_entry_id: Some(catalog_entry.id),
            name: Some("test_updated".to_string()),
            description: "test description".to_string(),
            published: true,
        };
        let request = app
            .put(&format!("/train_schedule_sets/{}", train_schedule_set_id))
            .json(&train_schedule_set_form);
        let response: TrainScheduleSetResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(
            response,
            TrainScheduleSetResponse {
                train_schedule_set: TrainScheduleSet {
                    id: train_schedule_set_id,
                    catalog_entry_id: Some(catalog_entry.id),
                    name: Some("test_updated".to_string()),
                    description: "test description".to_string(),
                    published: true,
                },
                train_schedule_count: 0
            }
        );
    }
}
