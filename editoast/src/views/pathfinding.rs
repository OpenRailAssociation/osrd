use actix_web::web::{Data, Json, Path};
use actix_web::{delete, get};
use actix_web::{dev::HttpServiceFactory, web, HttpResponse, Responder};
use chrono::NaiveDateTime;
use editoast_derive::EditoastError;
use serde::Serialize;
use thiserror::Error;

use crate::error::Result;
use crate::models::{CurveGraph, Delete, Retrieve};
use crate::models::{PathWaypoint, Pathfinding, SlopeGraph};
use crate::schema::LineString;
use crate::DbPool;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pathfinding")]
enum PathfindingError {
    #[error("Pathfinding {pathfinding_id} does not exist")]
    #[editoast_error(status = 404)]
    NotFound { pathfinding_id: i64 },
}

/// Returns `/pathfinding` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/pathfinding").service((get_pf, del_pf))
}

#[derive(Clone, Debug, Serialize)]
struct Response {
    pub id: i64,
    pub owner: uuid::Uuid,
    pub created: NaiveDateTime,
    pub slopes: SlopeGraph,
    pub curves: CurveGraph,
    pub geographic: LineString,
    pub schematic: LineString,
    pub steps: Vec<PathWaypoint>,
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
            id,
            owner,
            created,
            slopes: slopes.0,
            curves: curves.0,
            geographic: geographic.into(),
            schematic: schematic.into(),
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
