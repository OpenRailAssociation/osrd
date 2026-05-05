use crate::AppState;
use crate::error::Result;
use crate::views::Authentication;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use ::authz::Role;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use core_client::AsCoreRequest;
use core_client::stdcm_logged_data::StdcmLoggedDataRequest;
use core_client::stdcm_logged_data::StdcmLoggedDataResponse;

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "stdcm",
    params(
        ("trace_id" = String, Path, description = "OpenTelemetry trace ID of the STDCM request")
    ),
    responses(
        (status = 200, body = inline(StdcmLoggedDataResponse)),
    )
)]
pub(in crate::views) async fn get_debug_data(
    Extension(auth): AuthenticationExt,
    State(AppState { core_client, .. }): State<AppState>,
    Path(trace_id): Path<String>,
) -> Result<Json<StdcmLoggedDataResponse>> {
    let authorized = match auth {
        Authentication::SkipAuthorization { .. } => true,
        other => other
            .authorizer()?
            .check_roles([Role::Admin].into())
            .await
            .map_err(AuthorizationError::AuthError)?,
    };
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let core_request = StdcmLoggedDataRequest { trace_id };

    let response = core_request.fetch(core_client.as_ref()).await;
    match response {
        Ok(data) => Ok(Json(data)),
        Err(e) => Err(e.into()),
    }
}
