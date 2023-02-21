use crate::error::Result;
use crate::DbPool;

use actix_web::dev::HttpServiceFactory;
use actix_web::web::{self, block, Data, Json};
use actix_web::{post, HttpResponse, Responder};

use crate::projects::Project;
use crate::projects::ProjectData;

/// Returns `/projects` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/projects").service(create)
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
