use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::response::IntoResponse;
use chrono::Utc;
use derivative::Derivative;
use diesel_async::scoped_futures::ScopedFutureExt;
use diesel_async::AsyncConnection;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::operational_studies::OperationalStudiesOrderingParam;
use crate::decl_paginated_response;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::train_schedule::LightTrainSchedule;
use crate::models::Create;
use crate::models::Delete;
use crate::models::List;
use crate::models::Retrieve;
use crate::models::Scenario;
use crate::models::ScenarioWithCountTrains;
use crate::models::ScenarioWithDetails;
use crate::models::Timetable;
use crate::models::Update;
use crate::modelsv2::Project;
use crate::modelsv2::Study;
use crate::views::pagination::PaginatedResponse;
use crate::views::pagination::PaginationQueryParam;
use crate::views::projects::ProjectError;
use crate::views::projects::ProjectIdParam;
use crate::views::study::StudyError;
use crate::views::study::StudyIdParam;
use crate::AppState;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPool;

crate::routes! {
    "/scenarios" => {
        create,
        list,
        "/{scenario_id}" => {
            get,
            delete,
            patch,
        },
    },
}

editoast_common::schemas! {
    Scenario,
    ScenarioCreateForm,
    ScenarioPatchForm,
    ScenarioWithCountTrains,
    ScenarioWithDetails,
    PaginatedResponseOfScenarioWithCountTrains,
    ScenarioResponse,
    LightTrainSchedule, // TODO: remove from here once train schedule is migrated
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "scenario")]
#[allow(clippy::enum_variant_names)]
enum ScenarioError {
    /// Couldn't found the scenario with the given scenario ID
    #[error("Scenario '{scenario_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { scenario_id: i64 },
}

/// This structure is used by the post endpoint to create a scenario
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct ScenarioCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub infra_id: i64,
    pub electrical_profile_set_id: Option<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl ScenarioCreateForm {
    pub fn into_scenario(self, study_id: i64, timetable_id: i64) -> Scenario {
        Scenario {
            name: Some(self.name),
            study_id: Some(study_id),
            infra_id: Some(self.infra_id),
            electrical_profile_set_id: Some(self.electrical_profile_set_id),
            timetable_id: Some(timetable_id),
            description: Some(self.description),
            tags: Some(self.tags),
            creation_date: Some(Utc::now().naive_utc()),
            ..Default::default()
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct ScenarioResponse {
    #[serde(flatten)]
    pub scenario: Scenario,
    pub infra_name: String,
    pub electrical_profile_set_name: Option<String>,
    pub train_schedules: Vec<LightTrainSchedule>,
    pub trains_count: i64,
    pub project: Project,
    pub study: Study,
}

impl ScenarioResponse {
    pub fn new(
        scenarios_with_details: ScenarioWithDetails,
        project: Project,
        study: Study,
    ) -> Self {
        Self {
            scenario: scenarios_with_details.scenario,
            infra_name: scenarios_with_details.infra_name,
            electrical_profile_set_name: scenarios_with_details.electrical_profile_set_name,
            train_schedules: scenarios_with_details.train_schedules,
            trains_count: scenarios_with_details.trains_count,
            project,
            study,
        }
    }
}

/// Check if project and study exist given a study ID and a project ID
pub async fn check_project_study(
    db_pool: Arc<DbConnectionPool>,
    project_id: i64,
    study_id: i64,
) -> Result<(Project, Study)> {
    let mut conn = db_pool.get().await?;
    check_project_study_conn(&mut conn, project_id, study_id).await
}

pub async fn check_project_study_conn(
    conn: &mut DbConnection,
    project_id: i64,
    study_id: i64,
) -> Result<(Project, Study)> {
    use crate::modelsv2::Retrieve;
    let project =
        Project::retrieve_or_fail(conn, project_id, || ProjectError::NotFound { project_id })
            .await?;
    let study =
        Study::retrieve_or_fail(conn, study_id, || StudyError::NotFound { study_id }).await?;

    if study.project_id != project_id {
        return Err(StudyError::NotFound { study_id }.into());
    }
    Ok((project, study))
}

/// Create a scenario
#[utoipa::path(
    post, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam),
    request_body = ScenarioCreateForm,
    responses(
        (status = 201, body = ScenarioResponse, description = "The created scenario"),
    )
)]
async fn create(
    State(AppState {
        db_pool_v1: db_pool,
        ..
    }): State<AppState>,
    Path((project_id, study_id)): Path<(i64, i64)>,
    Json(data): Json<ScenarioCreateForm>,
) -> Result<Json<ScenarioResponse>> {
    let mut conn = db_pool.get().await?;
    // Check if the project and the study exist
    let (mut project, mut study) =
        check_project_study_conn(&mut conn, project_id, study_id).await?;
    let (project, study, scenarios_with_details) = conn
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Create timetable
                let timetable = Timetable {
                    id: None,
                    name: Some("timetable".into()),
                };
                let timetable = timetable.create(db_pool.clone()).await?;
                let timetable_id = timetable.id.unwrap();

                // Create Scenario
                let scenario: Scenario = data.into_scenario(study_id, timetable_id);
                let scenario = scenario.create(db_pool).await?;

                // Update study last_modification field
                study.update_last_modified(conn).await?;

                // Update project last_modification field
                project.update_last_modified(conn).await?;

                // Return study with list of scenarios
                Ok((project, study, scenario.with_details_conn(conn).await?))
            }
            .scope_boxed()
        })
        .await?;

    let scenarios_response = ScenarioResponse::new(scenarios_with_details, project, study);
    Ok(Json(scenarios_response))
}

#[derive(IntoParams)]
#[allow(unused)]
pub struct ScenarioIdParam {
    scenario_id: i64,
}

/// Delete a scenario
#[utoipa::path(
    delete, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 204, description = "The scenario was deleted successfully"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
async fn delete(
    Path((project_id, study_id, scenario_id)): Path<(i64, i64, i64)>,
    State(AppState {
        db_pool_v1: db_pool,
        ..
    }): State<AppState>,
) -> Result<impl IntoResponse> {
    // Check if the project and the study exist
    let (mut project, mut study) = check_project_study(db_pool.clone(), project_id, study_id)
        .await
        .unwrap();

    // Delete scenario
    if !Scenario::delete(db_pool.clone(), scenario_id).await? {
        return Err(ScenarioError::NotFound { scenario_id }.into());
    }

    // Update project last_modification field
    let conn = &mut db_pool.get().await?;
    project.update_last_modified(conn).await?;

    // Update study last_modification field
    study.update_last_modified(conn).await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// This structure is used by the patch endpoint to patch a study
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct ScenarioPatchForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
}

impl From<ScenarioPatchForm> for Scenario {
    fn from(form: ScenarioPatchForm) -> Self {
        Scenario {
            name: form.name,
            description: form.description,
            tags: form.tags,
            ..Default::default()
        }
    }
}

/// Update a scenario
#[utoipa::path(
    patch, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    request_body = ScenarioPatchForm,
    responses(
        (status = 204, body = ScenarioResponse, description = "The scenario was updated successfully"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
async fn patch(
    Path((project_id, study_id, scenario_id)): Path<(i64, i64, i64)>,
    State(AppState {
        db_pool_v1: db_pool,
        ..
    }): State<AppState>,
    Json(data): Json<ScenarioPatchForm>,
) -> Result<Json<ScenarioResponse>> {
    let mut conn = db_pool.get().await?;

    let (project, study, scenario) = conn
        .transaction::<_, InternalError, _>(|conn| {
            async {
                // Check if project and study exist
                let (mut project, mut study) = check_project_study_conn(conn, project_id, study_id)
                    .await
                    .unwrap();
                // Update the scenario
                let scenario: Scenario = data.into();
                let scenario = match scenario.update_conn(conn, scenario_id).await? {
                    Some(scenario) => scenario,
                    None => return Err(ScenarioError::NotFound { scenario_id }.into()),
                };
                // Update study last_modification field
                study.update_last_modified(conn).await?;
                // Update project last_modification field
                project.update_last_modified(conn).await?;
                Ok((project, study, scenario.with_details_conn(conn).await?))
            }
            .scope_boxed()
        })
        .await?;

    let scenarios_response = ScenarioResponse::new(scenario, project, study);
    Ok(Json(scenarios_response))
}

/// Return a specific scenario
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 200, body = ScenarioResponse, description = "The requested scenario"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
async fn get(
    State(AppState {
        db_pool_v1: db_pool,
        ..
    }): State<AppState>,
    Path((project_id, study_id, scenario_id)): Path<(i64, i64, i64)>,
) -> Result<Json<ScenarioResponse>> {
    let (project, study) = check_project_study(db_pool.clone(), project_id, study_id).await?;

    // Return the scenarios
    let scenario = match Scenario::retrieve(db_pool.clone(), scenario_id).await? {
        Some(scenario) => scenario,
        None => return Err(ScenarioError::NotFound { scenario_id }.into()),
    };

    // Check if the scenario belongs to the study
    if scenario.study_id.unwrap() != study_id {
        return Err(ScenarioError::NotFound { scenario_id }.into());
    }

    let scenarios_with_details = scenario.with_details(db_pool).await?;
    let scenarios_response = ScenarioResponse::new(scenarios_with_details, project, study);
    Ok(Json(scenarios_response))
}

decl_paginated_response!(
    PaginatedResponseOfScenarioWithCountTrains,
    ScenarioWithCountTrains
);

/// Return a list of scenarios
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, PaginationQueryParam, OperationalStudiesOrderingParam),
    responses(
        (status = 200, body = PaginatedResponseOfScenarioWithCountTrains, description = "The list of scenarios"),
    )
)]
async fn list(
    State(AppState {
        db_pool_v1: db_pool,
        ..
    }): State<AppState>,
    Path((project_id, study_id)): Path<(i64, i64)>,
    Query(pagination_params): Query<PaginationQueryParam>,
    Query(params): Query<OperationalStudiesOrderingParam>,
) -> Result<Json<PaginatedResponse<ScenarioWithCountTrains>>> {
    let (page, per_page) = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .unpack();
    let _ = check_project_study(db_pool.clone(), project_id, study_id).await?;
    let ordering = params.ordering.clone();
    let scenarios =
        ScenarioWithCountTrains::list(db_pool, page, per_page, (study_id, ordering)).await?;

    Ok(Json(scenarios))
}

#[cfg(test)]
mod test {
    // There used to be tests here. They were removed because this TSV1 module will be removed soon.
    // These tests were using actix's test API, but we switched to axum, so they were removed instead
    // of being ported.
}
