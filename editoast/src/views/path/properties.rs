//! This module handles the path properties endpoint.
//! The computation of the properties is done by the core but editoast caches the results in Valkey.
//!
//! The cache system handles partial path properties, meaning that :
//! - If a user requests only the slopes, the core will only compute the slopes and editoast will cache the result.
//! - Then if the user requests the curves and slopes, editoast will retrieve the slopes from the cache and ask the core to compute the curves.

use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use core_client::AsCoreRequest;
use core_client::CoreClient;
use core_client::path_properties::OperationalPointOnPath;
use core_client::path_properties::PathPropertiesRequest;
use core_client::path_properties::PropertyElectrificationValues;
use core_client::path_properties::PropertyValuesF64;
use core_client::path_properties::PropertyZoneValues;
use core_client::pathfinding::TrackRange;
use editoast_authz as authz;
use editoast_common::geometry::GeoJsonLineString;
use editoast_schemas::infra::OperationalPointExtensions;
use editoast_schemas::infra::OperationalPointPart;
use enumset::EnumSet;
use enumset::EnumSetType;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use serde_qs::axum::QsQuery;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::AppState;
use crate::ValkeyConnection;
use crate::client::get_app_version;
use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::path::retrieve_infra_version;

crate::routes! {
    "/infra/{infra_id}/path_properties" => post,
}

editoast_common::schemas! {
    PathProperties,
    PathPropertiesInput,
    Property,
    OperationalPointPart,
    OperationalPointExtensions,
}

#[derive(Debug, Serialize, Deserialize, ToSchema, Hash)]
pub struct PathPropertiesInput {
    /// List of track sections
    pub track_section_ranges: Vec<TrackRange>,
}

/// Properties along a path. Each property is optional since it depends on what the user requests.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Default)]
pub struct PathProperties {
    #[schema(inline)]
    /// Slopes along the path
    pub slopes: Option<PropertyValuesF64>,
    #[schema(inline)]
    /// Curves along the path
    pub curves: Option<PropertyValuesF64>,
    /// Electrification modes and neutral section along the path
    #[schema(inline)]
    pub electrifications: Option<PropertyElectrificationValues>,
    /// Geometry of the path
    pub geometry: Option<GeoJsonLineString>,
    /// Operational points along the path
    #[schema(inline)]
    pub operational_points: Option<Vec<OperationalPointOnPath>>,
    /// Zones along the path
    #[schema(inline)]
    pub zones: Option<PropertyZoneValues>,
}

impl PathProperties {
    /// Filter properties not requested
    pub fn filter_properties(mut self, properties: Properties) -> Self {
        let to_clear = properties.complement();
        for property in to_clear.iter() {
            match property {
                Property::Slopes => self.slopes = None,
                Property::Curves => self.curves = None,
                Property::Electrifications => self.electrifications = None,
                Property::Geometry => self.geometry = None,
                Property::OperationalPoints => self.operational_points = None,
                Property::Zones => self.zones = None,
            }
        }
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Props {
    props: Vec<Property>,
}

impl From<Props> for Properties {
    fn from(value: Props) -> Self {
        value
            .props
            .into_iter()
            .map_into::<Self>()
            .fold(Self::default(), |acc, e| acc | e)
    }
}

/// Enum representing the various associated properties that can be returned
#[derive(Debug, Serialize, Deserialize, ToSchema, EnumSetType)]
#[serde(rename_all = "snake_case")]
pub enum Property {
    Slopes,
    Curves,
    Electrifications,
    Geometry,
    OperationalPoints,
    Zones,
}

type Properties = EnumSet<Property>;

/// Compute path properties
#[utoipa::path(
    post, path = "",
    tag = "pathfinding",
    request_body = PathPropertiesInput,
    params(
        ("infra_id" = i64, Path, description = "The infra id"),
        ("props" = Vec<Property>, Query, description = "Path properties"),
    ),
    responses(
        (status = 200, description = "Path properties", body = PathProperties),
    ),
)]
async fn post(
    State(AppState {
        db_pool,
        valkey,
        core_client,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(infra_id): Path<i64>,
    QsQuery(props): QsQuery<Props>,
    Json(path_properties_input): Json<PathPropertiesInput>,
) -> Result<Json<PathProperties>> {
    // Extract information from parameters
    let conn = &mut db_pool.get().await?;
    let infra_version = retrieve_infra_version(conn, infra_id).await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra_read(&authz::Infra(infra_id))
            .await
    })
    .await?;

    let query_props: Properties = props.into();
    let mut valkey_conn = valkey.get_connection().await?;

    let request = PathPropertiesRequest {
        track_section_ranges: &path_properties_input.track_section_ranges,
        infra: infra_id,
        expected_version: infra_version,
    };
    let filtered_path_properties =
        compute_path_properties_batch(core_client, &mut valkey_conn, &[request])
            .await?
            .pop()
            .unwrap()
            .filter_properties(query_props);

    Ok(Json(filtered_path_properties))
}

/// Retrieves path properties from cache.
async fn retrieve_path_properties_from_cache(
    valkey_conn: &mut ValkeyConnection,
    path_properties_request: &PathPropertiesRequest<'_>,
) -> Result<Option<PathProperties>> {
    let hash = path_properties_input_hash(path_properties_request);
    valkey_conn.json_get(&hash).await
}

/// Set the cache of path properties.
async fn cache_path_properties(
    valkey_conn: &mut ValkeyConnection,
    path_properties_request: &PathPropertiesRequest<'_>,
    path_properties: &PathProperties,
) -> Result<()> {
    // Compute hash
    let hash = path_properties_input_hash(path_properties_request);

    // Cache all properties except electrifications
    valkey_conn.json_set(&hash, &path_properties).await?;

    Ok(())
}

/// Compute path properties input hash without supported electrifications
fn path_properties_input_hash(path_properties_request: &PathPropertiesRequest<'_>) -> String {
    let osrd_version = get_app_version().unwrap_or_default();
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

pub async fn compute_path_properties_batch(
    core_client: Arc<CoreClient>,
    valkey_conn: &mut ValkeyConnection,
    path_properties_requests: &[PathPropertiesRequest<'_>],
) -> Result<Vec<PathProperties>> {
    let mut path_properties_result = Vec::with_capacity(path_properties_requests.len());

    for request in path_properties_requests {
        match retrieve_path_properties_from_cache(valkey_conn, request).await? {
            Some(path_properties) => {
                tracing::debug!("Hit cache");
                path_properties_result.push(path_properties);
            }
            None => {
                let computed_path_properties = request.fetch(&core_client).await?;

                let path_properties = PathProperties {
                    slopes: Some(computed_path_properties.slopes),
                    curves: Some(computed_path_properties.curves),
                    electrifications: Some(computed_path_properties.electrifications),
                    geometry: Some(computed_path_properties.geometry),
                    operational_points: Some(computed_path_properties.operational_points),
                    zones: Some(computed_path_properties.zones),
                };

                cache_path_properties(valkey_conn, request, &path_properties).await?;

                path_properties_result.push(path_properties)
            }
        }
    }

    Ok(path_properties_result)
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use core_client::mocking::MockingClient;
    use core_client::path_properties::OperationalPointOnPath;
    use core_client::path_properties::PathPropertiesResponse;
    use core_client::path_properties::PropertyElectrificationValue;
    use core_client::path_properties::PropertyElectrificationValues;
    use core_client::path_properties::PropertyValuesF64;
    use core_client::path_properties::PropertyZoneValues;
    use editoast_common::geometry::GeoJsonLineString;
    use editoast_common::geometry::GeoJsonLineStringValue;
    use editoast_common::geometry::GeoJsonPointValue;
    use editoast_models::DbConnectionPoolV2;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;

    use super::PathProperties;
    use crate::models::fixtures::create_small_infra;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;

    fn path_properties_response() -> PathPropertiesResponse {
        PathPropertiesResponse {
            slopes: PropertyValuesF64::new(vec![0, 1], vec![0.0]),
            curves: PropertyValuesF64::new(vec![0, 1], vec![0.0]),
            electrifications: PropertyElectrificationValues::new(
                vec![0, 1],
                vec![PropertyElectrificationValue::NonElectrified],
            ),
            geometry: GeoJsonLineString::LineString(GeoJsonLineStringValue(vec![
                GeoJsonPointValue(vec![0.0, 0.0]),
            ])),
            operational_points: vec![OperationalPointOnPath::new(
                "1".into(),
                "track-1".into(),
                0.0,
                0,
                None,
            )],
            zones: PropertyZoneValues::new(vec![0, 1], vec!["Zone 1".into()]),
        }
    }

    fn init_test_app() -> TestApp {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = MockingClient::new();

        core.stub("/path_properties")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(path_properties_response())
            .finish();

        TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build()
    }

    #[rstest]
    async fn returns_all_path_properties() {
        let app = init_test_app();
        let infra = create_small_infra(&mut app.db_pool().get_ok()).await;
        let url = format!(
            "/infra/{}/path_properties?props[]=slopes&props[]=curves&props[]=electrifications&props[]=geometry&props[]=operational_points",
            infra.id
        );

        // Should succeed
        let request = app.post(&url).json(&json!(
            {"track_section_ranges": [{ "track_section": "TD0", "begin": 0, "end": 20000, "direction": "START_TO_STOP" }]})
        );
        let response: PathProperties = app.fetch(request).assert_status(StatusCode::OK).json_into();
        let path_properties_response = path_properties_response();
        assert_eq!(response.slopes, Some(path_properties_response.slopes));
        assert_eq!(response.curves, Some(path_properties_response.curves));
        assert_eq!(
            response.electrifications,
            Some(path_properties_response.electrifications)
        );
        assert_eq!(response.geometry, Some(path_properties_response.geometry));
        assert_eq!(
            response.operational_points,
            Some(path_properties_response.operational_points)
        );
    }

    #[rstest]
    async fn returns_only_requested_path_properties() {
        let app = init_test_app();
        let infra = create_small_infra(&mut app.db_pool().get_ok()).await;
        let url = format!(
            "/infra/{}/path_properties?props[]=electrifications&props[]=geometry&props[]=operational_points",
            infra.id
        );

        // Should succeed
        let request = app.post(&url).json(&json!(
            {"track_section_ranges": [{ "track_section": "TD0", "begin": 0, "end": 20000, "direction": "START_TO_STOP" }]})
        );
        let response: PathProperties = app.fetch(request).assert_status(StatusCode::OK).json_into();
        let path_properties_response = path_properties_response();
        assert!(response.slopes.is_none());
        assert!(response.curves.is_none());
        assert_eq!(
            response.electrifications,
            Some(path_properties_response.electrifications)
        );
        assert_eq!(response.geometry, Some(path_properties_response.geometry));
        assert_eq!(
            response.operational_points,
            Some(path_properties_response.operational_points)
        );
    }
}
