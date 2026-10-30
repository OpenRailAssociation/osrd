use authz::Role;
use axum::body::Body;
use axum::extract::Json;
use axum::extract::Query;
use axum::extract::State;
use axum::http::header;
use axum::response::IntoResponse as _;
use axum::response::Response;
use editoast_derive::EditoastError;
use object_store::GetOptions;
use object_store::ObjectStore as _;
use object_store::path::Path as ObjectStorePath;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::Result;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "s3")]
enum S3Error {
    #[error("S3 is not configured")]
    #[editoast_error(status = 503)]
    NotConfigured,
    #[error("'{path}' not found")]
    #[editoast_error(status = 404)]
    NotFound { path: String },
    #[error("S3 error fetching '{path}': {message}")]
    #[editoast_error(status = 500)]
    Fetch { path: String, message: String },
}

#[derive(Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct S3PathParam {
    /// Path in the S3 bucket
    #[param(required = true)]
    path: String,
}

/// Returns the content of an S3 object.
/// `.json` objects are served as `application/json`, anything else as `application/octet-stream`.
#[editoast_derive::route(Role::Admin)]
#[utoipa::path(
    get, path = "",
    tag = "s3",
    params(S3PathParam),
    responses(
        (status = 200, description = "Content of the object (`application/octet-stream` if it is not JSON)", content_type = "application/json"),
    )
)]
pub(in crate::views) async fn get_s3_file(
    State(AppState { s3_client, .. }): State<AppState>,
    Query(S3PathParam { path }): Query<S3PathParam>,
) -> Result<Response> {
    let s3 = s3_client.as_ref().ok_or(S3Error::NotConfigured)?;
    let path = ObjectStorePath::from(path);
    let result = match s3.get_opts(&path, GetOptions::default()).await {
        Ok(result) => result,
        Err(object_store::Error::NotFound { .. }) => {
            return Err(S3Error::NotFound {
                path: path.to_string(),
            }
            .into());
        }
        Err(e) => {
            return Err(S3Error::Fetch {
                path: path.to_string(),
                message: e.to_string(),
            }
            .into());
        }
    };

    let content_type = if path.extension() == Some("json") {
        "application/json"
    } else {
        "application/octet-stream"
    };
    let body = Body::from_stream(result.into_stream());
    Ok(([(header::CONTENT_TYPE, content_type)], body).into_response())
}

#[derive(Serialize, ToSchema)]
pub(in crate::views) struct S3ListResponse {
    directories: Vec<String>,
    files: Vec<String>,
}

/// Lists the direct children of an S3 path, like `ls`
#[editoast_derive::route(Role::Admin)]
#[utoipa::path(
    get, path = "",
    tag = "s3",
    params(S3PathParam),
    responses(
        (status = 200, body = inline(S3ListResponse)),
    )
)]
pub(in crate::views) async fn list_s3_directory(
    State(AppState { s3_client, .. }): State<AppState>,
    Query(S3PathParam { path }): Query<S3PathParam>,
) -> Result<Json<S3ListResponse>> {
    let s3 = s3_client.as_ref().ok_or(S3Error::NotConfigured)?;
    let path = ObjectStorePath::from(path);
    let list = s3
        .list_with_delimiter(Some(&path))
        .await
        .map_err(|e| S3Error::Fetch {
            path: path.to_string(),
            message: e.to_string(),
        })?;
    Ok(Json(S3ListResponse {
        directories: list
            .common_prefixes
            .into_iter()
            .map(|p| p.to_string())
            .collect(),
        files: list
            .objects
            .into_iter()
            .map(|o| o.location.to_string())
            .collect(),
    }))
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use rstest::rstest;
    use uuid::Uuid;

    use super::*;
    use crate::views::test_app;
    use crate::views::test_app::TestRequestExt as _;

    // The test app has no S3 configured: passing authz results in a 503
    #[rstest]
    #[case::admin_has_access(vec![Role::Admin], StatusCode::SERVICE_UNAVAILABLE)]
    #[case::operational_studies_forbidden(vec![Role::OperationalStudies], StatusCode::FORBIDDEN)]
    #[case::stdcm_forbidden(vec![Role::Stdcm], StatusCode::FORBIDDEN)]
    #[case::multi_roles_forbidden(vec![Role::OperationalStudies, Role::Stdcm], StatusCode::FORBIDDEN)]
    #[case::no_role_forbidden(vec![], StatusCode::FORBIDDEN)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn s3_endpoints_are_admin_only(
        #[case] roles: Vec<Role>,
        #[case] expected_status: StatusCode,
    ) {
        let app = test_app!().build();
        let user = app
            .user(Uuid::new_v4().to_string(), "name")
            .with_roles(roles)
            .create()
            .await;
        let response = app.get("/s3/list?path=foo").by_user(user.as_ref()).await;
        assert_eq!(response.status_code(), expected_status);
    }
}
