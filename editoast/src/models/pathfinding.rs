//! Provides the [Pathfinding] model

use std::collections::HashSet;

use chrono::NaiveDateTime;
use chrono::Utc;
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use geos::geojson;
use postgis_diesel::types::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::models::Identifiable;
use crate::tables::pathfinding;
use editoast_schemas::infra::Direction;
use editoast_schemas::infra::DirectionalTrackRange;
use editoast_schemas::infra::TrackLocation;

editoast_common::schemas! {
    Slope,
    Curve,
    PathfindingPayload,
    PathWaypoint,
}

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
#[model(table = "pathfinding")]
#[model(retrieve, delete)]
#[diesel(table_name = pathfinding)]
pub struct Pathfinding {
    // TODO: we probably want to use ModelV2 and avoid default 0 (test isolation, the DB assigns a value anyway)
    // See https://github.com/OpenRailAssociation/osrd/pull/5033
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
    pub infra_id: i64,
    pub length: f64,
}

#[derive(Clone, Debug, Serialize, Queryable, Insertable, Derivative, AsChangeset, Model)]
#[derivative(Default(new = "true"))]
#[model(table = "pathfinding")]
#[model(create, update)]
#[diesel(table_name = pathfinding)]
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
    #[diesel(deserialize_as=i64)]
    pub infra_id: Option<i64>,
    #[diesel(deserialize_as=f64)]
    pub length: Option<f64>,
}

impl From<Pathfinding> for PathfindingChangeset {
    fn from(value: Pathfinding) -> Self {
        Self {
            id: Some(value.id),
            owner: Some(value.owner),
            length: Some(value.length),
            created: Some(value.created),
            payload: Some(value.payload),
            slopes: Some(value.slopes),
            curves: Some(value.curves),
            geographic: Some(value.geographic),
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
            length: value.length.expect("invalid changeset result"),
            payload: value.payload.expect("invalid changeset result"),
            slopes: value.slopes.expect("invalid changeset result"),
            curves: value.curves.expect("invalid changeset result"),
            geographic: value.geographic.expect("invalid changeset result"),
            infra_id: value.infra_id.expect("invalid changeset result"),
        }
    }
}

pub type SlopeGraph = Vec<Slope>;
pub type CurveGraph = Vec<Curve>;

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct Slope {
    pub gradient: f64,
    pub position: f64,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct Curve {
    radius: f64,
    position: f64,
}

/// The "payload" of a path
///
/// It contains the route paths and the path waypoints that the simulation returned,
/// but enhanced using data from the infra. Notably, path waypoints are reprojected
/// onto their track section to obtain their geographic representations
/// back.
#[derive(Debug, Clone, PartialEq, Derivative, Deserialize, Serialize, ToSchema)]
#[derivative(Default)]
pub struct PathfindingPayload {
    #[schema(inline)]
    pub route_paths: Vec<RoutePath>,
    pub path_waypoints: Vec<PathWaypoint>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct RoutePath {
    pub route: String,
    pub signaling_type: String,
    #[serde(rename = "track_sections")]
    pub track_ranges: Vec<DirectionalTrackRange>,
}

#[derive(Debug, Clone, PartialEq, Derivative, Deserialize, Serialize, ToSchema)]
#[derivative(Default)]
pub struct PathWaypoint {
    #[schema(required)]
    pub id: Option<String>,
    #[schema(required)]
    pub name: Option<String>,
    pub location: TrackLocation,
    pub duration: f64,
    pub path_offset: f64,
    pub suggestion: bool,
    #[derivative(Default(
        value = "geojson::Geometry::new(geojson::Value::Point(Default::default()))"
    ))]
    #[schema(value_type = GeoJsonPoint)]
    pub geo: geojson::Geometry,
    #[schema(required)]
    pub uic: Option<i64>,
    #[schema(required)]
    pub ch: Option<String>,
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
    use std::sync::Arc;

    use super::*;
    use crate::fixtures::tests::TestFixture;
    use crate::models::Create;
    use editoast_models::DbConnectionPool;

    pub fn simple_pathfinding(infra_id: i64) -> Pathfinding {
        //    T1       T2        T3       T4      T5
        // |------> < ------| |------> |------> |------>
        let route_paths = vec![
            RoutePath {
                route: "route_1".into(),
                track_ranges: vec![
                    DirectionalTrackRange::new("track_1", 0.0, 10.0, Direction::StartToStop),
                    DirectionalTrackRange::new("track_2", 7.0, 10.0, Direction::StopToStart),
                    DirectionalTrackRange::new("track_2", 7.0, 7.0, Direction::StartToStop),
                ],
                signaling_type: "BAL3".into(),
            },
            RoutePath {
                route: "route_2".into(),
                track_ranges: vec![DirectionalTrackRange::new(
                    "track_2",
                    3.0,
                    7.0,
                    Direction::StopToStart,
                )],
                signaling_type: "BAL3".into(),
            },
            RoutePath {
                route: "route_3".into(),
                track_ranges: vec![
                    DirectionalTrackRange::new("track_2", 0.0, 3.0, Direction::StopToStart),
                    DirectionalTrackRange::new("track_3", 0.0, 10.0, Direction::StartToStop),
                    DirectionalTrackRange::new("track_4", 0.0, 2.0, Direction::StartToStop),
                ],
                signaling_type: "BAL3".into(),
            },
            RoutePath {
                route: "route_4".into(),
                track_ranges: vec![
                    DirectionalTrackRange::new("track_4", 2.0, 10.0, Direction::StartToStop),
                    DirectionalTrackRange::new("track_5", 0.0, 8.0, Direction::StartToStop),
                ],
                signaling_type: "BAL3".into(),
            },
        ];
        Pathfinding {
            infra_id,
            payload: diesel_json::Json(PathfindingPayload {
                route_paths,
                ..Default::default()
            }),
            ..Default::default()
        }
    }

    pub async fn simple_pathfinding_fixture(
        infra_id: i64,
        db_pool: Arc<DbConnectionPool>,
    ) -> TestFixture<Pathfinding> {
        let pathfinding = simple_pathfinding(infra_id);
        let mut changeset = PathfindingChangeset::from(pathfinding);
        changeset.id = None;
        let pathfinding: Pathfinding = changeset.create(db_pool.clone()).await.unwrap().into();

        TestFixture::new(pathfinding, db_pool)
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
                DirectionalTrackRange::new("track_1", 0.0, 10.0, Direction::StartToStop),
                DirectionalTrackRange::new("track_2", 0.0, 10.0, Direction::StopToStart),
                DirectionalTrackRange::new("track_3", 0.0, 10.0, Direction::StartToStop),
                DirectionalTrackRange::new("track_4", 0.0, 10.0, Direction::StartToStop),
                DirectionalTrackRange::new("track_5", 0.0, 8.0, Direction::StartToStop),
            ]
        );
    }
}
