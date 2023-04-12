mod catenaries;

use actix_web::{
    delete,
    dev::HttpServiceFactory,
    get,
    web::{self, Data, Json, Path},
    HttpResponse, Responder,
};
use chrono::NaiveDateTime;
use editoast_derive::EditoastError;
use geos::geojson::{self, Geometry};
use postgis_diesel::types::{LineString, Point};
use serde::Serialize;
use thiserror::Error;

use crate::{
    error::Result,
    models::{CurveGraph, Delete, PathWaypoint, Pathfinding, Retrieve, SlopeGraph},
    schema::ApplicableDirectionsTrackRange,
    DbPool,
};

#[derive(Debug, Error, EditoastError, Serialize)]
#[editoast_error(base_id = "pathfinding")]
enum PathfindingError {
    #[error("Pathfinding {pathfinding_id} does not exist")]
    #[editoast_error(status = 404)]
    NotFound { pathfinding_id: i64 },
    #[error("Catenary {catenary_id} overlaps with other catenaries on the same track")]
    #[editoast_error(status = 500)]
    CatenaryOverlap {
        catenary_id: String,
        overlapping_ranges: Vec<ApplicableDirectionsTrackRange>,
    },
}

/// Returns `/pathfinding` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/pathfinding").service((get_pf, del_pf, catenaries::routes()))
}

#[derive(Clone, Debug, Serialize)]
struct Response {
    pub id: i64,
    pub owner: uuid::Uuid,
    pub created: NaiveDateTime,
    pub slopes: SlopeGraph,
    pub curves: CurveGraph,
    pub geographic: Geometry,
    pub schematic: Geometry,
    pub steps: Vec<PathWaypoint>,
}

fn diesel_linestring_to_geojson(ls: LineString<Point>) -> Geometry {
    Geometry::new(geojson::Value::LineString(
        ls.points.into_iter().map(|p| vec![p.x, p.y]).collect(),
    ))
}

impl From<Pathfinding> for Response {
    fn from(value: Pathfinding) -> Self {
        let Pathfinding {
            id,
            owner,
            created,
            slopes,
            curves,
            geographic,
            schematic,
            payload,
            ..
        } = value;
        Self {
            id: id.expect("Pathfinding ID should be set"),
            owner,
            created,
            slopes: slopes.0,
            curves: curves.0,
            geographic: diesel_linestring_to_geojson(geographic),
            schematic: diesel_linestring_to_geojson(schematic),
            steps: payload.0.path_waypoints,
        }
    }
}

#[get("{id}")]
async fn get_pf(path: Path<i64>, db_pool: Data<DbPool>) -> Result<Json<Response>> {
    let pathfinding_id = path.into_inner();
    match Pathfinding::retrieve(db_pool, pathfinding_id).await? {
        Some(pf) => Ok(Json(pf.into())),
        None => Err(PathfindingError::NotFound { pathfinding_id }.into()),
    }
}

#[delete("{id}")]
async fn del_pf(path: Path<i64>, db_pool: Data<DbPool>) -> Result<impl Responder> {
    let pathfinding_id = path.into_inner();
    if Pathfinding::delete(db_pool, pathfinding_id).await? {
        Ok(HttpResponse::NoContent())
    } else {
        Err(PathfindingError::NotFound { pathfinding_id }.into())
    }
}
