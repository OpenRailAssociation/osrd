use crate::error::Result;
use crate::study::Study;
use crate::study::{StudyCreateForm, StudyWithScenarios};

use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::post;
use actix_web::web::{Data, Json, Path};

/// Returns `/projects/{project}/studies` routes
pub fn routes() -> impl HttpServiceFactory {
    create
}

#[post("/studies")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<StudyCreateForm>,
    project: Path<i64>,
) -> Result<Json<StudyWithScenarios>> {
    let project = project.into_inner();
    let data = data.into_inner();
    let mut study_payload: Study = data.into();
    study_payload.project_id = Some(project);
    let study = Study::create(db_pool, study_payload).await?;

    Ok(Json(study))
}
