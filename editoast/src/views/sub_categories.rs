use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_schemas::rolling_stock::SubCategory;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;

editoast_common::schemas! {
    SubCategoryPage,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "sub_categories")]
// TODO: Remove this once it is used.
// It cannot be an expect since older rust versions
// don't detect it as unused.
#[allow(dead_code)]
enum SubCategoryError {
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::model::Error),
}

#[derive(Debug, Serialize, ToSchema)]
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
    State(_db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Query(_pagination): Query<PaginationQueryParams<1000>>,
) -> Result<Json<SubCategoryPage>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    // TODO implement this endpoint
    Ok(Json(SubCategoryPage {
        results: vec![],
        stats: PaginationStats::new(1, 1000, 1, 1000),
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
    State(_db_pool): State<DbConnectionPoolV2>,
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

    // TODO implement this endpoint
    let sub_categories = data
        .into_iter()
        .map(|d| SubCategory {
            code: d.code,
            name: d.name,
            main_category: d.main_category,
            color: d.color,
            background_color: d.background_color,
            hovered_color: d.hovered_color,
        })
        .collect();

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
        (status = 200, description = "Delete a sub category"),
    ),
)]
pub(in crate::views) async fn delete_sub_category(
    State(_db_pool): State<DbConnectionPoolV2>,
    Path(_code): Path<String>,
    Extension(auth): AuthenticationExt,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::Admin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    // TODO implement this endpoint
    Ok(axum::http::StatusCode::NO_CONTENT)
}
