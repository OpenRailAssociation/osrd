//! Provides the [Pathfinding] model

use std::collections::HashSet;

use crate::models::Identifiable;
use crate::schema::Direction;
use crate::schema::DirectionalTrackRange;
use crate::tables::osrd_infra_pathmodel;
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::{prelude::*, result::Error as DieselError, ExpressionMethods, QueryDsl};
use editoast_derive::Model;
use geos::geojson;
use postgis_diesel::types::*;
use serde::{Deserialize, Serialize};

/// Describes a pathfinding that resulted from a simulation and stored in the DB
///
/// It differs from infra/pathfinding that performs a topological pathfinding
/// meant to be used with the infra editor.
#[derive(
    Debug,
    Clone,
    PartialEq,
    Serialize,
    Deserialize,
    Derivative,
    Queryable,
    QueryableByName,
    Model,
    Insertable,
)]
#[derivative(Default(new = "true"))]
#[model(table = "osrd_infra_pathmodel")]
#[model(create, retrieve, delete)]
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

#[derive(Clone, Debug, Serialize, Queryable, Insertable, Derivative, AsChangeset, Model)]
#[derivative(Default(new = "true"))]
#[model(table = "osrd_infra_pathmodel")]
#[model(create, update)]
#[diesel(table_name = osrd_infra_pathmodel)]
pub struct PathfindingChangeset {
    #[diesel(deserialize_as=i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as=uuid::Uuid)]
    pub owner: Option<uuid::Uuid>,
    #[diesel(deserialize_as=NaiveDateTime)]
    pub created: Option<NaiveDateTime>,
    #[diesel(deserialize_as=diesel_json::Json<PathfindingPayload>)]
    pub payload: Option<diesel_json::Json<PathfindingPayload>>,
    #[diesel(deserialize_as=diesel_json::Json<SlopeGraph>)]
    pub slopes: Option<diesel_json::Json<SlopeGraph>>,
    #[diesel(deserialize_as=diesel_json::Json<CurveGraph>)]
    pub curves: Option<diesel_json::Json<CurveGraph>>,
    #[diesel(deserialize_as=LineString<Point>)]
    pub geographic: Option<LineString<Point>>,
    #[diesel(deserialize_as=LineString<Point>)]
    pub schematic: Option<LineString<Point>>,
    #[diesel(deserialize_as=i64)]
    pub infra_id: Option<i64>,
}

impl From<Pathfinding> for PathfindingChangeset {
    fn from(value: Pathfinding) -> Self {
        Self {
            id: Some(value.id),
            owner: Some(value.owner),
            created: Some(value.created),
            payload: Some(value.payload),
            slopes: Some(value.slopes),
            curves: Some(value.curves),
            geographic: Some(value.geographic),
            schematic: Some(value.schematic),
            infra_id: Some(value.infra_id),
        }
    }
}

impl From<PathfindingChangeset> for Pathfinding {
    fn from(value: PathfindingChangeset) -> Self {
        Self {
            id: value.id.expect("invalid changeset result"),
            owner: value.owner.expect("invalid changeset result"),
            created: value.created.expect("invalid changeset result"),
            payload: value.payload.expect("invalid changeset result"),
            slopes: value.slopes.expect("invalid changeset result"),
            curves: value.curves.expect("invalid changeset result"),
            geographic: value.geographic.expect("invalid changeset result"),
            schematic: value.schematic.expect("invalid changeset result"),
            infra_id: value.infra_id.expect("invalid changeset result"),
        }
    }
}

pub type SlopeGraph = Vec<Slope>;
pub type CurveGraph = Vec<Curve>;

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct Slope {
    gradient: f64,
    position: f64,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct Curve {
    radius: f64,
    position: f64,
}

#[derive(Debug, Clone, PartialEq, Derivative, Deserialize, Serialize)]
#[derivative(Default)]
pub struct PathfindingPayload {
    pub route_paths: Vec<RoutePath>,
    pub path_waypoints: Vec<PathWaypoint>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
pub struct RoutePath {
    pub route: String,
    pub signaling_type: String,
    #[serde(rename = "track_sections")]
    pub track_ranges: Vec<DirectionalTrackRange>,
}

#[derive(Debug, Clone, PartialEq, Derivative, Deserialize, Serialize)]
#[derivative(Default)]
pub struct PathWaypoint {
    pub id: Option<String>,
    pub name: Option<String>,
    pub track: String,
    pub duration: f64,
    pub position: f64,
    pub suggestion: bool,
    #[derivative(Default(
        value = "geojson::Geometry::new(geojson::Value::LineString(Default::default()))"
    ))]
    pub geo: geojson::Geometry,
    #[derivative(Default(
        value = "geojson::Geometry::new(geojson::Value::LineString(Default::default()))"
    ))]
    pub sch: geojson::Geometry,
}

impl Pathfinding {
    /// Returns the track sections ids used in this pathfinding
    pub fn track_section_ids(&self) -> HashSet<String> {
        self.payload
            .route_paths
            .iter()
            .flat_map(|route_path| &route_path.track_ranges)
            .map(|track_range| track_range.track.to_string())
            .collect::<HashSet<_>>()
    }

    /// Returns the track ranges covered by this pathfinding's route paths.
    /// Contiguous track ranges on the same track are merged.
    pub fn merged_track_ranges(&self) -> Vec<DirectionalTrackRange> {
        let mut res = Vec::new();
        let mut track_ranges = self
            .payload
            .route_paths
            .iter()
            .flat_map(|route_path| &route_path.track_ranges)
            .filter(|track_range| track_range.begin != track_range.end);
        let mut current_range = track_ranges.next().unwrap().clone();
        for track_range in track_ranges {
            assert!(track_range.begin < track_range.end);
            if track_range.track == current_range.track {
                assert!(track_range.direction == current_range.direction);
                match current_range.direction {
                    Direction::StartToStop => {
                        assert!(current_range.end == track_range.begin);
                        current_range.end = track_range.end;
                    }
                    Direction::StopToStart => {
                        assert!(current_range.begin == track_range.end);
                        current_range.begin = track_range.begin;
                    }
                }
            } else {
                res.push(current_range.clone());
                current_range = track_range.clone();
            }
        }
        res.push(current_range);
        res
    }
}

impl Identifiable for Pathfinding {
    fn get_id(&self) -> i64 {
        self.id
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    pub fn simple_pathfinding(infra_id: i64) -> Pathfinding {
        //    T1       T2        T3       T4      T5
        // |------> < ------| |------> |------> |------>
        Pathfinding {
            infra_id,
            payload: diesel_json::Json(PathfindingPayload {
                route_paths: vec![
                    RoutePath {
                        route: "route_1".into(),
                        track_ranges: vec![
                            DirectionalTrackRange {
                                track: "track_1".into(),
                                begin: 0.0,
                                end: 10.0,
                                direction: Direction::StartToStop,
                            },
                            DirectionalTrackRange {
                                track: "track_2".into(),
                                begin: 7.0,
                                end: 10.0,
                                direction: Direction::StopToStart,
                            },
                            DirectionalTrackRange {
                                // This case happens I swear
                                track: "track_2".into(),
                                begin: 7.0,
                                end: 7.0,
                                direction: Direction::StartToStop,
                            },
                        ],
                        signaling_type: "BAL3".into(),
                    },
                    RoutePath {
                        route: "route_2".into(),
                        track_ranges: vec![DirectionalTrackRange {
                            track: "track_2".into(),
                            begin: 3.0,
                            end: 7.0,
                            direction: Direction::StopToStart,
                        }],
                        signaling_type: "BAL3".into(),
                    },
                    RoutePath {
                        route: "route_3".into(),
                        track_ranges: vec![
                            DirectionalTrackRange {
                                track: "track_2".into(),
                                begin: 0.0,
                                end: 3.0,
                                direction: Direction::StopToStart,
                            },
                            DirectionalTrackRange {
                                track: "track_3".into(),
                                begin: 0.0,
                                end: 10.0,
                                direction: Direction::StartToStop,
                            },
                            DirectionalTrackRange {
                                track: "track_4".into(),
                                begin: 0.0,
                                end: 2.0,
                                direction: Direction::StartToStop,
                            },
                        ],
                        signaling_type: "BAL3".into(),
                    },
                    RoutePath {
                        route: "route_4".into(),
                        track_ranges: vec![
                            DirectionalTrackRange {
                                track: "track_4".into(),
                                begin: 2.0,
                                end: 10.0,
                                direction: Direction::StartToStop,
                            },
                            DirectionalTrackRange {
                                track: "track_5".into(),
                                begin: 0.0,
                                end: 8.0,
                                direction: Direction::StartToStop,
                            },
                        ],
                        signaling_type: "BAL3".into(),
                    },
                ],
                ..Default::default()
            }),
            ..Default::default()
        }
    }

    #[test]
    fn test_path_track_section_ids() {
        let pathfinding = simple_pathfinding(0);
        let track_section_ids = pathfinding.track_section_ids();
        assert_eq!(
            track_section_ids,
            vec!["track_1", "track_2", "track_3", "track_4", "track_5"]
                .into_iter()
                .map(|s| s.to_string())
                .collect::<HashSet<_>>()
        );
    }

    #[test]
    fn test_path_merged_track_ranges() {
        let pathfinding = simple_pathfinding(0);
        let merged_track_ranges = pathfinding.merged_track_ranges();
        assert_eq!(
            merged_track_ranges,
            vec![
                DirectionalTrackRange {
                    track: "track_1".into(),
                    begin: 0.0,
                    end: 10.0,
                    direction: Direction::StartToStop,
                },
                DirectionalTrackRange {
                    track: "track_2".into(),
                    begin: 0.0,
                    end: 10.0,
                    direction: Direction::StopToStart,
                },
                DirectionalTrackRange {
                    track: "track_3".into(),
                    begin: 0.0,
                    end: 10.0,
                    direction: Direction::StartToStop,
                },
                DirectionalTrackRange {
                    track: "track_4".into(),
                    begin: 0.0,
                    end: 10.0,
                    direction: Direction::StartToStop,
                },
                DirectionalTrackRange {
                    track: "track_5".into(),
                    begin: 0.0,
                    end: 8.0,
                    direction: Direction::StartToStop,
                },
            ]
        );
    }
}
