use std::sync::Arc;

use authz::Role;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::State;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::check_project_study_scenario;
use crate::error::Result;
use crate::models::macro_note::MacroNote;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::project::ProjectIdParam;
use crate::views::scenario::ScenarioIdParam;
use crate::views::study::StudyIdParam;
use editoast_models::prelude::*;
use editoast_models::tags::Tags;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "macro_note")]
enum MacroNoteError {
    #[error("Note '{note_id}' could not be found")]
    #[editoast_error(status = 404)]
    NotFound { note_id: i64 },

    #[error("Note '{note_id}' does not belong to scenario '{scenario_id}'")]
    #[editoast_error(status = 404)]
    WrongScenario { note_id: i64, scenario_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[derive(IntoParams, Deserialize)]
#[allow(unused)]
struct MacroNoteIdParam {
    note_id: i64,
}

#[editoast_derive::openapi_schema]
#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq))]
pub(in crate::views) struct MacroNoteResponse {
    id: i64,
    x: i64,
    y: i64,
    title: String,
    text: String,
    labels: Tags,
}

impl From<MacroNote> for MacroNoteResponse {
    fn from(note: MacroNote) -> Self {
        Self {
            id: note.id,
            x: note.x,
            y: note.y,
            title: note.title,
            text: note.text,
            labels: note.labels,
        }
    }
}

/// Return a specific note
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, MacroNoteIdParam),
    responses(
        (status = 200, body = MacroNoteResponse, description = "The requested macro note"),
    )
)]
pub(in crate::views) async fn get(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id, note_id)): Path<(i64, i64, i64, i64)>,
) -> Result<Json<MacroNoteResponse>> {
    // Checking role
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    // Check for project / study / scenario
    let conn = db_pool.get().await?;
    check_project_study_scenario(conn.clone(), project_id, study_id, scenario_id).await?;

    // Get / check the note
    let macro_note =
        MacroNote::retrieve_or_fail(conn, note_id, || MacroNoteError::NotFound { note_id }).await?;
    if macro_note.scenario_id != scenario_id {
        return Err(MacroNoteError::WrongScenario {
            note_id,
            scenario_id,
        }
        .into());
    }

    Ok(Json(MacroNoteResponse::from(macro_note)))
}

#[cfg(test)]
pub mod test {
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rand::Rng;
    use rand::rng;
    use rstest::rstest;

    use super::*;
    use crate::models::fixtures::create_scenario_fixtures_set;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn get_note() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;
        let note = MacroNote::changeset()
            .scenario_id(fixtures.scenario.id)
            .x(rng().random_range(0..100))
            .y(rng().random_range(0..100))
            .title("Note title".to_string())
            .text("Note text".to_string())
            .labels(Tags::new(vec!["A".to_string(), "B".to_string()]))
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create macro note");

        let request = app.get(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_notes/{}",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id, note.id
        ));

        let response: MacroNoteResponse =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert_eq!(MacroNoteResponse::from(note), response);
    }

    #[rstest]
    async fn get_note_not_found() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let request = app.get(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_notes/999999",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id
        ));

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn get_note_wrong_scenario() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;
        let fixtures_2 =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name_2").await;

        let note = MacroNote::changeset()
            .scenario_id(fixtures.scenario.id)
            .x(rng().random_range(0..100))
            .y(rng().random_range(0..100))
            .title("Note title".to_string())
            .text("Note text".to_string())
            .labels(Tags::new(vec!["A".to_string(), "B".to_string()]))
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create macro note");

        let request = app.get(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_notes/{}",
            fixtures_2.project.id, fixtures_2.study.id, fixtures_2.scenario.id, note.id
        ));

        app.fetch(request).assert_status(StatusCode::NOT_FOUND);
    }
}
