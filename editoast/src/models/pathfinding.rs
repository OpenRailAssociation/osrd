//! Provides the [Pathfinding] model

use crate::schema::Direction;
use crate::tables::osrd_infra_pathmodel;
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::prelude::*;
use diesel::result::Error as DieselError;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use editoast_derive::Model;
use postgis_diesel::types::*;
use serde::Deserialize;
use serde::Serialize;

/// Describes a pathfinding that resulted from a simulation and stored in the DB
///
/// It differs from infra/pathfinding that performs a topological pathfinding
/// meant to be used with the infra editor.
#[derive(
    Debug, Clone, Serialize, Insertable, Derivative, Queryable, QueryableByName, AsChangeset, Model,
)]
#[derivative(Default(new = "true"))]
#[model(table = "osrd_infra_pathmodel")]
#[model(create, delete, retrieve, update)]
#[diesel(table_name = osrd_infra_pathmodel)]
pub struct Pathfinding {
    pub id: i64,
    pub owner: uuid::Uuid,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub created: NaiveDateTime,
    #[derivative(Default(value = "diesel_json::Json::new(Default::default())"))]
    pub payload: diesel_json::Json<PathfindingPayload>,
    #[derivative(Default(value = "diesel_json::Json::new(Default::default())"))]
    pub slopes: diesel_json::Json<SlopeGraph>,
    #[derivative(Default(value = "diesel_json::Json::new(Default::default())"))]
    pub curves: diesel_json::Json<CurveGraph>,
    #[derivative(Default(value = "LineString { points: vec![], srid: None }"))]
    pub geographic: LineString<Point>,
    #[derivative(Default(value = "LineString { points: vec![], srid: None }"))]
    pub schematic: LineString<Point>,
    pub infra_id: i64,
}

pub type SlopeGraph = Vec<Slope>;
pub type CurveGraph = Vec<Curve>;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Slope {
    gradient: f64,
    position: f64,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Curve {
    radius: f64,
    position: f64,
}

#[derive(Debug, Clone, Derivative, Deserialize, Serialize)]
#[derivative(Default)]
pub struct PathfindingPayload {
    pub route_paths: Vec<RoutePath>,
    pub path_waypoints: Vec<PathWaypoint>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct RoutePath {
    pub route: String,
    pub signaling_type: String,
    pub track_sections: Vec<RouteTrackSection>,
}

#[derive(Debug, Clone, Derivative, Deserialize, Serialize)]
#[derivative(Default)]
pub struct RouteTrackSection {
    pub track: String,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub direction: Direction,
    pub begin: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct PathWaypoint {
    pub id: Option<String>,
    pub name: Option<String>,
    pub track: String,
    #[serde(default)]
    pub duration: f64,
    pub position: f64,
    pub suggestion: bool,
}
