use crate::error::Result;
use crate::DbPool;

use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, block, scope, Data, Json, Path};
use actix_web::{get, post, HttpResponse, Responder};

use crate::projects::Project;
use crate::projects::ProjectData;

/// Returns `/projects` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/projects")
        .service((create, list))
        .service(scope("/{project}").service(get))
}

#[post("")]
async fn create(db_pool: Data<DbPool>, data: Json<ProjectData>) -> Result<impl Responder> {
    let project = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Project::create(data, &mut conn)
    })
    .await
    .unwrap()?;
    Ok(HttpResponse::Created().json(project))
}

/// Return a list of projects
#[get("")]
async fn list(db_pool: Data<DbPool>) -> Result<Json<Vec<Project>>> {
    block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Ok(Json(Project::list(&mut conn)))
    })
    .await
    .unwrap()
}

/// Return a specific infra
#[get("")]
async fn get(db_pool: Data<DbPool>, project: Path<i64>) -> Result<Json<Project>> {
    let project = project.into_inner();
    block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        Ok(Json(Project::retrieve(&mut conn, project)?))
    })
    .await
    .unwrap()
}
