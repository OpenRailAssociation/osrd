use editoast_common::geometry::GeoJsonLineString;
use editoast_schemas::infra::OperationalPointExtensions;
use editoast_schemas::infra::OperationalPointPart;
use editoast_schemas::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::pathfinding::TrackRange;
use crate::core::{AsCoreRequest, Json};

#[derive(Debug, Serialize)]
pub struct PathPropertiesRequest<'a> {
    pub track_section_ranges: &'a Vec<TrackRange>,
    pub infra: i64,
    pub expected_version: String,
}

/// Properties along a path.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathPropertiesResponse {
    /// Slopes along the path
    pub slopes: PropertyValuesF64,
    /// Curves along the path
    pub curves: PropertyValuesF64,
    /// Electrification modes and neutral section along the path
    pub electrifications: PropertyElectrificationValues,
    /// Geometry of the path
    pub geometry: GeoJsonLineString,
    /// Operational points along the path
    pub operational_points: Vec<OperationalPointOnPath>,
}

/// Property f64 values along a path. Each value is associated to a range of the path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PropertyValuesF64 {
    /// List of `n` boundaries of the ranges.
    /// A boundary is a distance from the beginning of the path in mm.
    boundaries: Vec<u64>,
    /// List of `n+1` values associated to the ranges
    values: Vec<f64>,
}

/// Electrification property along a path. Each value is associated to a range of the path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PropertyElectrificationValues {
    /// List of `n` boundaries of the ranges.
    /// A boundary is a distance from the beginning of the path in mm.
    boundaries: Vec<u64>,
    #[schema(inline)]
    /// List of `n+1` values associated to the ranges
    values: Vec<PropertyElectrificationValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PropertyElectrificationValue {
    /// Electrified section with a given voltage
    Electrification { voltage: String },
    /// Neutral section with a lower pantograph instruction or just a dead section
    NeutralSection { lower_pantograph: bool },
    /// Non electrified section
    NonElectrified,
}

/// Operational point along a path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OperationalPointOnPath {
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

impl<'a> AsCoreRequest<Json<PathPropertiesResponse>> for PathPropertiesRequest<'a> {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/v2/path_properties";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra)
    }
}
