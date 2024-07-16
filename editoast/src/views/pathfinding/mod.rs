mod electrical_profiles;
mod electrifications;
mod path_rangemap;

use std::collections::HashMap;
use std::collections::HashSet;
use std::sync::Arc;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use chrono::DateTime;
use chrono::Utc;
use derivative::Derivative;
use editoast_derive::EditoastError;
use editoast_schemas::infra::TrackRange;
use editoast_schemas::rolling_stock::RollingStock;
use geos::geojson::Geometry;
use geos::geojson::{self};
use geos::Geom;
use postgis_diesel::types::LineString;
use postgis_diesel::types::Point;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use crate::core::pathfinding::PathfindingRequest as CorePathfindingRequest;
use crate::core::pathfinding::PathfindingResponse;
use crate::core::pathfinding::PathfindingWaypoints;
use crate::core::pathfinding::Waypoint as CoreWaypoint;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::models::Create;
use crate::models::Curve;
use crate::models::Delete;
use crate::models::PathWaypoint;
use crate::models::Pathfinding;
use crate::models::PathfindingChangeset;
use crate::models::PathfindingPayload;
use crate::models::Retrieve;
use crate::models::Slope;
use crate::models::Update;
use crate::modelsv2::infra_objects::TrackSectionModel;
use crate::modelsv2::Infra;
use crate::modelsv2::OperationalPointModel;
use crate::modelsv2::Retrieve as RetrieveV2;
use crate::modelsv2::RollingStockModel;
use crate::AppState;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPool;
use editoast_schemas::infra::ApplicableDirectionsTrackRange;
use editoast_schemas::infra::OperationalPoint;
use editoast_schemas::infra::TrackSection;

crate::routes! {
    "/pathfinding" => {
        create_pf,
        "/{pathfinding_id}" => {
            get_pf,
            del_pf,
            update_pf,
            &electrifications,
            &electrical_profiles,
        },
    },
}

editoast_common::schemas! {
    PathResponse,
    PathfindingRequest,
    PathfindingStep,
    Waypoint,
    WaypointLocation,
    electrifications::schemas(),
    electrical_profiles::schemas(),
}

#[derive(Debug, Error, EditoastError, Serialize)]
#[editoast_error(base_id = "pathfinding")]
#[allow(clippy::enum_variant_names)]
enum PathfindingError {
    #[error("Pathfinding {pathfinding_id} does not exist")]
    #[editoast_error(status = 404)]
    NotFound { pathfinding_id: i64 },
    #[error("Electrification {electrification_id} overlaps with other electrifications")]
    #[editoast_error(status = 500)]
    ElectrificationOverlap {
        electrification_id: String,
        overlapping_ranges: Vec<ApplicableDirectionsTrackRange>,
    },
    #[error("Electrical Profile overlaps with others")]
    #[editoast_error(status = 500)]
    ElectricalProfilesOverlap { overlapping_ranges: Vec<TrackRange> },
    #[error("Infra {infra_id} does not exist")]
    #[editoast_error(status = 404)]
    InfraNotFound { infra_id: i64 },
    #[error("Track sections do not exist: {track_sections:?}")]
    #[editoast_error(status = 404)]
    TrackSectionsNotFound { track_sections: HashSet<String> },
    #[error("Operational points do not exist: {operational_points:?}")]
    #[editoast_error(status = 404)]
    OperationalPointsNotFound { operational_points: HashSet<String> },
    #[error("Rolling stock with id {rolling_stock_id} doesn't exist")]
    #[editoast_error(status = 404)]
    RollingStockNotFound { rolling_stock_id: i64 },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, ToSchema)]
pub(super) struct PathResponse {
    pub(super) id: i64,
    pub(super) owner: uuid::Uuid,
    pub(super) length: f64,
    pub(super) created: DateTime<Utc>,
    pub(super) slopes: Vec<Slope>,
    pub(super) curves: Vec<Curve>,
    #[schema(value_type = GeoJsonLineString)]
    // #[derivative(Default(value = "Geometry::new(LineString(Default::default()))"))]
    pub(super) geographic: Geometry,
    pub(super) steps: Vec<PathWaypoint>,
}

impl From<Pathfinding> for PathResponse {
    fn from(value: Pathfinding) -> Self {
        let Pathfinding {
            id,
            owner,
            length,
            created,
            slopes,
            curves,
            geographic,
            payload,
            ..
        } = value;
        Self {
            id,
            owner,
            length,
            created: DateTime::from_naive_utc_and_offset(created, Utc),
            slopes: slopes.0,
            curves: curves.0,
            geographic: diesel_linestring_to_geojson(geographic),
            steps: payload.0.path_waypoints,
        }
    }
}

#[derive(Debug, Default, Deserialize, ToSchema)]
struct PathfindingRequest {
    infra: i64,
    steps: Vec<PathfindingStep>,
    #[serde(default)]
    rolling_stocks: Vec<i64>,
}

#[derive(Debug, Default, Serialize, Deserialize, PartialEq, Clone, ToSchema)]
pub struct PathfindingStep {
    pub duration: f64,
    pub waypoints: Vec<Waypoint>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct Waypoint {
    /// A track section UUID
    track_section: String,
    /// The location of the waypoint on the track section
    #[serde(flatten)]
    location: WaypointLocation,
}

#[derive(Debug, Clone, Derivative, Serialize, Deserialize, PartialEq, ToSchema)]
#[derivative(Default)]
#[serde(rename_all = "snake_case")]
enum WaypointLocation {
    /// Offset in meters from the start of the waypoint's track section
    #[derivative(Default)]
    Offset(f64),
    /// A geographic coordinate (lon, lat)/WGS84 that will be projected onto the waypoint's track section
    GeoCoordinate((f64, f64)),
}

impl Waypoint {
    /// Projects the waypoint onto the tracksection and builds a bidirectional Core
    /// waypoint payload
    fn compute_waypoints(&self, track_map: &TrackMap) -> Vec<CoreWaypoint> {
        let track = track_map.get(&self.track_section).unwrap();
        let offset = match self.location {
            WaypointLocation::GeoCoordinate((lon, lat)) => {
                let point =
                    geos::Geometry::try_from(geojson::Geometry::new(geojson::Value::Point(vec![
                        lon, lat,
                    ])))
                    .unwrap();
                let normalized_offset = geos::Geometry::try_from(track.geo.clone())
                    .unwrap()
                    .project_normalized(&point)
                    .expect("could not compute the projection of the waypoint");
                normalized_offset * track.length
            }
            WaypointLocation::Offset(offset) => offset,
        };
        let [wp, wp2] = CoreWaypoint::bidirectional(&track.id, offset);
        vec![wp, wp2]
    }
}

pub type TrackMap = HashMap<String, TrackSection>;
type OpMap = HashMap<String, OperationalPoint>;

/// Computes a hash map (obj_id => TrackSection) for each obj_id in an iterator
pub(in crate::views) async fn make_track_map<I: Iterator<Item = String> + Send>(
    conn: &mut DbConnection,
    infra_id: i64,
    it: I,
) -> Result<TrackMap> {
    use crate::modelsv2::prelude::*;
    let ids = it.map(|id| (infra_id, id));
    let track_sections: Vec<_> = TrackSectionModel::retrieve_batch_or_fail(conn, ids, |missing| {
        PathfindingError::TrackSectionsNotFound {
            track_sections: missing.into_iter().map(|(_, obj_id)| obj_id).collect(),
        }
    })
    .await?;
    Ok(track_sections
        .into_iter()
        .map(|TrackSectionModel { obj_id, schema, .. }| (obj_id, schema))
        .collect())
}

async fn make_op_map<I: Iterator<Item = String> + Send>(
    conn: &mut DbConnection,
    infra_id: i64,
    it: I,
) -> Result<OpMap> {
    use crate::modelsv2::prelude::*;
    let ids = it.map(|id| (infra_id, id));
    let track_sections: Vec<_> =
        OperationalPointModel::retrieve_batch_or_fail(conn, ids, |missing| {
            PathfindingError::OperationalPointsNotFound {
                operational_points: missing.into_iter().map(|(_, obj_id)| obj_id).collect(),
            }
        })
        .await?;
    Ok(track_sections
        .into_iter()
        .map(|OperationalPointModel { obj_id, schema, .. }| (obj_id, schema))
        .collect())
}

impl PathfindingRequest {
    /// Queries all track sections of the payload and builds a track hash map
    async fn fetch_track_map(&self, conn: &mut DbConnection) -> Result<TrackMap> {
        fetch_pathfinding_payload_track_map(conn, self.infra, &self.steps).await
    }

    /// Parses all payload waypoints into Core pathfinding request waypoints
    fn parse_waypoints(&self, track_map: &TrackMap) -> Result<PathfindingWaypoints> {
        parse_pathfinding_payload_waypoints(&self.steps, track_map)
    }

    /// Fetches all payload's rolling stocks
    async fn parse_rolling_stocks(&self, conn: &mut DbConnection) -> Result<Vec<RollingStock>> {
        use crate::modelsv2::RetrieveBatch;
        let rolling_stock_batch: Vec<RollingStockModel> =
            RollingStockModel::retrieve_batch_or_fail(
                conn,
                self.rolling_stocks.iter().copied(),
                |missing| {
                    let first_missing_id = missing
                        .iter()
                        .next()
                        .expect("Retrieve batch fail without missing ids");
                    PathfindingError::RollingStockNotFound {
                        rolling_stock_id: *first_missing_id,
                    }
                },
            )
            .await?;
        let rolling_stocks = rolling_stock_batch
            .into_iter()
            .map(|rs| rs.into())
            .collect();
        Ok(rolling_stocks)
    }
}

pub async fn fetch_pathfinding_payload_track_map(
    conn: &mut DbConnection,
    infra: i64,
    steps: &[PathfindingStep],
) -> Result<TrackMap> {
    make_track_map(
        conn,
        infra,
        steps
            .iter()
            .flat_map(|step| step.waypoints.iter())
            .map(|waypoint| waypoint.track_section.clone()),
    )
    .await
}

pub fn parse_pathfinding_payload_waypoints(
    steps: &[PathfindingStep],
    track_map: &TrackMap,
) -> Result<PathfindingWaypoints> {
    let waypoints = steps
        .iter()
        .map(|step| {
            step.waypoints
                .iter()
                .flat_map(|wp| wp.compute_waypoints(track_map))
                .collect()
        })
        .collect();
    Ok(waypoints)
}

impl PathfindingResponse {
    pub async fn fetch_track_map(&self, infra: i64, conn: &mut DbConnection) -> Result<TrackMap> {
        make_track_map(
            conn,
            infra,
            self.path_waypoints
                .iter()
                .map(|wp| wp.location.track_section.0.clone()),
        )
        .await
    }

    pub async fn fetch_op_map(&self, infra: i64, conn: &mut DbConnection) -> Result<OpMap> {
        make_op_map(
            conn,
            infra,
            self.path_waypoints.iter().filter_map(|wp| wp.id.clone()),
        )
        .await
    }
}

impl Pathfinding {
    /// Post-processes the Core pathfinding reponse and build a [Pathfinding] model
    pub fn from_core_response(
        steps_duration: Vec<f64>,
        response: PathfindingResponse,
        track_map: &TrackMap,
        op_map: &OpMap,
    ) -> Result<Self> {
        let PathfindingResponse {
            length,
            geographic,
            route_paths,
            path_waypoints,
            slopes,
            curves,
            ..
        } = response;
        let mut steps_duration = steps_duration.into_iter();
        let path_waypoints = path_waypoints
            .iter()
            .map(|waypoint| {
                let duration = if waypoint.suggestion {
                    0.0
                } else {
                    steps_duration.next().unwrap()
                };
                let op_info = waypoint.id.as_ref().map(|op_id| {
                    let op = op_map.get(op_id).expect("unexpected OP id");
                    let name = op
                        .extensions
                        .identifier
                        .as_ref()
                        .map(|ident| ident.name.as_ref().to_owned());
                    let uic = op.extensions.identifier.as_ref().map(|ident| ident.uic);
                    let ch = op.extensions.sncf.as_ref().map(|sncf| sncf.ch.to_owned());
                    (name, uic, ch)
                });
                let (name, uic, ch) = op_info.unwrap_or_default();
                let track = track_map
                    .get(&waypoint.location.track_section.0)
                    .expect("unexpected track id");
                let normalized_offset = waypoint.location.offset / track.length;
                let geo = geos::Geometry::try_from(&track.geo)
                    .unwrap()
                    .interpolate_normalized(normalized_offset)
                    .unwrap();
                let geo = geos::geojson::Geometry::try_from(geo).unwrap();
                PathWaypoint {
                    id: waypoint.id.clone(),
                    name,
                    location: waypoint.location.clone(),
                    duration,
                    path_offset: waypoint.path_offset,
                    suggestion: waypoint.suggestion,
                    geo,
                    uic,
                    ch,
                }
            })
            .collect();
        Ok(Pathfinding {
            length,
            payload: diesel_json::Json(PathfindingPayload {
                route_paths: route_paths.to_vec(),
                path_waypoints,
            }),
            slopes: diesel_json::Json(slopes.to_vec()),
            curves: diesel_json::Json(curves.to_vec()),
            geographic: geojson_to_diesel_linestring(&geographic),
            ..Default::default() // creation date, uuid, id, infra_id
        })
    }
}

/// Builds a Core pathfinding request, runs it, post-processes the response and stores it in the DB
async fn call_core_pf_and_save_result(
    payload: PathfindingRequest,
    db_pool: Arc<DbConnectionPool>,
    core_client: Arc<CoreClient>,
    update_id: Option<i64>,
) -> Result<Pathfinding> {
    let conn = &mut db_pool.get().await?;

    // Checks that the pf to update exists in the first place in order to fail early and avoid unnecessary core requests
    if let Some(id) = update_id {
        if Pathfinding::retrieve_conn(conn, id).await?.is_none() {
            return Err(PathfindingError::NotFound { pathfinding_id: id }.into());
        }
    }
    let infra_id = payload.infra;
    let infra = <Infra as RetrieveV2<_>>::retrieve_or_fail(conn, infra_id, || {
        PathfindingError::InfraNotFound { infra_id }
    })
    .await?;

    let track_map = payload.fetch_track_map(conn).await?;
    let mut waypoints = payload.parse_waypoints(&track_map)?;
    let mut rolling_stocks = payload.parse_rolling_stocks(conn).await?;
    let mut path_request = CorePathfindingRequest::new(infra.id, infra.version, None);
    path_request
        .with_waypoints(&mut waypoints)
        .with_rolling_stocks(&mut rolling_stocks);
    let steps_duration = payload.steps.iter().map(|step| step.duration).collect();
    let path_response = path_request.fetch(&core_client).await?;
    save_core_pathfinding(path_response, conn, infra_id, update_id, steps_duration).await
}

/// Turn a core pathfinding response into a [Pathfinding] model and store it in the DB
/// If `update_id` is provided then update the corresponding path instead of creating a new one
pub async fn save_core_pathfinding(
    core_response: PathfindingResponse,
    conn: &mut DbConnection,
    infra_id: i64,
    update_id: Option<i64>,
    steps_duration: Vec<f64>,
) -> Result<Pathfinding> {
    let response_track_map = core_response.fetch_track_map(infra_id, conn).await?;
    let response_op_map = core_response.fetch_op_map(infra_id, conn).await?;
    let pathfinding = Pathfinding::from_core_response(
        steps_duration,
        core_response,
        &response_track_map,
        &response_op_map,
    )?;
    let changeset = PathfindingChangeset {
        id: None,
        infra_id: Some(infra_id),
        ..pathfinding.into()
    };
    let pathfinding: Pathfinding = if let Some(id) = update_id {
        changeset
            .update_conn(conn, id)
            .await?
            .expect("row should exist - checked earlier")
            .into()
    } else {
        changeset.create_conn(conn).await?.into()
    };
    Ok(pathfinding)
}

/// Run a pathfinding between waypoints and store the resulting path in the DB
#[utoipa::path(
    post, path = "",
    tag = "pathfinding",
    request_body = PathfindingRequest,
    responses(
        (status = 201, body = PathResponse, description = "The created path")
    )
)]
async fn create_pf(
    State(AppState {
        db_pool_v1: db_pool,
        core_client,
        ..
    }): State<AppState>,
    Json(payload): Json<PathfindingRequest>,
) -> Result<Json<PathResponse>> {
    let pathfinding = call_core_pf_and_save_result(payload, db_pool, core_client, None).await?;
    Ok(Json(pathfinding.into()))
}

#[derive(Deserialize, utoipa::IntoParams)]
struct PathfindingIdParam {
    /// A stored path ID
    pathfinding_id: i64,
}

/// Updates an existing path with the result of a new pathfinding run
#[utoipa::path(
    put, path = "",
    tag = "pathfinding",
    request_body = PathfindingRequest,
    params(PathfindingIdParam),
    responses(
        (status = 200, body = PathResponse, description = "The updated path"),
    )
)]
async fn update_pf(
    Path(params): Path<PathfindingIdParam>,
    State(AppState {
        db_pool_v1: db_pool,
        core_client,
        ..
    }): State<AppState>,
    Json(payload): Json<PathfindingRequest>,
) -> Result<Json<PathResponse>> {
    let pathfinding =
        call_core_pf_and_save_result(payload, db_pool, core_client, Some(params.pathfinding_id))
            .await?;
    Ok(Json(pathfinding.into()))
}

/// Retrieves a stored path
#[utoipa::path(
    get, path = "",
    tag = "pathfinding",
    params(PathfindingIdParam),
    responses(
        (status = 200, body = PathResponse, description = "The requested path"),
    )
)]
async fn get_pf(
    Path(params): Path<PathfindingIdParam>,
    State(AppState {
        db_pool_v1: db_pool,
        ..
    }): State<AppState>,
) -> Result<Json<PathResponse>> {
    let pathfinding_id = params.pathfinding_id;
    match Pathfinding::retrieve(db_pool, pathfinding_id).await? {
        Some(pf) => Ok(Json(pf.into())),
        None => Err(PathfindingError::NotFound { pathfinding_id }.into()),
    }
}

/// Deletes a stored path
#[utoipa::path(
    delete, path = "",
    tag = "pathfinding",
    params(PathfindingIdParam),
    responses(
        (status = 204, description = "The path was deleted"),
    )
)]
async fn del_pf(
    Path(params): Path<PathfindingIdParam>,
    State(AppState {
        db_pool_v1: db_pool,
        ..
    }): State<AppState>,
) -> Result<impl IntoResponse> {
    let pathfinding_id = params.pathfinding_id;
    if Pathfinding::delete(db_pool, pathfinding_id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(PathfindingError::NotFound { pathfinding_id }.into())
    }
}

fn geojson_to_diesel_linestring(geo: &Geometry) -> LineString<Point> {
    match &geo.value {
        geojson::Value::LineString(ls) => LineString {
            points: ls
                .iter()
                .map(|p| {
                    let [x, y] = p.as_slice() else { panic!("no") };
                    Point::new(*x, *y, None)
                })
                .collect(),
            srid: None,
        },
        _ => panic!("not implemented"),
    }
}

fn diesel_linestring_to_geojson(ls: LineString<Point>) -> Geometry {
    Geometry::new(geojson::Value::LineString(
        ls.points.into_iter().map(|p| vec![p.x, p.y]).collect(),
    ))
}

#[cfg(test)]
mod test {
    // There used to be tests here. They were removed because this TSV1 module will be removed soon.
    // These tests were using actix's test API, but we switched to axum, so they were removed instead
    // of being ported.
}
