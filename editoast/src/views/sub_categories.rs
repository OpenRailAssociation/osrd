use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use itertools::Itertools;
use schemas::rolling_stock::SubCategory;
use serde::Serialize;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use editoast_models::prelude::*;

#[derive(Debug, Error, EditoastError, derive_more::From)]
#[editoast_error(base_id = "sub_categories")]
enum SubCategoryError {
    #[error("Sub category '{code}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { code: String },
    #[error("Sub category '{code}', is already used")]
    #[editoast_error(status = 400)]
    CodeAlreadyUsed { code: String },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    #[from(editoast_models::Error)]
    Database(editoast_models::sub_category::Error),
}

impl From<editoast_models::sub_category::Error> for SubCategoryError {
    fn from(e: editoast_models::sub_category::Error) -> Self {
        match e {
            editoast_models::sub_category::Error::CodeAlreadyUsed { code } => {
                Self::CodeAlreadyUsed { code }
            }
            editoast_models::sub_category::Error::Database(error) => Self::from(error),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(serde::Deserialize))]
pub(in crate::views) struct SubCategoryPage {
    results: Vec<SubCategory>,
    #[serde(flatten)]
    stats: PaginationStats,
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "sub_categories",
    params(PaginationQueryParams<1000>),
    responses(
        (status = 200, description = "The list of sub categories", body = SubCategoryPage),
    ),
)]
pub(in crate::views) async fn get_sub_categories(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(pagination): Query<PaginationQueryParams<1000>>,
) -> Result<Json<SubCategoryPage>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let mut conn = db_pool.get().await?;

    let (sub_categories, stats) = editoast_models::SubCategory::list_paginated(
        &mut conn,
        pagination
            .into_selection_settings()
            .order_by(move || editoast_models::SubCategory::ID.asc()),
    )
    .await?;

    Ok(Json(SubCategoryPage {
        results: sub_categories.into_iter().map_into().collect(),
        stats,
    }))
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "sub_categories",
    request_body = Vec<SubCategory>,
    responses(
        (status = 200, description = "Create sub categories", body = Vec<SubCategory>),
    ),
)]
pub(in crate::views) async fn create_sub_categories(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(data): Json<Vec<SubCategory>>,
) -> Result<Json<Vec<SubCategory>>> {
    let authorized = auth
        .check_roles([authz::Role::Admin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let conn = &mut db_pool.get().await?;

    let sub_categories: Vec<Changeset<editoast_models::SubCategory>> =
        data.into_iter().map_into().collect();

    let sub_categories: Vec<_> = editoast_models::SubCategory::create_batch(conn, sub_categories)
        .await
        .map_err(SubCategoryError::from)?;

    let sub_categories = sub_categories.into_iter().map_into().collect();

    Ok(Json(sub_categories))
}

#[derive(IntoParams)]
#[expect(unused)]
struct SubCategoryCodeParam {
    code: String,
}

#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tag = "sub_categories",
    params(SubCategoryCodeParam),
    responses(
        (status = 204, description = "Delete a sub category"),
    ),
)]
pub(in crate::views) async fn delete_sub_category(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(code): Path<String>,
    Extension(auth): AuthenticationExt,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::Admin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = db_pool.get().await?;

    conn.transaction(|mut tx| {
        Box::pin(async move { delete_sub_category_and_fallback_to_main(&mut tx, code).await })
    })
    .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[tracing::instrument(skip(conn))]
async fn delete_sub_category_and_fallback_to_main(
    conn: &mut DbConnection,
    code: String,
) -> Result<()> {
    let sub_category =
        editoast_models::SubCategory::retrieve_or_fail(conn.clone(), code.clone(), || {
            SubCategoryError::NotFound { code: code.clone() }
        })
        .await?;

    let sub_category_code = Some(sub_category.code.clone());
    let paced_trains_ids: Vec<i64> = models::PacedTrain::list(
        conn,
        SelectionSettings::new()
            .filter(move || models::PacedTrain::SUB_CATEGORY.eq(sub_category_code.clone())),
    )
    .await?
    .into_iter()
    .map(|paced_train| paced_train.id)
    .collect();

    let _: (Vec<_>, _) = models::PacedTrain::changeset()
        .main_category(Some(sub_category.main_category.clone()))
        .sub_category(None)
        .update_batch(conn, paced_trains_ids)
        .await?;

    let train_schedule_ids: Vec<i64> = models::TrainSchedule::list(
        conn,
        SelectionSettings::new()
            .filter(move || models::TrainSchedule::SUB_CATEGORY.eq(Some(code.clone()))),
    )
    .await?
    .into_iter()
    .map(|train_schedule| train_schedule.id)
    .collect();

    let _: (Vec<_>, _) = models::TrainSchedule::changeset()
        .main_category(Some(sub_category.main_category.clone()))
        .sub_category(None)
        .update_batch(conn, train_schedule_ids)
        .await?;

    sub_category.delete(conn).await?;
    Ok(())
}

#[cfg(test)]
pub mod tests {
    use axum::http::StatusCode;
    use editoast_models::rolling_stock::TrainMainCategory;
    use pretty_assertions::assert_eq;

    use schemas::rolling_stock::SubCategory;
    use serde_json::json;

    use crate::models;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::simple_paced_train_changeset;
    use crate::models::fixtures::simple_sub_category;
    use crate::models::fixtures::simple_train_schedule_changeset;
    use crate::views::sub_categories::SubCategoryPage;
    use crate::views::test_app::TestAppBuilder;
    use editoast_models::prelude::*;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn sub_category_post() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let request = app.post("/sub_category").json(&json!([
            {
                "code": "tjv",
                "name": "TJV",
                "main_category": schemas::rolling_stock::TrainMainCategory::HighSpeedTrain,
                "color": "#FF0000",
                "background_color": "#FF0000",
                "hovered_color": "#FF0000",
            },
            {
                "code": "ter",
                "name": "TER",
                "main_category": schemas::rolling_stock::TrainMainCategory::CommuterTrain,
                "color": "#00FF00",
                "background_color": "#00FF00",
                "hovered_color": "#00FF00",
            }
        ]));

        let response: Vec<SubCategory> = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        let created_sub_category1 = response.first().unwrap();

        let sub_category_1 = editoast_models::SubCategory::retrieve(
            db_pool.get_ok(),
            created_sub_category1.code.clone(),
        )
        .await
        .expect("Failed to retrieve sub category")
        .expect("Sub category not found")
        .into();

        assert_eq!(created_sub_category1, &sub_category_1);

        let created_sub_category2 = response.get(1).unwrap();
        let sub_category_2 = editoast_models::SubCategory::retrieve(
            db_pool.get_ok(),
            created_sub_category2.code.clone(),
        )
        .await
        .expect("Failed to retrieve sub category")
        .expect("Sub category not found")
        .into();

        assert_eq!(created_sub_category2, &sub_category_2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn sub_category_duplicated_post() {
        let app = TestAppBuilder::default_app();

        let request = app.post("/sub_category").json(&json!([
            {
                "code": "tjv",
                "name": "TJV",
                "main_category": schemas::rolling_stock::TrainMainCategory::HighSpeedTrain,
                "color": "#FF0000",
                "background_color": "#FF0000",
                "hovered_color": "#FF0000",
            },
            {
                "code": "tjv",
                "name": "TJV",
                "main_category": schemas::rolling_stock::TrainMainCategory::CommuterTrain,
                "color": "#00FF00",
                "background_color": "#00FF00",
                "hovered_color": "#00FF00",
            }
        ]));

        app.fetch(request)
            .await
            .assert_status(StatusCode::BAD_REQUEST);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn sub_category_get() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_sub_category_1 = simple_sub_category(
            "tjv",
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain),
        )
        .create(&mut db_pool.get_ok())
        .await
        .expect("Failed to create sub category");

        let created_sub_category_2 = simple_sub_category(
            "ter",
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain),
        )
        .create(&mut db_pool.get_ok())
        .await
        .expect("Failed to create sub category");

        let request = app.get("/sub_category");
        let response: SubCategoryPage = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(
            response.results,
            vec![created_sub_category_1.into(), created_sub_category_2.into()]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn sub_category_delete() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let created_sub_category = simple_sub_category(
            "tjv",
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain),
        )
        .create(&mut db_pool.get_ok())
        .await
        .expect("Failed to create sub category");

        let timetable = create_timetable(&mut db_pool.get_ok()).await;

        let paced_train_1 = simple_paced_train_changeset(timetable.id)
            .main_category(None)
            .sub_category(Some(created_sub_category.code.clone()));
        let paced_train_1 = paced_train_1
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");

        let paced_train_2 = simple_paced_train_changeset(timetable.id)
            .main_category(None)
            .sub_category(Some(created_sub_category.code.clone()));
        let paced_train_2 = paced_train_2
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create paced train");

        let train_schedule_1 = simple_train_schedule_changeset(timetable.id)
            .main_category(None)
            .sub_category(Some(created_sub_category.code.clone()));
        let train_schedule_1 = train_schedule_1
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule 1");

        let train_schedule_2 = simple_train_schedule_changeset(timetable.id)
            .main_category(None)
            .sub_category(Some(created_sub_category.code.clone()));
        let train_schedule_2 = train_schedule_2
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create train schedule 2");

        let request = app.delete(&format!(
            "/sub_category/{}",
            created_sub_category.code.clone()
        ));
        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let paced_train_1 = models::PacedTrain::retrieve(db_pool.get_ok(), paced_train_1.id)
            .await
            .expect("Failed to retrieve paced train")
            .expect("Paced train 1 not found");

        let paced_train_2 = models::PacedTrain::retrieve(db_pool.get_ok(), paced_train_2.id)
            .await
            .expect("Failed to retrieve paced train")
            .expect("Paced train 2 not found");

        assert_eq!(paced_train_1.sub_category, None);
        assert_eq!(paced_train_2.sub_category, None);

        assert_eq!(
            paced_train_1.main_category,
            Some(TrainMainCategory(
                schemas::rolling_stock::TrainMainCategory::HighSpeedTrain
            ))
        );
        assert_eq!(
            paced_train_2.main_category,
            Some(TrainMainCategory(
                schemas::rolling_stock::TrainMainCategory::HighSpeedTrain
            ))
        );

        let train_schedule_1 =
            models::TrainSchedule::retrieve(db_pool.get_ok(), train_schedule_1.id)
                .await
                .expect("Failed to retrieve train schedule")
                .expect("Train schedule 1 not found");

        let train_schedule_2 =
            models::TrainSchedule::retrieve(db_pool.get_ok(), train_schedule_2.id)
                .await
                .expect("Failed to retrieve train schedule")
                .expect("Train schedule 2 not found");

        assert_eq!(train_schedule_1.sub_category, None);
        assert_eq!(train_schedule_2.sub_category, None);

        assert_eq!(
            train_schedule_1.main_category,
            Some(TrainMainCategory(
                schemas::rolling_stock::TrainMainCategory::HighSpeedTrain
            ))
        );
        assert_eq!(
            train_schedule_2.main_category,
            Some(TrainMainCategory(
                schemas::rolling_stock::TrainMainCategory::HighSpeedTrain
            ))
        );

        let exists = editoast_models::SubCategory::exists(
            &mut db_pool.get_ok(),
            created_sub_category.code.clone(),
        )
        .await
        .expect("Failed to retrieve sub category");

        assert!(!exists);
    }
}
