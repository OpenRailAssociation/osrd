use derivative::Derivative;
use geos::geojson::{Geometry, Value::LineString};
use serde::{Deserialize, Serialize};

use crate::models::{CurveGraph, SlopeGraph};
use crate::schema::rolling_stock::RollingStock;
use crate::schema::TrackLocation;
use crate::{models::RoutePath, schema::Direction};

use super::{AsCoreRequest, Json};

pub type PathfindingWaypoints = Vec<Vec<Waypoint>>;

/// A Core pathfinding request, see also [PathfindingResponse]
#[derive(Debug, Serialize)]
pub struct PathfindingRequest {
    infra: i64,
    expected_version: String,
    waypoints: PathfindingWaypoints,
    rolling_stocks: Vec<RollingStock>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Waypoint {
    track_section: String,
    direction: Direction,
    offset: f64,
}

/// The response of a Core pathfinding request, see also [PathfindingRequest]
#[derive(Debug, Clone, Derivative, Deserialize, Serialize)]
#[derivative(Default)]
pub struct PathfindingResponse {
    pub length: f64,
    #[derivative(Default(value = "Geometry::new(LineString(Default::default()))"))]
    pub geographic: Geometry,
    #[derivative(Default(value = "Geometry::new(LineString(Default::default()))"))]
    pub schematic: Geometry,
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
    pub position: f64,
    pub suggestion: bool,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Warning {
    message: String,
}

impl AsCoreRequest<Json<PathfindingResponse>> for PathfindingRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/pathfinding/routes";
}

impl Waypoint {
    pub fn new(track_section: String, offset: f64, direction: Direction) -> Self {
        Self {
            track_section,
            direction,
            offset,
        }
    }

    pub fn bidirectional(track_section: String, offset: f64) -> [Self; 2] {
        [
            Self::new(track_section.clone(), offset, Direction::StartToStop),
            Self::new(track_section, offset, Direction::StopToStart),
        ]
    }
}

impl PathfindingRequest {
    pub fn new(infra: i64, expected_version: String) -> Self {
        Self {
            infra,
            expected_version,
            waypoints: Default::default(),
            rolling_stocks: Default::default(),
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
}
