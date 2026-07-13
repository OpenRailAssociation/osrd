use geos::geojson::Geometry;
use schemas::infra::OperationalPointPart;
use schemas::primitives::Identifier;
use schemas::primitives::NonBlankString;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::AsCoreRequest;
use crate::Json;
use crate::WorkerKey;
use crate::pathfinding::TrackRange;

use schemas::infra::OperationalPointPartExtension;

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
    pub geometry: Geometry,
    /// Operational points along the path
    pub operational_points: Vec<OperationalPointOnPath>,
    /// Zones along the path
    pub zones: PropertyZoneValues,
    // Projection from topologic offset to geometric offset
    pub geom_projection: GeometryProjection,
}

/// Property f64 values along a path. Each value is associated to a range of the path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as = CorePropertyValuesF64)]
#[derive(PartialEq)]
pub struct PropertyValuesF64 {
    /// List of `n` boundaries of the ranges.
    /// A boundary is a distance from the beginning of the path in mm.
    boundaries: Vec<u64>,
    /// List of `n+1` values associated to the ranges
    values: Vec<f64>,
}

impl PropertyValuesF64 {
    pub fn new(boundaries: Vec<u64>, values: Vec<f64>) -> Self {
        assert!(boundaries.len() == values.len() + 1);
        Self { boundaries, values }
    }
}

/// Electrification property along a path. Each value is associated to a range of the path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as = CorePropertyElectrificationValues)]
#[derive(PartialEq)]
pub struct PropertyElectrificationValues {
    /// List of `n` boundaries of the ranges.
    /// A boundary is a distance from the beginning of the path in mm.
    boundaries: Vec<u64>,
    #[schema(inline)]
    /// List of `n+1` values associated to the ranges
    values: Vec<PropertyElectrificationValue>,
}

impl PropertyElectrificationValues {
    pub fn new(boundaries: Vec<u64>, values: Vec<PropertyElectrificationValue>) -> Self {
        assert!(boundaries.len() == values.len() + 1);
        Self { boundaries, values }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as = CorePropertyElectrificationValue, title_variants)]
#[derive(PartialEq)]
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
#[schema(as = CoreOperationalPointOnPath)]
#[derive(PartialEq)]
pub struct OperationalPointOnPath {
    /// Id of the operational point
    #[schema(inline)]
    pub id: Identifier,
    /// The part along the path
    pub part: OperationalPointPart,
    /// Distance from the beginning of the path in mm
    pub position: u64,
    /// Importance of the operational point
    #[schema(required, minimum = 0, maximum = 100)]
    pub weight: Option<u8>,
    #[schema(inline)]
    pub name: NonBlankString,
    pub uic: Option<u32>,
    /// Primary Location Code : https://rne.eu/it/products/ccs/crd/
    #[schema(inline)]
    pub plc: Option<NonBlankString>,
    #[schema(inline)]
    pub country_code: NonBlankString,
    #[schema(inline)]
    pub main_code: NonBlankString,
    #[schema(inline)]
    pub secondary_code: Option<NonBlankString>,
    pub is_passenger_station: bool,
    #[schema(inline)]
    pub secondary_name: Option<NonBlankString>,
}

impl OperationalPointOnPath {
    pub fn new_test(id: &str, uic: u32, main_code: &str) -> Self {
        OperationalPointOnPath {
            id: Identifier(id.into()),
            part: OperationalPointPart {
                track: Identifier("T1".to_string()),
                position: 0.0,
                local_track_name: "V1".into(),
                extensions: OperationalPointPartExtension { sncf: None },
            },
            position: 0,
            weight: None,
            name: "TEST OP".into(),
            uic: Some(uic),
            plc: None,
            country_code: "FR".into(),
            main_code: main_code.into(),
            secondary_code: Some("BV".into()),
            is_passenger_station: true,
            secondary_name: Some("Test OP".into()),
        }
    }
}

/// Zones along a path. Each value is associated to a range of the path.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as = CorePropertyZoneValues)]
pub struct PropertyZoneValues {
    /// List of `n` boundaries of the ranges.
    /// A boundary is a distance from the beginning of the path in mm.
    boundaries: Vec<u64>,
    /// List of `n+1` values associated to the ranges
    values: Vec<String>,
}

impl PropertyZoneValues {
    pub fn new(boundaries: Vec<u64>, values: Vec<String>) -> Self {
        assert!(boundaries.len() == values.len() + 1);
        Self { boundaries, values }
    }
}

/// Projection to map topological offset to geometric offset (or reversed).
/// topo_offsets and geom_offsets are the same size
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as = CorePropertyGeometryProjection)]
pub struct GeometryProjection {
    /// Topological offsets in millimeters.
    /// Starts with 0 and is increasing.
    #[schema(min_items = 2)]
    topo_offsets: Vec<u64>,
    /// Geometric offsets in millimeters.
    /// Starts with 0 and is increasing.
    #[schema(min_items = 2)]
    geom_offsets: Vec<u64>,
}

impl GeometryProjection {
    pub fn new(topo_offsets: Vec<u64>, geom_offsets: Vec<u64>) -> Self {
        assert_eq!(topo_offsets.len(), geom_offsets.len());
        assert!(topo_offsets.len() >= 2);
        Self {
            topo_offsets,
            geom_offsets,
        }
    }
}

impl AsCoreRequest<Json<PathPropertiesResponse>> for PathPropertiesRequest<'_> {
    const URL_PATH: &'static str = "/path_properties";

    fn worker_key(&self) -> WorkerKey {
        WorkerKey::Infra(self.infra)
    }
}
