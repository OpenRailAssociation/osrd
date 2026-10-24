use authz::Role;
use axum::body::Body;
use axum::extract::Json;
use axum::extract::Query;
use axum::extract::State;
use axum::http::header;
use axum::response::IntoResponse as _;
use axum::response::Response;
use chrono::DateTime;
use chrono::Utc;
use editoast_derive::EditoastError;
use futures::StreamExt as _;
use futures::TryStreamExt as _;
use futures::stream;
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
    #[error("S3 object '{path}' not found")]
    #[editoast_error(status = 404)]
    NotFound { path: String },
    #[error("S3 error fetching '{path}': {message}")]
    #[editoast_error(status = 500)]
    Fetch { path: String, message: String },
}

#[derive(Deserialize, IntoParams)]
pub(in crate::views) struct S3PathParam {
    /// Path in the S3 bucket
    #[serde(default)]
    path: String,
}

/// Returns the content of an S3 object.
/// It is served as `text/plain` when its first chunk looks like UTF-8 text, as `application/octet-stream` otherwise.
#[editoast_derive::route(Role::Admin)]
#[utoipa::path(
    get, path = "",
    tag = "s3",
    params(S3PathParam),
    responses(
        (status = 200, description = "Content of the object (`application/octet-stream` if it is not text)", content_type = "text/plain"),
    )
)]
pub(in crate::views) async fn get_s3_file(
    State(AppState { s3_client, .. }): State<AppState>,
    Query(S3PathParam { path }): Query<S3PathParam>,
) -> Result<Response> {
    let s3 = s3_client.as_ref().ok_or(S3Error::NotConfigured)?;
    let path = ObjectStorePath::from(path);
    let fetch_error = |e: object_store::Error| S3Error::Fetch {
        path: path.to_string(),
        message: e.to_string(),
    };
    let result = match s3.get_opts(&path, GetOptions::default()).await {
        Ok(result) => result,
        Err(object_store::Error::NotFound { .. }) => {
            return Err(S3Error::NotFound {
                path: path.to_string(),
            }
            .into());
        }
        Err(e) => return Err(fetch_error(e).into()),
    };

    // Peek at the first chunk to pick a content type, without buffering the whole object
    let mut chunks = result.into_stream();
    let first_chunk = chunks
        .try_next()
        .await
        .map_err(fetch_error)?
        .unwrap_or_default();
    let content_type = if looks_like_text(&first_chunk) {
        "text/plain; charset=utf-8"
    } else {
        "application/octet-stream"
    };
    let body = Body::from_stream(stream::once(async move { Ok(first_chunk) }).chain(chunks));
    Ok(([(header::CONTENT_TYPE, content_type)], body).into_response())
}

fn looks_like_text(bytes: &[u8]) -> bool {
    if bytes.contains(&0) {
        return false;
    }
    match std::str::from_utf8(bytes) {
        Ok(_) => true,
        // The chunk may end in the middle of a multi-byte character
        Err(e) => e.error_len().is_none(),
    }
}

#[derive(Serialize, ToSchema)]
pub(in crate::views) struct S3ObjectInfo {
    path: String,
    size: u64,
    last_modified: DateTime<Utc>,
}

#[derive(Serialize, ToSchema)]
pub(in crate::views) struct S3ListResponse {
    directories: Vec<String>,
    files: Vec<S3ObjectInfo>,
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
            .map(|o| S3ObjectInfo {
                path: o.location.to_string(),
                size: o.size,
                last_modified: o.last_modified,
            })
            .collect(),
    }))
}
