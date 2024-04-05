//! This module handles the path properties endpoint.
//! The computation of the properties is done by the core but editoast caches the results in Redis.
//!
//! The cache system handles partial path properties, meaning that :
//! - If a user requests only the slopes, the core will only compute the slopes and editoast will cache the result.
//! - Then if the user requests the gradients and slopes, editoast will retrieve the slopes from the cache and ask the core to compute the gradients.

use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;

use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use derivative::Derivative;
use enumset::EnumSet;
use enumset::EnumSetType;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use serde_qs::actix::QsQuery;
use utoipa::ToSchema;

use super::CACHE_PATH_EXPIRATION;
use crate::client::get_app_version;
use crate::error::Result;
use crate::schema::OperationalPointExtensions;
use crate::schema::OperationalPointPart;
use crate::views::v2::path::retrieve_infra_version;
use crate::views::v2::path::Identifier;
use crate::views::v2::path::TrackRange;
use crate::DbPool;
use crate::RedisClient;
use crate::RedisConnection;
use editoast_common::geometry::GeoJsonLineString;

crate::routes! {
    "/v2/infra/{infra_id}/path_properties" => {post},
}

editoast_common::schemas! {
    PathProperties,
    PathPropertiesInput,
    OperationalPointPart,
    OperationalPointExtensions,
}

/// Properties along a path. Each property is optional since it depends on what the user requests.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Derivative)]
#[derivative(Default)]
struct PathProperties {
    #[schema(inline)]
    /// Slopes along the path
    slopes: Option<PropertyValuesF64>,
    #[schema(inline)]
    /// Gradients along the path
    gradients: Option<PropertyValuesF64>,
    /// Electrification modes and neutral section along the path
    #[schema(inline)]
    electrifications: Option<PropertyValuesString>,
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
        if self.gradients.is_some() {
            properties.insert(Property::Gradients);
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

    /// Merge another path properties into this one
    fn merge(self, other: PathProperties) -> Self {
        Self {
            slopes: self.slopes.or(other.slopes),
            gradients: self.gradients.or(other.gradients),
            electrifications: self.electrifications.or(other.electrifications),
            geometry: self.geometry.or(other.geometry),
            operational_points: self.operational_points.or(other.operational_points),
        }
    }

    /// Filter properties not requested
    pub fn filter_properties(mut self, properties: Properties) -> Self {
        let to_clear = properties.complement();
        for property in to_clear.iter() {
            match property {
                Property::Slopes => self.slopes = None,
                Property::Gradients => self.gradients = None,
                Property::Electrifications => self.electrifications = None,
                Property::Geometry => self.geometry = None,
                Property::OperationalPoints => self.operational_points = None,
            }
        }
        self
    }
}

/// Property f64 values along a path. Each value is associated to a range of the path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Derivative)]
#[derivative(Default)]
struct PropertyValuesF64 {
    /// List of `n` boundaries of the ranges.
    /// A boundary is a distance from the beginning of the path in mm.
    #[derivative(Default(value = "vec![1000]"))]
    boundaries: Vec<u64>,
    /// List of `n+1` values associated to the ranges
    #[derivative(Default(value = "vec![0.5, 1.5]"))]
    values: Vec<f64>,
}

/// Property string values along a path. Each value is associated to a range of the path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Derivative)]
#[derivative(Default)]
struct PropertyValuesString {
    /// List of `n` boundaries of the ranges.
    /// A boundary is a distance from the beginning of the path in mm.
    #[derivative(Default(value = "vec![1000]"))]
    boundaries: Vec<u64>,
    #[schema(inline)]
    /// List of `n+1` values associated to the ranges
    #[derivative(Default(value = r#"vec!["1500V".into(), "25000V".into()]"#))]
    values: Vec<String>,
}

/// Operational point along a path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
struct OperationalPointOnPath {
    /// Id of the operational point
    #[schema(inline)]
    id: Identifier,
    /// The part along the path
    part: OperationalPointPart,
    /// Extensions associated to the operational point
    #[serde(default)]
    extensions: OperationalPointExtensions,
    /// Distance from the beginning of the path in mm
    position: u64,
}
#[derive(Debug, Serialize, Deserialize, ToSchema, Hash)]
struct PathPropertiesInput {
    /// list of track sections
    track_ranges: Vec<TrackRange>,
    /// List of supported electrification modes.
    /// Empty if does not support any electrification
    #[serde(default)]
    rolling_stock_supported_electrification: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
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
    Gradients,
    Electrifications,
    Geometry,
    OperationalPoints,
}

type Properties = EnumSet<Property>;

/// Compute path properties
#[utoipa::path(
    tag = "pathfindingv2",
    params(
        ("infra_id" = i64, Path, description = "The infra id"),
    ),
    request_body = PathPropertiesInput,
    params(
        ("infra_id" = i64, Path, description = "The infra id"),
    ),
    responses(
        (status = 200, description = "Path properties", body = PathProperties),
    ),
)]
#[post("")]
pub async fn post(
    db_pool: Data<DbPool>,
    redis_client: Data<RedisClient>,
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
    let path_properties = retrieve_path_properties(
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
        // TODO : create function that return missing path properties by calling core
        let computed_path_properties = PathProperties {
            slopes: Some(Default::default()),
            gradients: Some(Default::default()),
            electrifications: Some(Default::default()),
            geometry: Some(
                serde_json::from_str(r#"{"type":"LineString","coordinates":[[0,0],[1,1]]}"#)
                    .unwrap(),
            ),
            operational_points: Some(vec![]),
        };
        let path_properties =
            path_properties.merge(computed_path_properties.filter_properties(missing_props));

        // Cache new properties
        cache_path_properties(
            &mut redis_conn,
            infra_id,
            &infra_version,
            &path_properties_input,
            &path_properties,
        )
        .await?;
        return Ok(Json(path_properties));
    }

    // 4) Filter queried properties
    let path_properties = path_properties.filter_properties(query_props);

    Ok(Json(path_properties))
}

/// Retrieves path properties from cache
/// The electrifications property is cached separately because it depends on the rolling stock supported electrifications.
/// This split allows us to avoid miss cache when the rolling stock supported electrifications change.
async fn retrieve_path_properties(
    redis_conn: &mut RedisConnection,
    infra: i64,
    infra_version: &String,
    path_properties_input: &PathPropertiesInput,
) -> Result<PathProperties> {
    let track_ranges = &path_properties_input.track_ranges;
    let path_properties_hash = path_properties_input_hash(infra, infra_version, track_ranges);
    let path_elec_property_hash =
        path_elec_property_input_hash(infra, infra_version, path_properties_input);

    let mut path_properties: PathProperties = redis_conn
        .json_get_ex(&path_properties_hash, CACHE_PATH_EXPIRATION)
        .await?
        .unwrap_or_default();

    let elec_property: Option<PropertyValuesString> = redis_conn
        .json_get_ex(&path_elec_property_hash, CACHE_PATH_EXPIRATION)
        .await?;

    path_properties.electrifications = elec_property;

    Ok(path_properties)
}

/// Set the cache of path properties.
/// The electrifications property is cached separately because it depends on the rolling stock supported electrifications.
/// This split allows us to avoid miss cache when the rolling stock supported electrifications change.
async fn cache_path_properties(
    redis_conn: &mut RedisConnection,
    infra: i64,
    infra_version: &String,
    path_properties_input: &PathPropertiesInput,
    path_properties: &PathProperties,
) -> Result<()> {
    // Compute hashes
    let track_ranges = &path_properties_input.track_ranges;
    let full_hash = path_properties_input_hash(infra, infra_version, track_ranges);
    let elec_hash = path_elec_property_input_hash(infra, infra_version, path_properties_input);

    // Cache all properties except electrifications
    redis_conn
        .json_set_ex(
            &full_hash,
            &PathProperties {
                electrifications: None,
                ..path_properties.clone()
            },
            CACHE_PATH_EXPIRATION,
        )
        .await?;

    // Cache electrifications if computed
    if let Some(electrifications) = &path_properties.electrifications {
        redis_conn
            .json_set_ex(&elec_hash, electrifications, CACHE_PATH_EXPIRATION)
            .await?;
    };

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

/// Compute path properties input hash including electrifications
fn path_elec_property_input_hash(
    infra: i64,
    infra_version: &String,
    path_properties: &PathPropertiesInput,
) -> String {
    let osrd_version = get_app_version().unwrap_or_default();
    let mut hasher = DefaultHasher::new();
    path_properties.hash(&mut hasher);
    let hash_properties_input = hasher.finish();
    format!("path_elec_property.{osrd_version}.{infra}.{infra_version}.{hash_properties_input}")
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
    async fn path_properties_small_infra(#[future] small_infra: TestFixture<Infra>) {
        let service = create_test_service().await;
        let infra = small_infra.await;
        let url = format!("/v2/infra/{}/path_properties?props[]=slopes&props[]=gradients&props[]=electrifications&props[]=geometry&props[]=operational_points", infra.id());

        // Should succeed
        let request = TestRequest::post().uri(&url).set_json(json!(
            {"track_ranges": [{ "track_section": "TD0", "begin": 0, "end": 20000, "direction": "START_TO_STOP" }]})
        ).to_request();
        let response: PathProperties = call_and_read_body_json(&service, request).await;
        assert!(response.slopes.is_some());
        assert!(response.gradients.is_some());
        assert!(response.electrifications.is_some());
        assert!(response.geometry.is_some());
        assert!(response.operational_points.is_some());
    }
}
