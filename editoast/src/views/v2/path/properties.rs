//! This module handles the path properties endpoint.
//! The computation of the properties is done by the core but editoast caches the results in Redis.
//!
//! The cache system handles partial path properties, meaning that :
//! - If a user requests only the slopes, the core will only compute the slopes and editoast will cache the result.
//! - Then if the user requests the curves and slopes, editoast will retrieve the slopes from the cache and ask the core to compute the curves.

use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use enumset::EnumSet;
use enumset::EnumSetType;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use serde_qs::actix::QsQuery;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;
use tracing::info;
use utoipa::ToSchema;

use crate::client::get_app_version;
use crate::core::v2::path_properties::OperationalPointOnPath;
use crate::core::v2::path_properties::PathPropertiesRequest;
use crate::core::v2::path_properties::PropertyElectrificationValues;
use crate::core::v2::path_properties::PropertyValuesF64;
use crate::core::v2::pathfinding::TrackRange;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::views::v2::path::retrieve_infra_version;
use crate::RedisClient;
use crate::RedisConnection;
use editoast_common::geometry::GeoJsonLineString;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::OperationalPointExtensions;
use editoast_schemas::infra::OperationalPointPart;

crate::routes! {
    "/v2/infra/{infra_id}/path_properties" => {post},
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
struct PathProperties {
    #[schema(inline)]
    /// Slopes along the path
    slopes: Option<PropertyValuesF64>,
    #[schema(inline)]
    /// Curves along the path
    curves: Option<PropertyValuesF64>,
    /// Electrification modes and neutral section along the path
    #[schema(inline)]
    electrifications: Option<PropertyElectrificationValues>,
    /// Geometry of the path
    geometry: Option<GeoJsonLineString>,
    /// Operational points along the path
    #[schema(inline)]
    operational_points: Option<Vec<OperationalPointOnPath>>,
}

impl PathProperties {
    /// Determines the set of defined properties for the path.
    pub fn get_defined_properties(&self) -> Properties {
        let mut properties = EnumSet::new();

        if self.slopes.is_some() {
            properties.insert(Property::Slopes);
        }
        if self.curves.is_some() {
            properties.insert(Property::Curves);
        }
        if self.electrifications.is_some() {
            properties.insert(Property::Electrifications);
        }
        if self.geometry.is_some() {
            properties.insert(Property::Geometry);
        }
        if self.operational_points.is_some() {
            properties.insert(Property::OperationalPoints);
        }
        properties
    }

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
enum Property {
    Slopes,
    Curves,
    Electrifications,
    Geometry,
    OperationalPoints,
}

type Properties = EnumSet<Property>;

/// Compute path properties
#[utoipa::path(
    tag = "pathfindingv2",
    request_body = PathPropertiesInput,
    params(
        ("infra_id" = i64, Path, description = "The infra id"),
        ("props" = Vec<Property>, Query, description = "Path properties"),
    ),
    responses(
        (status = 200, description = "Path properties", body = PathProperties),
    ),
)]
#[post("")]
pub async fn post(
    db_pool: Data<DbConnectionPoolV2>,
    redis_client: Data<RedisClient>,
    core_client: Data<CoreClient>,
    infra_id: Path<i64>,
    params: QsQuery<Props>,
    data: Json<PathPropertiesInput>,
) -> Result<Json<PathProperties>> {
    // Extract information from parameters
    let conn = &mut db_pool.get().await?;
    let infra_id = infra_id.into_inner();
    let infra_version = retrieve_infra_version(conn, infra_id).await?;
    let path_properties_input = data.into_inner();
    let query_props: Properties = params.into_inner().into();
    let mut redis_conn = redis_client.get_connection().await?;

    // 1) Try to retrieve all the informations from Redis
    let mut path_properties = retrieve_path_properties(
        &mut redis_conn,
        infra_id,
        &infra_version,
        &path_properties_input,
    )
    .await?;

    // 2) Search for missing properties
    let missing_props = query_props - path_properties.get_defined_properties();

    // 3) Compute missing properties
    if !missing_props.is_empty() {
        let request = PathPropertiesRequest {
            track_section_ranges: &path_properties_input.track_section_ranges,
            infra: infra_id,
            expected_version: infra_version.clone(),
        };
        let computed_path_properties = request.fetch(&core_client).await?;

        path_properties = PathProperties {
            slopes: Some(computed_path_properties.slopes),
            curves: Some(computed_path_properties.curves),
            electrifications: Some(computed_path_properties.electrifications),
            geometry: Some(computed_path_properties.geometry),
            operational_points: Some(computed_path_properties.operational_points),
        };

        // Cache new properties
        cache_path_properties(
            &mut redis_conn,
            infra_id,
            &infra_version,
            &path_properties_input,
            &path_properties,
        )
        .await?;
    } else {
        info!("Hit cache");
    }

    // 4) Filter queried properties
    let filtered_path_properties = path_properties.filter_properties(query_props);

    Ok(Json(filtered_path_properties))
}

/// Retrieves path properties from cache.
async fn retrieve_path_properties(
    redis_conn: &mut RedisConnection,
    infra: i64,
    infra_version: &String,
    path_properties_input: &PathPropertiesInput,
) -> Result<PathProperties> {
    let track_ranges = &path_properties_input.track_section_ranges;
    let hash = path_properties_input_hash(infra, infra_version, track_ranges);

    let path_properties: PathProperties = redis_conn.json_get(&hash).await?.unwrap_or_default();

    Ok(path_properties)
}

/// Set the cache of path properties.
async fn cache_path_properties(
    redis_conn: &mut RedisConnection,
    infra: i64,
    infra_version: &String,
    path_properties_input: &PathPropertiesInput,
    path_properties: &PathProperties,
) -> Result<()> {
    // Compute hash
    let track_ranges = &path_properties_input.track_section_ranges;
    let hash = path_properties_input_hash(infra, infra_version, track_ranges);

    // Cache all properties except electrifications
    redis_conn.json_set(&hash, &path_properties).await?;

    Ok(())
}

/// Compute path properties input hash without supported electrifications
fn path_properties_input_hash(
    infra: i64,
    infra_version: &String,
    track_ranges: &[TrackRange],
) -> String {
    let osrd_version = get_app_version().unwrap_or_default();
    let mut hasher = DefaultHasher::new();
    track_ranges.hash(&mut hasher);
    let hash_track_ranges = hasher.finish();
    format!("path_properties.{osrd_version}.{infra}.{infra_version}.{hash_track_ranges}")
}

#[cfg(test)]
mod tests {
    use actix_web::test::call_and_read_body_json;
    use actix_web::test::TestRequest;
    use rstest::rstest;
    use serde_json::json;

    use super::PathProperties;
    use crate::fixtures::tests::small_infra;
    use crate::fixtures::tests::TestFixture;
    use crate::modelsv2::infra::Infra;
    use crate::views::tests::create_test_service;

    #[rstest]
    #[ignore] // TODO: Need to mock the core response to fix this test
    async fn path_properties_small_infra(#[future] small_infra: TestFixture<Infra>) {
        let service = create_test_service().await;
        let infra = small_infra.await;
        let url = format!("/v2/infra/{}/path_properties?props[]=slopes&props[]=curves&props[]=electrifications&props[]=geometry&props[]=operational_points", infra.id());

        // Should succeed
        let request = TestRequest::post().uri(&url).set_json(json!(
            {"track_ranges": [{ "track_section": "TD0", "begin": 0, "end": 20000, "direction": "START_TO_STOP" }]})
        ).to_request();
        let response: PathProperties = call_and_read_body_json(&service, request).await;
        assert!(response.slopes.is_some());
        assert!(response.curves.is_some());
        assert!(response.electrifications.is_some());
        assert!(response.geometry.is_some());
        assert!(response.operational_points.is_some());
    }
}
