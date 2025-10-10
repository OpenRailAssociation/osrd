use std::collections::HashMap;

use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use editoast_derive::EditoastError;
use serde::Deserialize;
use thiserror::Error;

use crate::AppState;
use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::models::Infra;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::infra::InfraApiError;
use editoast_models::prelude::*;
use schemas::primitives::ObjectType;

/// Objects types that can be attached to a track
const ATTACHED_OBJECTS_TYPES: &[ObjectType] = &[
    ObjectType::Signal,
    ObjectType::SpeedSection,
    ObjectType::Detector,
    ObjectType::Switch,
    ObjectType::BufferStop,
    ObjectType::OperationalPoint,
    ObjectType::Electrification,
];

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "attached")]
enum AttachedError {
    #[error("Track '{track_id}' not found")]
    #[editoast_error(status = 404)]
    TrackNotFound { track_id: String },
}

#[derive(utoipa::IntoParams, Deserialize)]
pub(in crate::views) struct InfraAttachedParams {
    /// An infra ID
    infra_id: i64,
    /// A track section ID
    track_id: String,
}

/// Retrieve all objects attached to a given track
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(InfraAttachedParams),
    responses(
        (
            status = 200,
            body = inline(HashMap<ObjectType, Vec<String>>),
            description = "All objects attached to the given track (arranged by types)"
        ),
    ),
)]
pub(in crate::views) async fn attached(
    Path(InfraAttachedParams { infra_id, track_id }): Path<InfraAttachedParams>,
    State(AppState {
        infra_caches,
        db_pool,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<HashMap<ObjectType, Vec<String>>>> {
    // Check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Check that infra exists
    let mut conn = db_pool.get().await?;
    // TODO: lock for share
    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || InfraApiError::NotFound {
        infra_id,
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    // Check track existence
    let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
    if !infra_cache.track_sections().contains_key(&track_id) {
        return Err(AttachedError::TrackNotFound {
            track_id: track_id.clone(),
        }
        .into());
    }
    // Get attached objects
    let res: HashMap<_, Vec<_>> = ATTACHED_OBJECTS_TYPES
        .iter()
        .map(|obj_type| {
            (
                *obj_type,
                infra_cache
                    .get_track_refs_type(&track_id, *obj_type)
                    .into_iter()
                    .map(|obj_ref| obj_ref.obj_id.clone())
                    .collect(),
            )
        })
        .collect();
    Ok(Json(res))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::models::Infra;
    use crate::views::test_app::TestAppBuilder;
    use editoast_models::prelude::*;
    use schemas::infra::Detector;
    use schemas::infra::TrackSection;
    use schemas::primitives::OSRDIdentified;
    use schemas::primitives::ObjectType;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_attached_detector() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        // Create empty infra
        let empty_infra = Infra::changeset()
            .name("test_infra".to_owned())
            .last_railjson_version()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create infra");

        // Create a track and a detector on it
        let track = TrackSection::default().into();
        apply_create_operation(&track, empty_infra.id, &mut pool.get_ok())
            .await
            .expect("Failed to create track object");

        let detector = Detector {
            track: track.get_id().clone().into(),
            ..Default::default()
        }
        .into();
        apply_create_operation(&detector, empty_infra.id, &mut pool.get_ok())
            .await
            .expect("Failed to create detector object");

        let req =
            app.get(format!("/infra/{}/attached/{}/", empty_infra.id, track.get_id()).as_str());

        let response: HashMap<ObjectType, Vec<String>> = app.fetch(req).await.json_into();
        assert_eq!(response.get(&ObjectType::Detector).unwrap().len(), 1);
    }
}
