use common::geometry::GeoJsonLineString;
use schemas::infra::OperationalPointExtensions;
use schemas::infra::OperationalPointPart;
use schemas::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::AsCoreRequest;
use crate::Json;
use crate::pathfinding::TrackRange;

#[cfg(feature = "mocking_client")]
use schemas::infra::OperationalPointPartExtension;
#[cfg(feature = "mocking_client")]
use schemas::infra::OperationalPointSncfExtension;

#[derive(Debug, Hash, Serialize)]
pub struct PathPropertiesRequest<'a> {
    pub track_section_ranges: &'a Vec<TrackRange>,
    pub infra: i64,
    pub expected_version: i64,
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
    /// Zones along the path
    pub zones: PropertyZoneValues,
}

/// Property f64 values along a path. Each value is associated to a range of the path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[cfg_attr(feature = "mocking_client", derive(PartialEq))]
pub struct PropertyValuesF64 {
    /// List of `n` boundaries of the ranges.
    /// A boundary is a distance from the beginning of the path in mm.
    boundaries: Vec<u64>,
    /// List of `n+1` values associated to the ranges
    values: Vec<f64>,
}

#[cfg(feature = "mocking_client")]
impl PropertyValuesF64 {
    pub fn new(boundaries: Vec<u64>, values: Vec<f64>) -> Self {
        assert!(boundaries.len() == values.len() + 1);
        Self { boundaries, values }
    }
}

/// Electrification property along a path. Each value is associated to a range of the path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[cfg_attr(feature = "mocking_client", derive(PartialEq))]
pub struct PropertyElectrificationValues {
    /// List of `n` boundaries of the ranges.
    /// A boundary is a distance from the beginning of the path in mm.
    boundaries: Vec<u64>,
    #[schema(inline)]
    /// List of `n+1` values associated to the ranges
    values: Vec<PropertyElectrificationValue>,
}

#[cfg(feature = "mocking_client")]
impl PropertyElectrificationValues {
    pub fn new(boundaries: Vec<u64>, values: Vec<PropertyElectrificationValue>) -> Self {
        assert!(boundaries.len() == values.len() + 1);
        Self { boundaries, values }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[cfg_attr(feature = "mocking_client", derive(PartialEq))]
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
#[cfg_attr(feature = "mocking_client", derive(PartialEq))]
pub struct OperationalPointOnPath {
    /// Id of the operational point
    #[schema(inline)]
    pub id: Identifier,
    /// The part along the path
    pub part: OperationalPointPart,
    /// Extensions associated to the operational point
    #[serde(default)]
    pub extensions: OperationalPointExtensions,
    /// Distance from the beginning of the path in mm
    pub position: u64,
    /// Importance of the operational point
    #[schema(required, minimum = 0, maximum = 100)]
    pub weight: Option<u8>,
}

#[cfg(feature = "mocking_client")]
impl OperationalPointOnPath {
    pub fn new_test(id: &str, ci: i64, trigram: &str) -> Self {
        OperationalPointOnPath {
            id: Identifier(id.into()),
            part: OperationalPointPart {
                track: Identifier("T1".to_string()),
                position: 0.0,
                extensions: OperationalPointPartExtension { sncf: None },
            },
            extensions: OperationalPointExtensions {
                sncf: Some(OperationalPointSncfExtension::new(ci, "BV", trigram)),
                identifier: None,
            },
            position: 0,
            weight: None,
        }
    }
}

/// Zones along a path. Each value is associated to a range of the path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PropertyZoneValues {
    /// List of `n` boundaries of the ranges.
    /// A boundary is a distance from the beginning of the path in mm.
    boundaries: Vec<u64>,
    /// List of `n+1` values associated to the ranges
    values: Vec<String>,
}

#[cfg(feature = "mocking_client")]
impl PropertyZoneValues {
    pub fn new(boundaries: Vec<u64>, values: Vec<String>) -> Self {
        assert!(boundaries.len() == values.len() + 1);
        Self { boundaries, values }
    }
}

impl AsCoreRequest<Json<PathPropertiesResponse>> for PathPropertiesRequest<'_> {
    const URL_PATH: &'static str = "/path_properties";

    fn worker_id(&self) -> Option<String> {
        Some(self.infra.to_string())
    }
}
