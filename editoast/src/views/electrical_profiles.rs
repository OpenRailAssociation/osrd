use std::collections::HashMap;
use std::sync::Arc;

use authz::Role;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use schemas::infra::ElectricalProfileSetData;
use schemas::infra::LevelValues;
use serde::Deserialize;
use thiserror::Error;
use utoipa::IntoParams;

use super::AuthenticationExt;
use super::AuthorizationError;
use crate::error::Result;
use editoast_models::ElectricalProfileSet;
use editoast_models::LightElectricalProfileSet;
use editoast_models::prelude::*;

#[derive(IntoParams)]
#[allow(unused)]
pub struct ElectricalProfileSetId {
    electrical_profile_set_id: i64,
}

/// Retrieve the list of ids and names of electrical profile sets available
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "electrical_profiles",
    responses(
        (status = 200, body = Vec<LightElectricalProfileSet>, description = "The list of ids and names of electrical profile sets available"),
    )
)]
pub(in crate::views) async fn list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<Vec<LightElectricalProfileSet>>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let mut conn = db_pool.get().await?;
    Ok(Json(ElectricalProfileSet::list_light(&mut conn).await?))
}

/// Return a specific set of electrical profiles
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "electrical_profiles",
    params(ElectricalProfileSetId),
    responses(
        (status = 200, body = ElectricalProfileSetData, description = "The list of electrical profiles in the set"),
    )
)]
pub(in crate::views) async fn get(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(electrical_profile_set_id): Path<i64>,
) -> Result<Json<ElectricalProfileSetData>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let ep_set = ElectricalProfileSet::retrieve_or_fail(
        db_pool.get().await?,
        electrical_profile_set_id,
        || ElectricalProfilesError::NotFound {
            electrical_profile_set_id,
        },
    )
    .await?;
    Ok(Json(ep_set.data))
}

/// Return the electrical profile value order for this set
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "electrical_profiles",
    params(ElectricalProfileSetId),
    responses(
        (status = 200,
            body = HashMap<String, LevelValues>,
            description = "A dictionary mapping electrification modes to a list of electrical profiles ordered by decreasing strength",
            example = json!({
                "1500V": ["A", "B", "C"],
                "25000V": ["25000V", "22500V", "20000V"]
            })
        ),
    )
)]
pub(in crate::views) async fn get_level_order(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(electrical_profile_set_id): Path<i64>,
) -> Result<Json<HashMap<String, LevelValues>>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies, Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let ep_set = ElectricalProfileSet::retrieve_or_fail(
        db_pool.get().await?,
        electrical_profile_set_id,
        || ElectricalProfilesError::NotFound {
            electrical_profile_set_id,
        },
    )
    .await?;
    Ok(Json(ep_set.data.level_order))
}

/// Delete an electrical profile set
#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tag = "electrical_profiles",
    params(ElectricalProfileSetId),
    responses(
        (status = 204, description = "The electrical profile was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(electrical_profile_set_id): Path<i64>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let conn = &mut db_pool.get().await?;
    let deleted = ElectricalProfileSet::delete_static(conn, electrical_profile_set_id).await?;
    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Ok(StatusCode::NOT_FOUND)
    }
}

#[derive(Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct ElectricalProfileQueryArgs {
    name: String,
}

/// import a new electrical profile set
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "electrical_profiles",
    params(ElectricalProfileQueryArgs),
    request_body = ElectricalProfileSetData,
    responses(
        (status = 200, body = ElectricalProfileSet, description = "The list of ids and names of electrical profile sets available"),
    )
)]
pub(in crate::views) async fn post_electrical_profile(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(ep_set_name): Query<ElectricalProfileQueryArgs>,
    Json(ep_data): Json<ElectricalProfileSetData>,
) -> Result<Json<ElectricalProfileSet>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let ep_set = ElectricalProfileSet::changeset()
        .name(ep_set_name.name)
        .data(ep_data);
    let conn = &mut db_pool.get().await?;
    Ok(Json(ep_set.create(conn).await?))
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "electrical_profiles")]
pub enum ElectricalProfilesError {
    /// Couldn't find the electrical profile set with the given id
    #[error("Electrical Profile Set '{electrical_profile_set_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { electrical_profile_set_id: i64 },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[cfg(test)]
mod tests {

    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::models::fixtures::create_electrical_profile_set;
    use crate::views::test_app::TestAppBuilder;
    use schemas::infra::ElectricalProfile;
    use schemas::infra::TrackRange;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_electrical_profile_list() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let _set_1 = create_electrical_profile_set(&mut pool.get_ok()).await;
        let _set_2 = create_electrical_profile_set(&mut pool.get_ok()).await;

        let response = app.get("/electrical_profile_set").await;
        response.assert_status(StatusCode::OK);
        let response: Vec<LightElectricalProfileSet> = response.json();

        assert!(response.len() >= 2);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_unexisting_electrical_profile() {
        let app = TestAppBuilder::default_app();

        let response = app.get("/electrical_profile_set/666").await;
        response.assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_electrical_profile() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let electrical_profile_set = create_electrical_profile_set(&mut pool.get_ok()).await;

        let response = app
            .get(&format!(
                "/electrical_profile_set/{}",
                electrical_profile_set.id
            ))
            .await;
        response.assert_status(StatusCode::OK);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_unexisting_electrical_profile_level_order() {
        let app = TestAppBuilder::default_app();

        let response = app.get("/electrical_profile_set/666/level_order").await;
        response.assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_get_level_order_some() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let electrical_profile_set = create_electrical_profile_set(&mut pool.get_ok()).await;

        let response = app
            .get(&format!(
                "/electrical_profile_set/{}/level_order",
                electrical_profile_set.id
            ))
            .await;
        response.assert_status(StatusCode::OK);
        let level_order: HashMap<String, Vec<String>> = response.json();

        assert_eq!(level_order.len(), 1);
        assert_eq!(
            level_order.get("25000V").unwrap(),
            &vec!["25000V", "22500V", "20000V"]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_unexisting_electrical_profile() {
        let app = TestAppBuilder::default_app();
        let response = app.delete("/electrical_profile_set/666").await;
        response.assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_electrical_profile() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let electrical_profile_set = create_electrical_profile_set(&mut pool.get_ok()).await;

        let response = app
            .delete(&format!(
                "/electrical_profile_set/{}",
                electrical_profile_set.id
            ))
            .await;
        response.assert_status(StatusCode::NO_CONTENT);

        let exists = ElectricalProfileSet::exists(&mut pool.get_ok(), electrical_profile_set.id)
            .await
            .expect("Failed to check if electrical profile set exists");

        assert!(!exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_post() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let ep_set = ElectricalProfileSetData {
            levels: vec![ElectricalProfile {
                value: "A".to_string(),
                power_class: "1".to_string(),
                track_ranges: vec![TrackRange::default()],
            }],
            level_order: Default::default(),
        };

        let response = app
            .post("/electrical_profile_set/?name=elec")
            .json(&ep_set)
            .await;
        response.assert_status(StatusCode::OK);
        let created_ep: ElectricalProfileSet = response.json();

        let created_ep = ElectricalProfileSet::retrieve(pool.get_ok(), created_ep.id)
            .await
            .expect("Failed to retrieve created electrical profile set")
            .expect("Electrical profile set not found");

        assert_eq!(created_ep.name, "elec");
    }
}
