use axum::extract::Json;
use axum::extract::State;
use axum::Extension;
use editoast_authz::BuiltinRole;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use crate::core::conflict_projection::{ConflictProjectionRequest, ConflictProjectionResponse};
use crate::core::pathfinding::TrackRange as CoreTrackRange;
use crate::core::AsCoreRequest;
use crate::error::Result;
use crate::models::prelude::*;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use crate::{AppState, Infra};
use editoast_derive::EditoastError;

crate::routes! {
    "/conflicts" => {
        "/project_path" => project_path,
    },
}

editoast_common::schemas! {
    ConflictProjectForm,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "conflicts")]
pub enum ConflictError {
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
}

#[derive(Serialize, Deserialize, ToSchema)]
struct ConflictProjectForm {
    infra_id: i64,
    #[schema(value_type = Vec<TrackRange>)]
    path_track_ranges: Vec<CoreTrackRange>,
    zones: Vec<String>,
}

#[utoipa::path(
    post, path = "",
    tag = "conflicts",
    request_body = ConflictProjectForm,
    responses(
        (
            status = 200,
            body = ConflictProjectionResponse,
            description = "Returns a list of conflicts whose track ranges intersect the given path"
        ),
    )
)]
async fn project_path(
    State(app_state): State<AppState>,
    Extension(authorizer): AuthorizerExt,
    Json(ConflictProjectForm {
        infra_id,
        path_track_ranges,
        zones,
    }): Json<ConflictProjectForm>,
) -> Result<Json<ConflictProjectionResponse>> {
    let authorized = authorizer
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let core = app_state.core_client.clone();

    let infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        ConflictError::InfraNotFound { infra_id }
    })
    .await?;

    let req = ConflictProjectionRequest {
        infra: infra_id,
        expected_version: infra.version,
        path_track_ranges,
        zones,
    };
    let resp = req.fetch(core.as_ref()).await?;

    Ok(Json(resp.into()))
}
