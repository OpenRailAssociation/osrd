use actix_web::get;
use actix_web::web::{Data, Json, Path};
use actix_web::{dev::HttpServiceFactory, web};
use editoast_derive::EditoastError;
use serde::Serialize;
use thiserror::Error;

use crate::error::Result;
use crate::models::Pathfinding;
use crate::models::Retrieve;
use crate::schema::LineString;
use crate::DbPool;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pathfinding")]
enum PathfindingError {
    /// Couldn't found the scenario with the given scenario ID
    #[error("Pathfinding {id} does not exist")]
    #[editoast_error(status = 404)]
    NotFound { id: i64 },
}

/// Returns `/pathfinding` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/pathfinding").service(get_pf)
}

#[derive(Clone, Debug, Serialize)]
struct Response {
    pub id: i64,
    pub owner: String,
    pub created: String,
    pub slopes: serde_json::Value,
    pub curves: serde_json::Value,
    pub geographic: LineString,
    pub schematic: LineString,
    pub steps: serde_json::Value,
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
            owner: owner.to_string(),
            created: created.format("%Y-%m-%d %H:%M:%S.%f").to_string(),
            slopes,
            curves,
            geographic: geographic.into(),
            schematic: schematic.into(),
            steps: payload
                .as_object()
                .expect("invalid pathfinding payload")
                .get("path_waypoints")
                .expect("missing 'path_waypoints' from pathfinding payload")
                .clone(),
        }
    }
}

#[get("{id}")]
async fn get_pf(path: Path<i64>, db_pool: Data<DbPool>) -> Result<Json<Response>> {
    let id = path.into_inner();
    match Pathfinding::retrieve(db_pool, id).await? {
        Some(pf) => Ok(Json(pf.into())),
        None => Err(PathfindingError::NotFound { id }.into()),
    }
}
