use crate::decl_paginated_response;
use crate::error::Result;
use crate::models::train_schedule::LightTrainSchedule;
use crate::models::{List, Study};
use crate::modelsv2::scenario::{Scenario, ScenarioWithDetails};
use crate::modelsv2::timetable::Timetable;
use crate::modelsv2::timetable::TimetableChangeset;
use crate::modelsv2::{Changeset, Model, Project};
use thiserror::Error;

use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::views::projects::{ProjectIdParam, QueryParams};
use crate::views::scenario::{check_project_study, check_project_study_conn, ScenarioIdParam};
use crate::views::study::StudyIdParam;
use crate::DbPool;
use actix_web::web::Query;
use actix_web::{delete, HttpResponse};
use chrono::NaiveDateTime;

use actix_web::get;
use actix_web::patch;
use actix_web::{
    post,
    web::{Data, Json, Path},
};
use derivative::Derivative;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

crate::routes! {
    "/v2/scenarios" => {
        create,
        "/{scenario_id}" => {
            get,
            delete,
            patch,
        }
    }
}

crate::schemas! {
    ScenarioCreateForm,
    ScenarioPatchForm,
    ScenarioWithDetails,
    PaginatedResponseOfScenarioWithDetails,
    ScenarioResponse,
    LightTrainSchedule, // TODO: remove from here once train schedule is migrated
}

/// This structure is used by the post endpoint to create a scenario
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct ScenarioCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub infra_id: i64,
    #[serde(default)]
    pub tags: Vec<Option<String>>,
}

impl From<ScenarioCreateForm> for Changeset<Scenario> {
    fn from(scenario: ScenarioCreateForm) -> Self {
        Scenario::changeset()
            .name(scenario.name)
            .description(scenario.description)
            .infra_id(scenario.infra_id)
            .tags(scenario.tags)
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "scenario")]
#[allow(clippy::enum_variant_names)]
pub enum ScenarioError {
    /// Couldn't found the scenario with the given scenario ID

    #[error("Scenario '{scenario_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { scenario_id: i64 },
}

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct ScenarioResponse {
    pub id: i64,
    pub infra_id: i64,
    pub name: String,
    pub description: String,
    pub creation_date: NaiveDateTime,
    pub last_modification: NaiveDateTime,
    pub tags: Vec<Option<String>>,
    pub timetable_id: i64,
    pub study_id: i64,
    pub infra_name: String,
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
            id: scenarios_with_details.scenario.id,
            infra_id: scenarios_with_details.scenario.infra_id,
            name: scenarios_with_details.scenario.name,
            description: scenarios_with_details.scenario.description,
            creation_date: scenarios_with_details.scenario.creation_date,
            last_modification: scenarios_with_details.scenario.last_modification,
            tags: scenarios_with_details.scenario.tags,
            timetable_id: scenarios_with_details.scenario.timetable_id,
            study_id: scenarios_with_details.scenario.study_id,
            infra_name: scenarios_with_details.infra_name,
            trains_count: scenarios_with_details.trains_count,
            project,
            study,
        }
    }
}

/// Create a scenario
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam),
    request_body = ScenarioCreateForm,
    responses(
        (status = 201, body = ScenarioResponse, description = "The created scenario"),
    )
)]
#[post("")]
async fn create(
    db_pool: Data<DbPool>,
    data: Json<ScenarioCreateForm>,
    path: Path<(i64, i64)>,
) -> Result<Json<ScenarioResponse>> {
    use crate::modelsv2::Create;
    let (project_id, study_id) = path.into_inner();
    let scenario: Changeset<Scenario> = data.into_inner().into();

    let conn = &mut db_pool.get().await?;

    // Check if the project and the study exist
    let (project, study) = check_project_study_conn(conn, project_id, study_id).await?;

    // Create timetable

    let timetable =
        TimetableChangeset::create(Timetable::changeset().electrical_profile_set_id(None), conn)
            .await?;
    // Create Scenario
    let scenario = scenario
        .timetable_id(timetable.id)
        .study_id(study_id)
        .create(conn)
        .await?;

    // Update study last_modification field
    let study = study
        .clone()
        .update_last_modified_conn(conn)
        .await?
        .expect("Study should exist");

    // Update project last_modification field
    let project = project
        .clone()
        .update_last_modified(conn)
        .await?;

    let scenarios_with_details = scenario.with_details_conn(conn).await?;

    let scenarios_response = ScenarioResponse::new(scenarios_with_details, project, study);
    Ok(Json(scenarios_response))
}

/// Delete a scenario
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 204, description = "The scenario was deleted successfully"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
#[delete("")]
async fn delete(path: Path<(i64, i64, i64)>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    use crate::modelsv2::DeleteStatic;
    let (project_id, study_id, scenario_id) = path.into_inner();

    // Check if the project and the study exist
    let (project, study) = check_project_study(db_pool.clone(), project_id, study_id)
        .await
        .unwrap();

    let conn = &mut db_pool.get().await?;

    // Delete scenario
    Scenario::delete_static_or_fail(conn, scenario_id, || ScenarioError::NotFound {
        scenario_id,
    })
    .await?;

    // Update project last_modification field
    let project = project.update_last_modified(db_pool.clone()).await?;
    project.expect("Project should exist");

    // Update study last_modification field
    let study = study.update_last_modified(db_pool).await?;
    study.expect("Study should exist");

    Ok(HttpResponse::NoContent().finish())
}

/// This structure is used by the patch endpoint to patch a study
#[derive(Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Default)]
struct ScenarioPatchForm {
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<Option<String>>>,
}

impl From<ScenarioPatchForm> for <Scenario as crate::modelsv2::Model>::Changeset {
    fn from(scenario: ScenarioPatchForm) -> Self {
        Self {
            name: scenario.name,
            description: scenario.description,
            tags: scenario.tags,
            ..Default::default()
        }
    }
}

/// Update a scenario
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    request_body = ScenarioPatchV2Form,
    responses(
        (status = 204, body = ScenarioResponse, description = "The scenario was updated successfully"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
#[patch("")]
async fn patch(
    data: Json<ScenarioPatchForm>,
    path: Path<(i64, i64, i64)>,
    db_pool: Data<DbPool>,
) -> Result<Json<ScenarioResponse>> {
    use crate::modelsv2::Update;

    let (project_id, study_id, scenario_id) = path.into_inner();

    let conn = &mut db_pool.get().await?;

    // Check if project and study exist
    let (project, study) = check_project_study_conn(conn, project_id, study_id)
        .await
        .unwrap();
    // Update the scenario
    let scenario: Changeset<Scenario> = data.into_inner().into();
    let scenario = scenario
        .update_or_fail(conn, scenario_id, || ScenarioError::NotFound {
            scenario_id,
        })
        .await?;
    // Update study last_modification field
    let study = study
        .clone()
        .update_last_modified_conn(conn)
        .await?
        .expect("Study should exist");
    // Update project last_modification field
    let project = project
        .clone()
        .update_last_modified_conn(conn)
        .await?
        .expect("Project should exist");

    let scenario_with_details = scenario.with_details_conn(conn).await?;

    let scenarios_response = ScenarioResponse::new(scenario_with_details, project, study);
    Ok(Json(scenarios_response))
}

/// Return a specific scenario
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 200, body = ScenarioResponse, description = "The requested scenario"),
        (status = 404, body = InternalError, description = "The requested scenario was not found"),
    )
)]
#[get("")]
async fn get(db_pool: Data<DbPool>, path: Path<(i64, i64, i64)>) -> Result<Json<ScenarioResponse>> {
    use crate::modelsv2::Retrieve;

    let (project_id, study_id, scenario_id) = path.into_inner();
    let (project, study) = check_project_study(db_pool.clone(), project_id, study_id).await?;
    let conn = &mut db_pool.get().await?;
    // Return the scenarios
    let scenario = Scenario::retrieve_or_fail(conn, scenario_id, || ScenarioError::NotFound {
        scenario_id,
    })
    .await?;

    // Check if the scenario belongs to the study
    if scenario.study_id != study_id {
        return Err(ScenarioError::NotFound { scenario_id }.into());
    }

    let scenarios_with_details = scenario.with_details_conn(conn).await?;
    let scenarios_response = ScenarioResponse::new(scenarios_with_details, project, study);
    Ok(Json(scenarios_response))
}

decl_paginated_response!(PaginatedResponseOfScenarioWithDetails, ScenarioWithDetails);

/// Return a list of scenarios
#[utoipa::path(
    tag = "scenariosv2",
    params(ProjectIdParam, StudyIdParam, PaginationQueryParam, QueryParams),
    responses(
        (status = 200, body = PaginatedResponseOfScenarioWithDetails, description = "The list of scenarios"),
    )
)]
#[get("")]
async fn list(
    db_pool: Data<DbPool>,
    pagination_params: Query<PaginationQueryParam>,
    path: Path<(i64, i64)>,
    params: Query<QueryParams>,
) -> Result<Json<PaginatedResponse<ScenarioWithDetails>>> {
    let (page, per_page) = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .unpack();
    let (project_id, study_id) = path.into_inner();

    let _ = check_project_study(db_pool.clone(), project_id, study_id).await?;
    let ordering = params.ordering.clone();
    let scenarios = Scenario::list(db_pool.clone(), page, per_page, (study_id, ordering)).await?;
    let results: Vec<_> = scenarios
        .results
        .into_iter()
        .map(|scenario| async {
            let conn = &mut db_pool.clone().get().await?;
            scenario.with_details_conn(conn).await
        })
        .collect();
    let results = futures::future::try_join_all(results).await?;
    Ok(Json(PaginatedResponse {
        count: scenarios.count,
        previous: scenarios.previous,
        next: scenarios.next,
        results,
    }))
}
