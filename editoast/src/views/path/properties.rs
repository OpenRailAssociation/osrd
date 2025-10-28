//! This module handles the path properties endpoint.
//! The computation of the properties is done by the core but editoast caches the results in Valkey.
//!
//! The cache system handles partial path properties, meaning that :
//! - If a user requests only the slopes, the core will only compute the slopes and editoast will cache the result.
//! - Then if the user requests the curves and slopes, editoast will retrieve the slopes from the cache and ask the core to compute the curves.

use authz;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use common::geometry::GeoJsonLineString;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::path_properties::OperationalPointOnPath;
use core_client::path_properties::PathPropertiesRequest;
use core_client::path_properties::PropertyElectrificationValues;
use core_client::path_properties::PropertyValuesF64;
use core_client::path_properties::PropertyZoneValues;
use core_client::pathfinding::TrackRange;
use itertools::Either;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::path::retrieve_infra_version;

#[derive(Debug, Serialize, Deserialize, ToSchema, Hash)]
pub struct PathPropertiesInput {
    /// List of track sections
    pub track_section_ranges: Vec<TrackRange>,
}

/// Properties along a path. Each property is optional since it depends on what the user requests.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct PathProperties {
    #[schema(inline)]
    /// Slopes along the path
    slopes: PropertyValuesF64,
    #[schema(inline)]
    /// Curves along the path
    curves: PropertyValuesF64,
    /// Electrification modes and neutral section along the path
    #[schema(inline)]
    electrifications: PropertyElectrificationValues,
    /// Geometry of the path
    geometry: GeoJsonLineString,
    /// Operational points along the path
    #[schema(inline)]
    operational_points: Vec<OperationalPointOnPath>,
    /// Zones along the path
    #[schema(inline)]
    zones: PropertyZoneValues,
}

impl From<core_client::path_properties::PathPropertiesResponse> for PathProperties {
    fn from(response: core_client::path_properties::PathPropertiesResponse) -> Self {
        PathProperties {
            slopes: response.slopes,
            curves: response.curves,
            electrifications: response.electrifications,
            geometry: response.geometry,
            operational_points: response.operational_points,
            zones: response.zones,
        }
    }
}

/// Compute path properties
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "pathfinding",
    request_body = PathPropertiesInput,
    params(
        ("infra_id" = i64, Path, description = "The infra id"),
    ),
    responses(
        (status = 200, description = "Path properties", body = PathProperties),
    ),
)]
pub(in crate::views) async fn post(
    State(AppState {
        db_pool,
        valkey_client,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(infra_id): Path<i64>,
    Json(path_properties_input): Json<PathPropertiesInput>,
) -> Result<Json<PathProperties>> {
    // Extract information from parameters
    let conn = &mut db_pool.get().await?;
    let infra_version = retrieve_infra_version(conn, infra_id).await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    use core_task::Task as _;
    let vkconn = valkey_client.get_connection().await?;
    let path_properties = PathPropertiesRequest {
        track_section_ranges: &path_properties_input.track_section_ranges,
        infra: infra_id,
        expected_version: infra_version,
    }
    .run(vkconn, core_client)
    .await?;

    Ok(Json(PathProperties::from(path_properties)))
}

/// Retrieves path properties from cache.
#[tracing::instrument(skip_all, err)]
async fn retrieve_path_properties_from_cache<'a>(
    conn: &mut cache::Connection,
    requests: &'a [PathPropertiesRequest<'a>],
    app_version: Option<&str>,
) -> Result<
    impl Iterator<
        Item = (
            &'a PathPropertiesRequest<'a>,
            Option<core_client::path_properties::PathPropertiesResponse>,
        ),
    >,
> {
    let keys = requests
        .iter()
        .map(|req| path_properties_input_hash(req, app_version))
        .collect_vec();
    // required to collect because json_get_bulk takes a slice...
    let cached = conn.json_get_bulk(&keys).await?.collect_vec();
    Ok(requests.iter().zip(cached.into_iter()))
}

/// Set the cache of path properties.
#[tracing::instrument(skip_all, err)]
async fn cache_path_properties<'a>(
    conn: &mut cache::Connection,
    properties: impl IntoIterator<
        Item = (
            &'a PathPropertiesRequest<'a>,
            &'a core_client::path_properties::PathPropertiesResponse,
        ),
    >,
    app_version: Option<&str>,
) -> Result<()> {
    let data = properties
        .into_iter()
        .map(|(req, resp)| (path_properties_input_hash(req, app_version), resp))
        .collect_vec();
    conn.json_set_bulk(&data).await.map_err(Into::into)
}

/// Compute path properties input hash without supported electrifications
fn path_properties_input_hash(
    path_properties_request: &PathPropertiesRequest<'_>,
    app_version: Option<&str>,
) -> String {
    let osrd_version = app_version.unwrap_or_default();
    let mut hasher = DefaultHasher::new();
    path_properties_request
        .track_section_ranges
        .hash(&mut hasher);
    let hash_track_ranges = hasher.finish();
    format!(
        "path_properties.{osrd_version}.{infra}.{infra_version}.{hash_track_ranges}",
        infra = path_properties_request.infra,
        infra_version = path_properties_request.expected_version
    )
}

#[tracing::instrument(skip_all, err)]
pub(in crate::views) async fn compute_path_properties_batch(
    core_client: Arc<CoreClient>,
    conn: &mut cache::Connection,
    requests: &[PathPropertiesRequest<'_>],
    app_version: Option<&str>,
) -> Result<impl Iterator<Item = core_client::path_properties::PathPropertiesResponse>> {
    let (cached, to_compute): (Vec<_>, Vec<_>) =
        retrieve_path_properties_from_cache(conn, requests, app_version)
            .await?
            .partition_map(|(req, res)| match res {
                Some(res) => Either::Left(res),
                None => Either::Right(req),
            });

    tracing::debug!(
        hit = cached.len(),
        miss = to_compute.len(),
        "retrieved path properties from cache"
    );

    let futures = to_compute.iter().map(|req| req.fetch(&core_client));
    let computed = futures::future::try_join_all(futures).await?;

    tracing::debug!(computed = computed.len(), "computed path properties");

    cache_path_properties(
        conn,
        to_compute.into_iter().zip(computed.iter()),
        app_version,
    )
    .await?;

    tracing::debug!("cached path properties");

    Ok(cached.into_iter().chain(computed.into_iter()))
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use common::geometry::GeoJsonLineString;
    use common::geometry::GeoJsonLineStringValue;
    use common::geometry::GeoJsonPointValue;
    use core_client::mocking::MockingClient;
    use core_client::path_properties::OperationalPointOnPath;
    use core_client::path_properties::PropertyElectrificationValue;
    use core_client::path_properties::PropertyElectrificationValues;
    use core_client::path_properties::PropertyValuesF64;
    use core_client::path_properties::PropertyZoneValues;
    use pretty_assertions::assert_eq;

    use serde_json::json;

    use super::PathProperties;
    use crate::models::fixtures::create_small_infra;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;

    fn path_properties_response() -> core_client::path_properties::PathPropertiesResponse {
        core_client::path_properties::PathPropertiesResponse {
            slopes: PropertyValuesF64::new(vec![0, 1], vec![0.0]),
            curves: PropertyValuesF64::new(vec![0, 1], vec![0.0]),
            electrifications: PropertyElectrificationValues::new(
                vec![0, 1],
                vec![PropertyElectrificationValue::NonElectrified],
            ),
            geometry: GeoJsonLineString::LineString(GeoJsonLineStringValue(vec![
                GeoJsonPointValue(vec![0.0, 0.0]),
            ])),
            operational_points: vec![OperationalPointOnPath::new_test("1", 0, "1")],
            zones: PropertyZoneValues::new(vec![0, 1], vec!["Zone 1".into()]),
        }
    }

    fn init_test_app() -> TestApp {
        let mut core = MockingClient::new();

        core.stub("/path_properties")
            .response(StatusCode::OK)
            .json(path_properties_response())
            .finish();

        TestAppBuilder::new().core_client(core.into()).build()
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn returns_all_path_properties() {
        let app = init_test_app();
        let infra = create_small_infra(&mut app.db_pool().get_ok()).await;
        let url = format!("/infra/{}/path_properties", infra.id);

        // Should succeed
        let request = app.post(&url).json(&json!(
            {"track_section_ranges": [{ "track_section": "TD0", "begin": 0, "end": 20000, "direction": "START_TO_STOP" }]})
        );
        let response: PathProperties = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        let path_properties_response = path_properties_response();
        assert_eq!(response.slopes, path_properties_response.slopes);
        assert_eq!(response.curves, path_properties_response.curves);
        assert_eq!(
            response.electrifications,
            path_properties_response.electrifications
        );
        assert_eq!(response.geometry, path_properties_response.geometry);
        assert_eq!(
            response.operational_points,
            path_properties_response.operational_points
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn returns_only_requested_path_properties() {
        let app = init_test_app();
        let infra = create_small_infra(&mut app.db_pool().get_ok()).await;
        let url = format!("/infra/{}/path_properties", infra.id);

        // Should succeed
        let request = app.post(&url).json(&json!(
            {"track_section_ranges": [{ "track_section": "TD0", "begin": 0, "end": 20000, "direction": "START_TO_STOP" }]})
        );
        let response: PathProperties = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        let path_properties_response = path_properties_response();
        assert_eq!(response.slopes, path_properties_response.slopes);
        assert_eq!(response.curves, path_properties_response.curves);
        assert_eq!(
            response.electrifications,
            path_properties_response.electrifications
        );
        assert_eq!(response.geometry, path_properties_response.geometry);
        assert_eq!(
            response.operational_points,
            path_properties_response.operational_points
        );
    }
}
