use std::sync::Arc;

use authz;
use authz::InfraGrant;
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
use crate::error::Result;
use crate::generated_data::InfraGeneratedData as _;
use crate::infra_cache::InfraCache;
use crate::views::Authentication;
use crate::views::AuthenticationExt;
use crate::views::infra::InfraApiError;
use crate::views::infra::InfraIdParam;
use database::DbConnectionPoolV2;
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
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
) -> Result<impl IntoResponse> {
    let infra_id = infra.infra_id;
    let infra_meta = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

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
        regulator,
        config,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Query(params): Query<PostRailjsonQueryParams>,
    Json(railjson): Json<RailJson>,
) -> Result<impl IntoResponse> {
    let mut infra = Infra::changeset()
        .name(params.name.clone())
        .last_railjson_version()
        .persist(railjson, &mut db_pool.get().await?)
        .await
        .map_err(RailJsonError::from)?;
    let infra_id = infra.id;

    // Assign OWNER to the user on the infra if authz is enabled
    // NOTE: we use the regulator here instead of the one in the authorizer to bypass the checks on can_share_ownership
    if let Authentication::Authenticated(authorizer) = auth {
        regulator
            .give_infra_grant_unchecked(
                &authz::Subject::User(authz::User(authorizer.user_id())),
                &authz::Infra(infra.id),
                InfraGrant::Owner,
            )
            .await?;
    }

    infra
        .bump_version(&mut db_pool.get().await?)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;
    if params.generate_data {
        let infra_cache = InfraCache::get_or_load(
            &mut db_pool.get().await?,
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
    use schemas::infra::RAILJSON_VERSION;
    use schemas::infra::SwitchType;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    async fn test_get_railjson() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        apply_create_operation(
            &SwitchType::default().into(),
            empty_infra.id,
            &mut db_pool.get_ok(),
        )
        .await
        .expect("Failed to create SwitchType object");

        let railjson: RailJson = app
            .get(&format!("/infra/{}/railjson", empty_infra.id))
            .await
            .assert_status_ok()
            .json();

        assert_eq!(railjson.version, RAILJSON_VERSION);
        assert_eq!(railjson.extended_switch_types.len(), 1);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    async fn test_post_railjson() {
        let app = test_app!().skip_authz().build();
        let db_pool = app.db_pool();

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
            .json(&railjson)
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        assert!(
            Infra::delete_static(&mut db_pool.get_ok(), res.infra)
                .await
                .unwrap()
        );
    }
}
