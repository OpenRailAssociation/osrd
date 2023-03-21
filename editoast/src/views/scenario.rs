use crate::error::Result;
use crate::models::{Create, Project, Retrieve, ScenarioWithDetails, Study, Timetable};
use crate::{models::Scenario, DbPool};
use actix_web::{
    dev::HttpServiceFactory,
    post,
    web::{self, Data, Json, Path},
};
use chrono::Utc;
use derivative::Derivative;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Returns `/projects/{project}/studies/{study}/scenarios` routes
pub fn routes() -> impl HttpServiceFactory {
    web::scope("/scenarios").service(create)
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "scenario")]
enum ScenarioError {
    /// Couldn't found the project with the given project_id
    #[error("Project '{project_id}', could not be found")]
    #[editoast_error(status = 404)]
    ProjectNotFound { project_id: i64 },
    /// Couldn't found the study with the given study_id
    #[error("Study '{study_id}', could not be found")]
    #[editoast_error(status = 404)]
    StudyNotFound { study_id: i64 },
}

/// This structure is used by the post endpoint to create a scenario
#[derive(Serialize, Deserialize, Derivative)]
#[derivative(Default)]
struct ScenarioCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub infra: i64,
    pub electrical_profile_set: Option<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl ScenarioCreateForm {
    pub fn into_scenario(self, study_id: i64, timetable_id: i64) -> Scenario {
        Scenario {
            name: Some(self.name),
            study: Some(study_id),
            infra: Some(self.infra),
            electrical_profile_set: Some(self.electrical_profile_set),
            timetable: Some(timetable_id),
            description: Some(self.description),
            tags: Some(self.tags),
            creation_date: Some(Utc::now().naive_utc()),
            ..Default::default()
        }
    }
}

#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<ScenarioCreateForm>,
    path: Path<(i64, i64)>,
) -> Result<Json<ScenarioWithDetails>> {
    let (project_id, study_id) = path.into_inner();
    // Check if project exists
    let project = match Project::retrieve(db_pool.clone(), project_id).await? {
        None => return Err(ScenarioError::ProjectNotFound { project_id }.into()),
        Some(project) => project,
    };

    // Check if study exists
    let study = match Study::retrieve(db_pool.clone(), study_id).await? {
        None => return Err(ScenarioError::StudyNotFound { study_id }.into()),
        Some(study) => study,
    };
    // Create timetable
    let timetable = Timetable {
        id: None,
        name: Some("timetable".into()),
    };
    let timetable = timetable.create(db_pool.clone()).await?;
    let timetable_id = timetable.id.unwrap();

    // Create Scenario
    let scenario: Scenario = data.into_inner().into_scenario(study_id, timetable_id);
    let scenario = scenario.create(db_pool.clone()).await?;

    // Update study last_modification field
    let study = study.update_last_modified(db_pool.clone()).await?;
    study.expect("Study should exist");

    // Update project last_modification field
    let project = project.update_last_modified(db_pool.clone()).await?;
    project.expect("Project should exist");

    // Return study with list of scenarios
    let scenarios_with_trains = scenario.with_details(db_pool).await?;

    Ok(Json(scenarios_with_trains))
}
