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
use core_client::path_properties::OperationalPointOnPath;
use core_client::path_properties::OperationalPointOnPathInfo;
use core_client::path_properties::PathPropertiesRequest;
use core_client::path_properties::PropertyElectrificationValues;
use core_client::path_properties::PropertyValuesF64;
use core_client::path_properties::PropertyZoneValues;
use core_client::pathfinding::TrackRange;
use database::DbConnection;
use geos::geojson::Geometry;
use serde::Deserialize;
use serde::Serialize;
use std::hash::Hash;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::AppState;
use crate::error::Result;
use crate::generated_data::operational_point::OperationalPointLayer;
use crate::views::AuthenticationExt;
use crate::views::infra::compute_operational_point_geo;
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
    #[schema(value_type = GeoJsonLineString)]
    geometry: Geometry,
    /// Operational points along the path
    operational_points: Vec<OperationalPointOnPath>,
    /// Zones along the path
    #[schema(inline)]
    zones: PropertyZoneValues,
}

fn build_operational_point_on_path(
    opop_info: &OperationalPointOnPathInfo,
    geo_points: Option<&Vec<Geometry>>,
) -> OperationalPointOnPath {
    OperationalPointOnPath {
        info: opop_info.clone(),
        geo: geo_points.and_then(|points| compute_operational_point_geo(points)),
    }
}

/// Add geographical position to `OperationalPointOnPathInfo`
async fn populate_opop_geo(
    conn: &mut DbConnection,
    infra_id: i64,
    operational_points_on_path: &[OperationalPointOnPathInfo],
) -> Result<Vec<OperationalPointOnPath>> {
    let opop_ids: Vec<_> = operational_points_on_path
        .iter()
        .map(|opop_info| opop_info.id.as_str())
        .collect();
    let geo_points = OperationalPointLayer::get(conn, infra_id, &opop_ids).await?;

    Ok(operational_points_on_path
        .iter()
        .map(|opop| build_operational_point_on_path(opop, geo_points.get(opop.id.as_str())))
        .collect())
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
    .run(Arc::new(tokio::sync::Mutex::new(vkconn)), core_client)
    .await?;

    Ok(Json(PathProperties {
        slopes: path_properties.slopes,
        curves: path_properties.curves,
        electrifications: path_properties.electrifications,
        geometry: path_properties.geometry,
        operational_points: populate_opop_geo(
            conn,
            infra_id,
            path_properties.operational_points.as_slice(),
        )
        .await?,
        zones: path_properties.zones,
    }))
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use core_client::mocking::MockingClient;
    use core_client::path_properties::OperationalPointOnPathInfo;
    use core_client::path_properties::PropertyElectrificationValue;
    use core_client::path_properties::PropertyElectrificationValues;
    use core_client::path_properties::PropertyValuesF64;
    use core_client::path_properties::PropertyZoneValues;
    use pretty_assertions::assert_eq;

    use serde_json::json;

    use super::PathProperties;
    use crate::fixtures::create_small_infra;
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
            geometry: geos::geojson::Geometry::new(geos::geojson::Value::LineString(vec![vec![
                0.0, 0.0,
            ]])),
            operational_points: vec![OperationalPointOnPathInfo::new_test("1", 0, "1")],
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
        let operational_points_info: Vec<_> = response
            .operational_points
            .iter()
            .map(|op| op.info.clone())
            .collect();
        assert_eq!(
            operational_points_info,
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
        let operational_points_info: Vec<_> = response
            .operational_points
            .iter()
            .map(|op| op.info.clone())
            .collect();
        assert_eq!(
            operational_points_info,
            path_properties_response.operational_points
        );
    }
}
