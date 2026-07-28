use authz::InfraGrant;
use authz::v2;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::http::header;
use axum::response::IntoResponse;
use editoast_derive::EditoastError;
use enum_map::EnumMap;
use futures::future::try_join_all;
use schemas::infra::RailJson;
use serde::Deserialize;
use serde::Serialize;
use strum::IntoEnumIterator;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::AppState;
use crate::authentication;
use crate::authorizers::SystemAuthorizer;
use crate::error::Result;
use crate::generated_data::InfraGeneratedData as _;
use crate::infra_cache::InfraCache;
use crate::views::AuthorizationError;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use editoast_models::Infra;
use editoast_models::prelude::*;
use schemas::primitives::ObjectType;

/// Serialize an infra
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200,  description = "The infra in railjson format", body = RailJson),
        (status = 404, description = "The infra was not found"),
    )
)]
pub(in crate::views) async fn get_railjson(
    Path(infra): Path<InfraIdParam>,
    State(AppState {
        db_pool, openfga, ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
) -> Result<impl IntoResponse> {
    let infra_id = infra.infra_id;
    let infra_meta = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;

    if let authentication::State::Authenticated { user, .. } = &authn_state {
        v2::infra_privileges(*user, authz::Infra(infra_id))
            .map(async |privileges| privileges.contains(&authz::InfraPrivilege::CanRead))
            .ok_or(AuthorizationError::Forbidden)
            .run::<AuthorizationError, _>(&authn_state.authorizer(&openfga))
            .await??;
    }

    let futures: Vec<_> = ObjectType::iter()
        .map(|object_type| (object_type, db_pool.get()))
        .map(|(object_type, conn_future)| async move {
            let conn = &mut conn_future.await?;
            let railjson_data = Infra::get_railjson(conn, infra_id, &object_type).await?;
            let result: Result<_> = Ok((object_type, railjson_data));
            result
        })
        .collect();

    // TODO: we could map the objects in the async loop above, so we can start processing some objects
    // even if we didn’t get everything back yet
    let res: EnumMap<_, _> = try_join_all(futures)
        .await?
        .into_iter()
        .map(|(obj_type, objects)| {
            let obj_list = objects
                .into_iter()
                .map(|obj| obj.railjson)
                .collect::<Vec<_>>()
                .join(",");
            (obj_type, format!("[{obj_list}]"))
        })
        .collect();

    // Here we avoid the deserialization of the whole RailJson object
    let railjson = format!(
        r#"{{
            "version": "{version}",
            "track_sections": {track_sections},
            "signals": {signals},
            "speed_sections": {speed_sections},
            "detectors": {detectors},
            "switches": {switches},
            "extended_switch_types": {switch_types},
            "buffer_stops": {buffer_stops},
            "routes": {routes},
            "operational_points": {operational_points},
            "level_crossings": {level_crossings},
            "electrifications": {electrifications},
            "neutral_sections": {neutral_sections}
        }}"#,
        version = infra_meta.railjson_version,
        track_sections = res[ObjectType::TrackSection],
        signals = res[ObjectType::Signal],
        speed_sections = res[ObjectType::SpeedSection],
        detectors = res[ObjectType::Detector],
        switches = res[ObjectType::Switch],
        switch_types = res[ObjectType::SwitchType],
        buffer_stops = res[ObjectType::BufferStop],
        routes = res[ObjectType::Route],
        operational_points = res[ObjectType::OperationalPoint],
        level_crossings = res[ObjectType::LevelCrossing],
        electrifications = res[ObjectType::Electrification],
        neutral_sections = res[ObjectType::NeutralSection]
    );

    Ok((
        StatusCode::OK,
        [
            (
                header::CONTENT_TYPE.as_str(),
                headers::ContentType::json().to_string(),
            ),
            ("x-infra-version", infra_meta.version.to_string()),
        ],
        railjson,
    ))
}

/// Represents the query parameters for a `POST /infra/railjson` request
#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct PostRailjsonQueryParams {
    /// The name of the infrastructure.
    name: String,
    /// Flag indicating whether to generate data.
    #[serde(default)]
    generate_data: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct PostRailjsonResponse {
    pub infra: i64,
}

#[derive(Debug, derive_more::From, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "railjson")]
pub enum RailJsonError {
    #[error("Unsupported railjson version '{actual}'. Should be {expected}.")]
    UnsupportedVersion { actual: String, expected: String },
    #[error(transparent)]
    #[editoast_error(forward)]
    Database(editoast_models::Error),
}

impl From<editoast_models::railjson::RailJsonError> for RailJsonError {
    fn from(err: editoast_models::railjson::RailJsonError) -> Self {
        use editoast_models::railjson::RailJsonError as ModelsRailJsonError;
        match err {
            ModelsRailJsonError::UnsupportedVersion { actual, expected } => {
                RailJsonError::UnsupportedVersion { actual, expected }
            }
            ModelsRailJsonError::Database(e) => RailJsonError::Database(e),
        }
    }
}

/// Import an infra from railjson
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(PostRailjsonQueryParams),
    request_body = RailJson,
    responses(
        (status = 201,  description = "The imported infra id", body = inline(PostRailjsonResponse)),
        (status = 404, description = "The infra was not found"),
    )
)]
pub(in crate::views) async fn post_railjson(
    State(AppState {
        db_pool,
        infra_caches,
        valkey_client,
        openfga,
        config,
        ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Query(params): Query<PostRailjsonQueryParams>,
    Json(railjson): Json<RailJson>,
) -> Result<impl IntoResponse> {
    let mut conn = db_pool.get().await?;
    let mut infra = Infra::changeset()
        .name(params.name.clone())
        .last_railjson_version()
        .persist(railjson, &mut conn)
        .await
        .map_err(RailJsonError::from)?;

    if let authentication::State::Authenticated { user, .. } = &authn_state {
        let Ok(()) = v2::infra_set_grant(
            authz::Subject::user(*user),
            authz::Infra(infra.id),
            InfraGrant::Owner,
        )
        .authorize(&SystemAuthorizer::new_infallible(&openfga))
        .await?
        .access()
        .await?;
    }

    infra
        .bump_version(&mut conn)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id: infra.id })?;
    if params.generate_data {
        let infra_cache = InfraCache::get_or_load(
            &mut conn,
            &infra_caches,
            &infra,
            &valkey_client,
            config.app_version.as_deref(),
        )
        .await?;
        infra.refresh(db_pool, true, &infra_cache).await?;
    }

    Ok((
        StatusCode::CREATED,
        Json(PostRailjsonResponse { infra: infra.id }),
    ))
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::fixtures::create_empty_infra;
    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::views::test_app;
    use crate::views::test_app::TestRequestExt as _;
    use schemas::infra::RAILJSON_VERSION;
    use schemas::infra::SwitchType;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    async fn get_railjson() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        apply_create_operation(
            &SwitchType::default().into(),
            empty_infra.id,
            &mut db_pool.get_ok(),
        )
        .await
        .expect("Failed to create SwitchType object");

        let railjson: RailJson = app
            .get(&format!("/infra/{}/railjson", empty_infra.id))
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        assert_eq!(railjson.version, RAILJSON_VERSION);
        assert_eq!(railjson.extended_switch_types.len(), 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_railjson_requires_can_read() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;
        let user_reader = app
            .user("alice", "Alice")
            .with_infra_grant(infra_id, InfraGrant::Reader)
            .create()
            .await;
        let user_restricted_reader = app
            .user("bob", "Bob")
            .with_infra_grant(infra_id, InfraGrant::RestrictedReader)
            .create()
            .await;

        app.get(&format!("/infra/{}/railjson", infra_id))
            .by_user(user_restricted_reader.as_ref())
            .await
            .assert_status_forbidden();
        app.get(&format!("/infra/{}/railjson", infra_id))
            .by_user(user_reader.as_ref())
            .await
            .assert_status_ok();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    async fn test_post_railjson() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let user = app
            .user("thomas", "Thomas")
            .with_roles([authz::Role::OperationalStudies])
            .create()
            .await;

        let railjson = RailJson {
            buffer_stops: (0..10).map(|_| Default::default()).collect(),
            routes: (0..10).map(|_| Default::default()).collect(),
            extended_switch_types: (0..10).map(|_| Default::default()).collect(),
            switches: (0..10).map(|_| Default::default()).collect(),
            track_sections: (0..10).map(|_| Default::default()).collect(),
            speed_sections: (0..10).map(|_| Default::default()).collect(),
            electrifications: (0..10).map(|_| Default::default()).collect(),
            signals: (0..10).map(|_| Default::default()).collect(),
            detectors: (0..10).map(|_| Default::default()).collect(),
            operational_points: (0..10).map(|_| Default::default()).collect(),
            ..Default::default()
        };

        let res: PostRailjsonResponse = app
            .post("/infra/railjson?name=post_railjson_test")
            .by_user(user.as_ref())
            .json(&railjson)
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        app.assert_infra_grant(res.infra, user.id, Some(InfraGrant::Owner));
        assert!(
            Infra::delete_static(&mut db_pool.get_ok(), res.infra)
                .await
                .unwrap()
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_post_railjson_requires_operational_studies() {
        let app = test_app!().build();
        let user = app.user("user", "User").create().await;

        app.post("/infra/railjson?name=post_railjson_forbidden_test")
            .by_user(user.as_ref())
            .json(&RailJson::default())
            .await
            .assert_status_forbidden();
    }
}
