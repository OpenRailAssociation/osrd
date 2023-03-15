use crate::error::Result;
use crate::models::Create;
use crate::models::Project;
use crate::models::Retrieve;
use crate::models::Study;
use crate::models::StudyWithScenarios;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::post;
use actix_web::web::{Data, Json, Path};
use chrono::NaiveDateTime;
use chrono::Utc;
use derivative::Derivative;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Returns `/projects/{project}/studies` routes
pub fn routes() -> impl HttpServiceFactory {
    create
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "study")]
enum StudyError {
    /// Couldn't found the project with the given project_id
    #[error("Project '{project_id}', could not be found")]
    #[editoast_error(status = 404)]
    ProjectNotFound { project_id: i64 },
}

/// This structure is used by the post endpoint to create a study
#[derive(Serialize, Deserialize, Derivative)]
#[derivative(Default)]
pub struct StudyCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub start_date: Option<NaiveDateTime>,
    pub expected_end_date: Option<NaiveDateTime>,
    pub actual_end_date: Option<NaiveDateTime>,
    #[serde(default)]
    pub business_code: String,
    #[serde(default)]
    pub service_code: String,
    #[serde(default)]
    pub budget: i32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub study_type: String,
}

impl StudyCreateForm {
    pub fn into_study(self, project_id: i64) -> Study {
        Study {
            name: Some(self.name),
            project_id: Some(project_id),
            description: Some(self.description),
            budget: Some(self.budget),
            tags: Some(self.tags),
            creation_date: Some(Utc::now().naive_utc()),
            business_code: Some(self.business_code),
            service_code: Some(self.service_code),
            state: Some(self.state),
            study_type: Some(self.study_type),
            start_date: Some(self.start_date),
            expected_end_date: Some(self.expected_end_date),
            actual_end_date: Some(self.actual_end_date),
            ..Default::default()
        }
    }
}

#[post("/studies")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<StudyCreateForm>,
    project: Path<i64>,
) -> Result<Json<StudyWithScenarios>> {
    let project_id = project.into_inner();
    // Check if project exists
    let project = match Project::retrieve(db_pool.clone(), project_id).await? {
        None => return Err(StudyError::ProjectNotFound { project_id }.into()),
        Some(project) => project,
    };

    // Create study
    let study: Study = data.into_inner().into_study(project_id);
    let study = study.create(db_pool.clone()).await?;

    // Update project last_modification field
    let project = project.update_last_modified(db_pool).await?;
    project.expect("Project should exist");

    // Return study with list of scenarios
    let study_with_scenarios = StudyWithScenarios {
        study,
        scenarios: vec![],
    };

    Ok(Json(study_with_scenarios))
}
