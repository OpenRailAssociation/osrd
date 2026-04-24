use ::authz::Role;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use editoast_derive::EditoastError;
use object_store::GetOptions;
use object_store::ObjectStore as _;
use object_store::aws::AmazonS3;
use object_store::path::Path as OsPath;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "stdcm_debug")]
enum StdcmDebugError {
    #[error("S3 is not configured")]
    #[editoast_error(status = 503)]
    S3NotConfigured,
    #[error("S3 error fetching '{path}': {message}")]
    #[editoast_error(status = 500)]
    S3Error { path: String, message: String },
    #[error("Failed to parse JSON from S3 object '{path}': {message}")]
    #[editoast_error(status = 500)]
    JsonParseError { path: String, message: String },
}

#[derive(Serialize, serde::Deserialize, ToSchema)]
pub(in crate::views) struct StdcmDebugDataResponse {
    failure: Option<serde_json::Value>,
    simulation_data: Option<serde_json::Value>,
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "stdcm",
    params(
        ("trace_id" = String, Path, description = "OpenTelemetry trace ID of the STDCM request")
    ),
    responses(
        (status = 200, body = inline(StdcmDebugDataResponse)),
    )
)]
pub(in crate::views) async fn get_debug_data(
    Extension(auth): AuthenticationExt,
    State(AppState { s3_client, .. }): State<AppState>,
    Path(trace_id): Path<String>,
) -> Result<Json<StdcmDebugDataResponse>> {
    let authorized = auth
        .check_roles([Role::Admin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let s3 = s3_client.as_ref().ok_or(StdcmDebugError::S3NotConfigured)?;

    let prefix = OsPath::from("stdcm/requests/").join(trace_id);
    let failure = fetch_optional_json(s3.as_ref(), &prefix.clone().join("failure.json")).await?;
    let simulation_data =
        fetch_optional_json(s3.as_ref(), &prefix.join("output_simulation_data.json")).await?;

    let response = StdcmDebugDataResponse {
        failure,
        simulation_data,
    };
    Ok(Json(response))
}

async fn fetch_optional_json(
    s3: &AmazonS3,
    path: &OsPath,
) -> Result<Option<serde_json::Value>, StdcmDebugError> {
    dbg!(path.clone());
    match s3.get_opts(&path, GetOptions::default()).await {
        Ok(result) => {
            let bytes = result.bytes().await.map_err(|e| StdcmDebugError::S3Error {
                path: path.to_string(),
                message: e.to_string(),
            })?;
            let value =
                serde_json::from_slice(&bytes).map_err(|e| StdcmDebugError::JsonParseError {
                    path: path.to_string(),
                    message: e.to_string(),
                })?;
            Ok(Some(value))
        }
        Err(object_store::Error::NotFound { .. }) => Ok(None),
        Err(e) => Err(StdcmDebugError::S3Error {
            path: path.to_string(),
            message: e.to_string(),
        }),
    }
}
