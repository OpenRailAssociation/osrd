//! This module handles the path properties endpoint.
//! The computation of the properties is done by the core but editoast caches the results in Valkey.
//!
//! The cache system handles partial path properties, meaning that :
//! - If a user requests only the slopes, the core will only compute the slopes and editoast will cache the result.
//! - Then if the user requests the curves and slopes, editoast will retrieve the slopes from the cache and ask the core to compute the curves.

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use editoast_schemas::infra::Direction;
use editoast_schemas::infra::TrackSection;
use editoast_schemas::primitives::ObjectType;
use enumset::EnumSet;
use enumset::EnumSetType;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use serde_qs::axum::QsQuery;
use std::collections::hash_map::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;
use tracing::info;
use utoipa::ToSchema;

use crate::client::get_app_version;
use crate::core::path_properties::OperationalPointOnPath;
use crate::core::path_properties::PathPropertiesRequest;
use crate::core::path_properties::PropertyElectrificationValues;
use crate::core::path_properties::PropertyValuesF64;
use crate::core::path_properties::PropertyZoneValues;
use crate::core::pathfinding::TrackRange;
use crate::core::AsCoreRequest;
use crate::error::Result;
use crate::models::Infra;
use crate::views::path::PathfindingError;
use crate::AppState;
use crate::Retrieve;
use crate::ValkeyConnection;
use editoast_common::geometry::GeoJsonLineString;
use editoast_schemas::infra::OperationalPointExtensions;
use editoast_schemas::infra::OperationalPointPart;

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
    /// The path offset in mm of each path item given as input of the pathfinding
    /// The first value is always `0` (beginning of the path) and the last one is always equal to the `length` of the path in mm
    pub path_item_positions: Vec<u64>,
}

impl PathPropertiesInput {
    fn get_track_length_cumulative_sums(&self) -> Vec<u64> {
        let mut cumulative_sums = Vec::with_capacity(self.track_section_ranges.len());
        let mut cumulative_sum = 0;

        for track_range in &self.track_section_ranges {
            cumulative_sums.push(cumulative_sum);
            cumulative_sum += track_range.length();
        }

        cumulative_sums
    }

    fn find_track_section_offsets(&self) -> Vec<(String, u64)> {
        let track_length_cumulative_sums = self.get_track_length_cumulative_sums();
        let mut offsets = Vec::new();
        for path_item_position in &self.path_item_positions {
            let Some((track_range, inferior_sum)) = self
                .track_section_ranges
                .iter()
                .zip(&track_length_cumulative_sums)
                .find(|(track_range, cumulative_sum)| {
                    *path_item_position <= **cumulative_sum + track_range.length()
                })
            else {
                continue;
            };

            let offset_on_track_range = path_item_position - inferior_sum;

            let offset_on_track_section = match track_range.direction {
                Direction::StartToStop => track_range.begin + offset_on_track_range,
                Direction::StopToStart => track_range.end - offset_on_track_range,
            };

            offsets.push((
                (*track_range.track_section).clone(),
                offset_on_track_section,
            ));
        }
        offsets
    }

    fn get_ratio(&self, track_section: &TrackSection) -> Vec<(String, f64)> {
        self.find_track_section_offsets()
            .iter()
            .filter(|(tr, _)| tr == track_section.id.as_ref())
            .map(|(_, position)| *position as f64)
            .map(|position| {
                let ratio = position / (track_section.length * 1000_f64);
                (track_section.id.to_string(), ratio)
            })
            .collect::<Vec<_>>()
    }
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
    /// Zones along the path
    #[schema(inline)]
    zones: Option<PropertyZoneValues>,
    /// The path offset ratio for each path item given as input in pathfinding.
    #[schema(inline)]
    path_item_position_ratio: Option<Vec<(String, f64)>>,
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
        if self.zones.is_some() {
            properties.insert(Property::Zones);
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
                Property::Zones => self.zones = None,
                Property::PathItemPositionRatio => self.path_item_position_ratio = None,
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
    Zones,
    PathItemPositionRatio,
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
    Path(infra_id): Path<i64>,
    QsQuery(props): QsQuery<Props>,
    Json(path_properties_input): Json<PathPropertiesInput>,
) -> Result<Json<PathProperties>> {
    // Extract information from parameters
    let conn = &mut db_pool.get().await?;
    let query_props: Properties = props.into();
    let mut valkey_conn = valkey.get_connection().await?;
    let infra = Infra::retrieve_or_fail(conn, infra_id, || PathfindingError::InfraNotFound {
        infra_id,
    })
    .await?;

    // Get track section offsets.
    let track_section_offsets = path_properties_input.find_track_section_offsets();

    // Get the IDs of the track sections.
    let track_section_ids = track_section_offsets
        .iter()
        .map(|ts| ts.0.clone()) // Extract track section IDs.
        .collect();

    // Fetch the track section objects using the IDs.
    let track_sections = infra
        .get_objects(conn, ObjectType::TrackSection, &track_section_ids)
        .await?
        .into_iter()
        .map(|track_section| track_section.railjson)
        .map(serde_json::from_value::<TrackSection>)
        .collect::<Result<Vec<_>, serde_json::Error>>()?;

    let path_item_position_ratio = track_sections
        .iter()
        .map(|ts| path_properties_input.get_ratio(ts))
        .flatten()
        .collect::<Vec<(String, f64)>>();

    // 1) Try to retrieve all the informations from Valkey
    let mut path_properties = retrieve_path_properties(
        &mut valkey_conn,
        infra_id,
        &infra.version,
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
            expected_version: infra.version.clone(),
        };
        let computed_path_properties = request.fetch(&core_client).await?;

        path_properties = PathProperties {
            slopes: Some(computed_path_properties.slopes),
            curves: Some(computed_path_properties.curves),
            electrifications: Some(computed_path_properties.electrifications),
            geometry: Some(computed_path_properties.geometry),
            operational_points: Some(computed_path_properties.operational_points),
            zones: Some(computed_path_properties.zones),
            path_item_position_ratio: Some(path_item_position_ratio),
        };

        // Cache new properties
        cache_path_properties(
            &mut valkey_conn,
            infra_id,
            &infra.version,
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
    valkey_conn: &mut ValkeyConnection,
    infra: i64,
    infra_version: &String,
    path_properties_input: &PathPropertiesInput,
) -> Result<PathProperties> {
    let track_ranges = &path_properties_input.track_section_ranges;
    let hash = path_properties_input_hash(infra, infra_version, track_ranges);

    let path_properties: PathProperties = valkey_conn.json_get(&hash).await?.unwrap_or_default();

    Ok(path_properties)
}

/// Set the cache of path properties.
async fn cache_path_properties(
    valkey_conn: &mut ValkeyConnection,
    infra: i64,
    infra_version: &String,
    path_properties_input: &PathPropertiesInput,
    path_properties: &PathProperties,
) -> Result<()> {
    // Compute hash
    let track_ranges = &path_properties_input.track_section_ranges;
    let hash = path_properties_input_hash(infra, infra_version, track_ranges);

    // Cache all properties except electrifications
    valkey_conn.json_set(&hash, &path_properties).await?;

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
    use axum::http::StatusCode;
    use editoast_schemas::infra::{Direction, TrackSection};
    use rstest::rstest;
    use serde_json::json;

    use super::PathProperties;
    use crate::core::pathfinding::TrackRange;
    use crate::models::fixtures::create_small_infra;
    use crate::views::path::properties::PathPropertiesInput;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    #[ignore] // TODO: Need to mock the core response to fix this test
    async fn path_properties_small_infra() {
        let app = TestAppBuilder::default_app();
        let infra = create_small_infra(&mut app.db_pool().get_ok()).await;
        let url = format!("/infra/{}/path_properties?props[]=slopes&props[]=curves&props[]=electrifications&props[]=geometry&props[]=operational_points", infra.id);

        // Should succeed
        let request = app.post(&url).json(&json!(
            {"track_ranges": [{ "track_section": "TD0", "begin": 0, "end": 20000, "direction": "START_TO_STOP" }]})
        );
        let response: PathProperties = app.fetch(request).assert_status(StatusCode::OK).json_into();
        assert!(response.slopes.is_some());
        assert!(response.curves.is_some());
        assert!(response.electrifications.is_some());
        assert!(response.geometry.is_some());
        assert!(response.operational_points.is_some());
    }

    #[rstest]
    fn test_get_track_length_cumulative_sums() {
        let track_range_1 = TrackRange::new("TR1", 0, 1300, Direction::StartToStop);
        let track_range_2 = TrackRange::new("TR2", 0, 1000, Direction::StartToStop);
        let path_properties_input = PathPropertiesInput {
            track_section_ranges: vec![track_range_1, track_range_2],
            path_item_positions: vec![0, 2300],
        };
        assert_eq!(
            path_properties_input.get_track_length_cumulative_sums(),
            vec![0, 1300]
        );
    }

    #[rstest]
    fn test_find_track_section_offset() {
        let track_range_1 = TrackRange::new("TR1", 0, 400, Direction::StartToStop);
        let track_range_2 = TrackRange::new("TR2", 0, 600, Direction::StartToStop);
        let path_properties_input = PathPropertiesInput {
            track_section_ranges: vec![track_range_1, track_range_2],
            path_item_positions: vec![0, 500, 1000],
        };
        assert_eq!(
            path_properties_input.find_track_section_offsets(),
            vec![
                ("TR1".to_string(), 0),
                ("TR2".to_string(), 100),
                ("TR2".to_string(), 600)
            ]
        );
    }

    #[rstest]
    fn test_get_ratio() {
        let track_range_1 = TrackRange::new("TR1", 0, 4_000, Direction::StartToStop);
        let track_range_2 = TrackRange::new("TR2", 0, 5_000, Direction::StartToStop);
        let path_properties_input = PathPropertiesInput {
            track_section_ranges: vec![track_range_1, track_range_2],
            path_item_positions: vec![0, 5_000, 9_000],
        };
        let track_section = TrackSection {
            id: "TR2".into(),
            length: 5.0,
            ..Default::default()
        };
        assert_eq!(
            path_properties_input.get_ratio(&track_section),
            vec![("TR2".to_string(), 0.2), ("TR2".to_string(), 1.0),]
        );
    }
}
