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
use crate::views::AuthenticationExt;
use crate::views::infra::InfraApiError;
use editoast_models::Infra;
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
    ObjectType::LevelCrossing,
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
        valkey_client,
        config,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<HashMap<ObjectType, Vec<String>>>> {
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
            .authorize_infra(
                &authz::Infra(infra_id),
                authz::InfraPrivilege::CanRestrictedRead,
            )
            .await
    })
    .await?;

    // Check track existence
    let infra_cache = InfraCache::get_or_load(
        &mut conn,
        &infra_caches,
        &infra,
        &valkey_client,
        config.app_version.as_deref(),
    )
    .await?;
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
    use crate::views::test_app;
    use crate::views::test_app::TestRequestExt as _;
    use authz::InfraGrant;
    use editoast_models::Infra;
    use editoast_models::prelude::*;
    use schemas::infra::Detector;
    use schemas::infra::TrackSection;
    use schemas::primitives::OSRDIdentified;
    use schemas::primitives::ObjectType;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_attached_detector() {
        let app = test_app!().build();
        let pool = app.db_pool();
        let infra_id = Infra::changeset()
            .name("test_infra".to_owned())
            .last_railjson_version()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create infra")
            .id;

        let user = app
            .user("user", "User")
            .with_infra_grant(infra_id, InfraGrant::Reader)
            .create()
            .await;

        // Create a track and a detector on it
        let track = TrackSection::default().into();
        apply_create_operation(&track, infra_id, &mut pool.get_ok())
            .await
            .expect("Failed to create track object");

        let detector = Detector {
            track: track.get_id().clone().into(),
            ..Default::default()
        }
        .into();
        apply_create_operation(&detector, infra_id, &mut pool.get_ok())
            .await
            .expect("Failed to create detector object");

        let response: HashMap<ObjectType, Vec<String>> = app
            .get(format!("/infra/{}/attached/{}/", infra_id, track.get_id()).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(response.get(&ObjectType::Detector).unwrap().len(), 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_attached_detector_requires_can_read() {
        let app = test_app!().build();
        let pool = app.db_pool();
        let infra_id = Infra::changeset()
            .name("test_infra".to_owned())
            .last_railjson_version()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create infra")
            .id;
        let track = TrackSection::default().into();
        apply_create_operation(&track, infra_id, &mut pool.get_ok())
            .await
            .expect("Failed to create track object");

        let user_no_grant = app.user("alice", "Alice").create().await;
        let user_reader = app
            .user("bob", "Bob")
            .with_infra_grant(infra_id, InfraGrant::Reader)
            .create()
            .await;

        app.get(format!("/infra/{}/attached/{}/", infra_id, track.get_id()).as_str())
            .by_user(user_no_grant.as_ref())
            .await
            .assert_status_forbidden();
        app.get(format!("/infra/{}/attached/{}/", infra_id, track.get_id()).as_str())
            .by_user(user_reader.as_ref())
            .await
            .assert_status_ok();
    }
}
