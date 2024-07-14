use derivative::Derivative;
use editoast_schemas::rolling_stock::RollingStock;
use geos::geojson::Geometry;
use geos::geojson::Value::LineString;
use serde::Deserialize;
use serde::Serialize;

use super::AsCoreRequest;
use super::Json;
use crate::models::CurveGraph;
use crate::models::RoutePath;
use crate::models::SlopeGraph;
use editoast_schemas::infra::Direction;
use editoast_schemas::infra::TrackLocation;

pub type PathfindingWaypoints = Vec<Vec<Waypoint>>;

/// A Core pathfinding request, see also [PathfindingResponse]
#[derive(Debug, Clone, Serialize)]
pub struct PathfindingRequest {
    infra: i64,
    expected_version: String,
    waypoints: PathfindingWaypoints,
    rolling_stocks: Vec<RollingStock>,
    timeout: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Waypoint {
    track_section: String,
    offset: f64,
    direction: Direction,
}

/// The response of a Core pathfinding request, see also [PathfindingRequest]
#[derive(Debug, Clone, Derivative, Deserialize, Serialize)]
#[derivative(Default)]
pub struct PathfindingResponse {
    pub length: f64,
    #[derivative(Default(value = "Geometry::new(LineString(Default::default()))"))]
    pub geographic: Geometry,
    pub route_paths: Vec<RoutePath>,
    pub path_waypoints: Vec<PathWaypoint>,
    pub slopes: SlopeGraph,
    pub curves: CurveGraph,
    pub warnings: Vec<Warning>,
}

#[derive(Debug, Clone, Default, Derivative, Deserialize, Serialize)]
pub struct PathWaypoint {
    pub id: Option<String>,
    pub name: Option<String>,
    pub location: TrackLocation,
    pub path_offset: f64,
    pub suggestion: bool,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Warning {
    message: String,
}

impl AsCoreRequest<Json<PathfindingResponse>> for PathfindingRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/pathfinding/routes";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra)
    }
}

impl Waypoint {
    pub fn new(track_section: String, offset: f64, direction: Direction) -> Self {
        Self {
            track_section,
            direction,
            offset,
        }
    }

    pub fn bidirectional<T: AsRef<str>>(track_section: T, offset: f64) -> [Self; 2] {
        let track = track_section.as_ref().to_string();
        [
            Self::new(track.clone(), offset, Direction::StartToStop),
            Self::new(track, offset, Direction::StopToStart),
        ]
    }
}

impl PathfindingRequest {
    pub fn new(infra: i64, expected_version: String, timeout: Option<f64>) -> Self {
        Self {
            infra,
            expected_version,
            waypoints: Default::default(),
            rolling_stocks: Default::default(),
            timeout,
        }
    }

    pub fn with_waypoints(&mut self, waypoints: &mut PathfindingWaypoints) -> &mut Self {
        self.waypoints.append(waypoints);
        self
    }

    pub fn with_rolling_stocks(&mut self, rolling_stocks: &mut Vec<RollingStock>) -> &mut Self {
        self.rolling_stocks.append(rolling_stocks);
        self
    }

    /// Returns the number of waypoints in the request
    pub fn nb_waypoints(&self) -> usize {
        self.waypoints.len()
    }
}
