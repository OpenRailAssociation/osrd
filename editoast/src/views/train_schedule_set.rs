use axum::extract::Query;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use itertools::Itertools;
use schemas::paced_train::PacedTrain;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models;
use crate::models::paced_train::PacedTrainChangeset;
use crate::models::train_schedule_set::TrainScheduleSet;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::timetable::paced_train::PacedTrainResponse;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
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

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TrainScheduleSetResponse {
    #[serde(flatten)]
    train_schedule_set: TrainScheduleSet,
    train_schedule_count: u64,
}

impl TrainScheduleSetResponse {
    pub async fn try_fetch(
        conn: &mut DbConnection,
        published: Option<bool>,
        catalog_entry_id: Option<i64>,
    ) -> Result<Vec<Self>> {
        let mut settings = SelectionSettings::new();

        if let Some(catalog_entry_id) = catalog_entry_id {
            settings = settings
                .filter(move || TrainScheduleSet::CATALOG_ENTRY_ID.eq(Some(catalog_entry_id)));
        }

        if let Some(published) = published {
            settings = settings.filter(move || TrainScheduleSet::PUBLISHED.eq(published));
        }

        let train_schedule_sets = TrainScheduleSet::list(conn, settings).await?;
        Ok(train_schedule_sets
            .into_iter()
            .map(|train_schedule_set| Self {
                train_schedule_set,
                // TODO: Add database operation to get train schedule set count
                // once paced trains and train schedules are merged
                train_schedule_count: 0,
            })
            .collect())
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

#[editoast_derive::route]
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
    Extension(auth): AuthenticationExt,
    Json(train_schedule_set_create_form): Json<TrainScheduleSetForm>,
) -> Result<Json<TrainScheduleSetResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let changeset = train_schedule_set_create_form.into_changeset();
    let train_schedule_set = changeset.create(conn).await?;

    Ok(Json(TrainScheduleSetResponse {
        train_schedule_set,
        // TODO: Add database operation to get train schedule set count
        // once paced trains and train schedules are merged
        train_schedule_count: 0,
    }))
}

#[derive(IntoParams, Serialize, Deserialize, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct TrainScheduleSetQueryParams {
    catalog_entry_id: Option<i64>,
    published: Option<bool>,
}

#[editoast_derive::route]
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
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleSetIdParam {
        id: train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
) -> Result<Json<TrainScheduleSetResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let train_schedule_set =
        TrainScheduleSet::retrieve_or_fail(db_pool.get().await?, train_schedule_set_id, || {
            TrainScheduleSetError::NotFound {
                train_schedule_set_id,
            }
        })
        .await?;
    Ok(Json(TrainScheduleSetResponse {
        train_schedule_set,
        // TODO: Add database operation to get train schedule set count
        // once paced trains and train schedules are merged
        train_schedule_count: 0,
    }))
}

#[editoast_derive::route]
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
    Extension(auth): AuthenticationExt,
    Query(TrainScheduleSetQueryParams {
        catalog_entry_id,
        published,
    }): Query<TrainScheduleSetQueryParams>,
) -> Result<Json<Vec<TrainScheduleSetResponse>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let train_schedule_sets =
        TrainScheduleSetResponse::try_fetch(conn, published, catalog_entry_id).await?;
    Ok(Json(train_schedule_sets))
}

#[editoast_derive::route]
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
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleSetIdParam {
        id: train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
    Json(train_schedule_set_form): Json<TrainScheduleSetForm>,
) -> Result<Json<TrainScheduleSetResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let changeset = train_schedule_set_form.into_changeset();
    let train_schedule_set = changeset
        .update_or_fail(conn, train_schedule_set_id, || {
            TrainScheduleSetError::NotFound {
                train_schedule_set_id,
            }
        })
        .await?;
    let train_schedule_set_response = TrainScheduleSetResponse {
        train_schedule_set,
        // TODO: Add database operation to get train schedule set count
        // once paced trains and train schedules are merged
        train_schedule_count: 0,
    };
    Ok(Json(train_schedule_set_response))
}

#[editoast_derive::route]
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
    State(_db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleSetIdParam {
        id: _train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    Ok(StatusCode::NO_CONTENT)
}

/// Create paced trains by batch
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tags = ["train_schedule_set", "paced_train"],
    params(TrainScheduleSetIdParam),
    request_body = Vec<PacedTrain>,
    responses(
        (status = 200, description = "The created paced trains", body = Vec<PacedTrainResponse>)
    )
)]
pub(in crate::views) async fn post_paced_train(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(TrainScheduleSetIdParam {
        id: train_schedule_set_id,
    }): Path<TrainScheduleSetIdParam>,
    Json(paced_trains): Json<Vec<PacedTrain>>,
) -> Result<Json<Vec<PacedTrainResponse>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let train_schedule_set_exists = TrainScheduleSet::exists(conn, train_schedule_set_id).await?;
    if !train_schedule_set_exists {
        return Err(TrainScheduleSetError::NotFound {
            train_schedule_set_id,
        }
        .into());
    }

    let changesets = paced_trains
        .into_iter()
        .map(PacedTrainChangeset::from)
        .map(|cs| cs.train_schedule_set_id(train_schedule_set_id))
        .collect::<Vec<_>>();

    // Create a batch of paced trains
    let paced_trains: Vec<_> = models::PacedTrain::create_batch(conn, changesets).await?;
    Ok(Json(paced_trains.into_iter().map_into().collect()))
}

#[cfg(test)]
mod tests {
    use chrono::Duration;
    use editoast_models::prelude::{List, SelectionSettings};
    use reqwest::StatusCode;
    use schemas::{
        fixtures::{
            simple_created_exception_with_change_groups,
            simple_modified_exception_with_change_groups,
        },
        paced_train::{ExceptionType, PacedTrainException, PathAndScheduleChangeGroup},
        train_schedule::{MarginValue, Margins},
    };

    use crate::{
        models::{
            self,
            fixtures::{create_train_schedule_set, simple_paced_train_base},
        },
        views::{test_app::TestAppBuilder, timetable::paced_train::PacedTrainResponse},
    };

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_paced_train() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let train_schedule_set = create_train_schedule_set(&mut pool.get_ok()).await;
        let paced_train_1 = simple_paced_train_base();
        let mut paced_train_2 = simple_paced_train_base();
        paced_train_2.paced.as_mut().unwrap().time_window =
            Duration::minutes(120).try_into().unwrap();
        paced_train_2.paced.as_mut().unwrap().interval = Duration::seconds(30).try_into().unwrap();

        let paced_trains = vec![paced_train_1, paced_train_2.clone()];

        let request = app
            .post(format!("/train_schedule_set/{}/paced_trains", train_schedule_set.id).as_str())
            .json(&paced_trains);

        let response: Vec<PacedTrainResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert!(response.len() == 2);

        let settings = SelectionSettings::default()
            .filter(move || models::PacedTrain::TRAIN_SCHEDULE_SET_ID.eq(train_schedule_set.id))
            .limit(25)
            .offset(0);

        let list_result = models::PacedTrain::list(&mut pool.get_ok(), settings)
            .await
            .expect("Failed to fetch paced trains");

        assert!(list_result.len() == 2);
        assert_eq!(
            list_result[0].exceptions,
            paced_train_2.paced.unwrap().exceptions
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
            constraint_distribution: None,
            initial_speed: None,
            labels: None,
            options: None,
            path_and_schedule: None,
            rolling_stock: None,
            rolling_stock_category: None,
            speed_limit_tag: None,
            start_time: None,
            train_name: None,
        };

        let exception_2 = PacedTrainException {
            key: "exception_key_2".into(),
            exception_type: ExceptionType::Modified {
                occurrence_index: 1,
            },
            disabled: true,
            path_and_schedule: Some(PathAndScheduleChangeGroup {
                power_restrictions: vec![],
                schedule: vec![],
                path: vec![],
                margins: Margins {
                    boundaries: vec![],
                    values: vec![MarginValue::Percentage(5.0)],
                },
            }),
            constraint_distribution: None,
            initial_speed: None,
            labels: None,
            options: None,
            rolling_stock: None,
            rolling_stock_category: None,
            speed_limit_tag: None,
            start_time: None,
            train_name: None,
        };

        paced_train_1.paced.as_mut().unwrap().exceptions =
            vec![exception_1.clone(), exception_2.clone()];

        let request = app
            .post(format!("/train_schedule_set/{}/paced_trains", train_schedule_set.id).as_str())
            .json(&vec![paced_train_1.clone()]);

        let _: Vec<PacedTrainResponse> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let settings = SelectionSettings::default()
            .filter(move || models::PacedTrain::TRAIN_SCHEDULE_SET_ID.eq(train_schedule_set.id))
            .limit(25)
            .offset(0);

        let list_result = models::PacedTrain::list(&mut pool.get_ok(), settings)
            .await
            .expect("Failed to fetch paced trains");

        assert_eq!(&list_result[0].exceptions[0], &exception_1);
        assert_eq!(&list_result[0].exceptions[1], &exception_2);
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
            .post(format!("/train_schedule_set/{}/paced_trains", train_schedule_set.id).as_str())
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
}
