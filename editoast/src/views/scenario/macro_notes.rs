use std::sync::Arc;

use authz::Role;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use database::DbConnectionPoolV2;
use diesel_async::scoped_futures::ScopedFutureExt;
use editoast_derive::EditoastError;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::check_project_study_scenario;
use crate::error::InternalError;
use crate::error::Result;
use crate::models::Scenario;
use crate::models::macro_note::MacroNote;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use crate::views::project::ProjectError;
use crate::views::project::ProjectIdParam;
use crate::views::scenario::ScenarioError;
use crate::views::scenario::ScenarioIdParam;
use crate::views::study::StudyError;
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

#[derive(Debug, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Serialize, PartialEq, Clone))]
pub(in crate::views) struct MacroNoteForm {
    x: i64,
    y: i64,
    title: String,
    text: String,
    labels: Tags,
}

#[derive(Debug, Deserialize, ToSchema)]
#[cfg_attr(test, derive(Serialize, PartialEq, Clone))]
pub(in crate::views) struct MacroNoteBatchForm {
    macro_notes: Vec<MacroNoteForm>,
}

impl MacroNoteForm {
    pub fn into_macro_note_changeset(self, scenario_id: i64) -> Changeset<MacroNote> {
        MacroNote::changeset()
            .scenario_id(scenario_id)
            .x(self.x)
            .y(self.y)
            .title(self.title)
            .text(self.text)
            .labels(self.labels)
    }
}

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

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize, PartialEq))]
pub(in crate::views) struct MacroNoteBatchResponse {
    macro_notes: Vec<MacroNoteResponse>,
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

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct MacroNoteListResponse {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<MacroNoteResponse>,
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, PaginationQueryParams<100>),
    responses(
        (status = 200, body = MacroNoteListResponse, description = "List of macro notes for the requested scenario"),
    )
)]
pub(in crate::views) async fn list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id)): Path<(i64, i64, i64)>,
    Query(pagination_params): Query<PaginationQueryParams<100>>,
) -> Result<Json<MacroNoteListResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let mut conn = db_pool.get().await?;

    check_project_study_scenario(conn.clone(), project_id, study_id, scenario_id).await?;

    let settings = pagination_params
        .into_selection_settings()
        .filter(move || MacroNote::SCENARIO_ID.eq(scenario_id))
        .order_by(move || MacroNote::ID.asc());
    let (result, stats) = MacroNote::list_paginated(&mut conn, settings).await?;

    Ok(Json(MacroNoteListResponse {
        stats,
        results: result
            .into_iter()
            .map(MacroNoteResponse::from)
            .collect_vec(),
    }))
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "scenarios",
    request_body = MacroNoteBatchForm,
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam),
    responses(
        (status = 201, body = MacroNoteBatchResponse, description = "Macro notes created"),
    )
)]
pub(in crate::views) async fn create(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id)): Path<(i64, i64, i64)>,
    Json(MacroNoteBatchForm { macro_notes }): Json<MacroNoteBatchForm>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let created = Scenario::transactional_content_update(
        db_pool.get().await?,
        scenario_id,
        move |mut conn, scenario, study, project| {
            async move {
                if project.id != project_id {
                    return Err::<_, InternalError>(ProjectError::NotFound { project_id }.into());
                }
                if study.id != study_id {
                    return Err(StudyError::NotFound { study_id }.into());
                }
                if scenario.id != scenario_id {
                    return Err(ScenarioError::NotFound { scenario_id }.into());
                }

                let changesets: Vec<_> = macro_notes
                    .into_iter()
                    .map(|note| note.into_macro_note_changeset(scenario_id))
                    .collect();

                let created_macro_notes: Vec<_> =
                    MacroNote::create_batch(&mut conn, changesets).await?;

                Ok(created_macro_notes)
            }
            .scope_boxed()
        },
    )
    .await?;

    Ok((
        StatusCode::CREATED,
        Json(MacroNoteBatchResponse {
            macro_notes: created.into_iter().map_into().collect(),
        }),
    ))
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

#[editoast_derive::route]
#[utoipa::path(
    put, path = "",
    tag = "scenarios",
    request_body = MacroNoteForm,
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, MacroNoteIdParam),
    responses(
        (status = 200, body = MacroNoteResponse, description = "The updated macro note"),
    )
)]
pub(in crate::views) async fn update(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id, note_id)): Path<(i64, i64, i64, i64)>,
    Json(note_form): Json<MacroNoteForm>,
) -> Result<Json<MacroNoteResponse>> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let updated = Scenario::transactional_content_update(
        db_pool.get().await?,
        scenario_id,
        move |mut conn, scenario, study, project| {
            async move {
                let note = MacroNote::retrieve_or_fail(conn.clone(), note_id, || {
                    MacroNoteError::NotFound { note_id }
                })
                .await?;

                if project.id != project_id {
                    return Err::<_, InternalError>(ProjectError::NotFound { project_id }.into());
                }
                if study.id != study_id {
                    return Err(StudyError::NotFound { study_id }.into());
                }
                if scenario.id != scenario_id {
                    return Err(ScenarioError::NotFound { scenario_id }.into());
                }
                if note.scenario_id != scenario_id {
                    return Err(MacroNoteError::WrongScenario {
                        note_id,
                        scenario_id,
                    }
                    .into());
                }

                let updated_note = note_form
                    .into_macro_note_changeset(scenario_id)
                    .update_or_fail(&mut conn, note_id, || MacroNoteError::NotFound { note_id })
                    .await?;

                Ok(updated_note)
            }
            .scope_boxed()
        },
    )
    .await?;

    Ok(Json(MacroNoteResponse::from(updated)))
}

#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tag = "scenarios",
    params(ProjectIdParam, StudyIdParam, ScenarioIdParam, MacroNoteIdParam),
    responses((status = 204, description = "The macro note was deleted successfully"),)
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path((project_id, study_id, scenario_id, note_id)): Path<(i64, i64, i64, i64)>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    Scenario::transactional_content_update(
        db_pool.get().await?,
        scenario_id,
        move |mut conn, scenario, study, project| {
            async move {
                let note = MacroNote::retrieve_or_fail(conn.clone(), note_id, || {
                    MacroNoteError::NotFound { note_id }
                })
                .await?;

                if project.id != project_id {
                    return Err::<_, InternalError>(ProjectError::NotFound { project_id }.into());
                }
                if study.id != study_id {
                    return Err(StudyError::NotFound { study_id }.into());
                }
                if scenario.id != scenario_id {
                    return Err(ScenarioError::NotFound { scenario_id }.into());
                }
                if note.scenario_id != scenario_id {
                    return Err(MacroNoteError::WrongScenario {
                        note_id,
                        scenario_id,
                    }
                    .into());
                }

                note.delete(&mut conn).await?;
                Ok(())
            }
            .scope_boxed()
        },
    )
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
pub mod test {
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use rand::Rng;
    use rand::rng;

    use super::*;
    use crate::models::fixtures::create_scenario_fixtures_set;
    use crate::views::test_app::TestAppBuilder;

    impl PartialEq<MacroNoteResponse> for MacroNoteForm {
        fn eq(&self, other: &MacroNoteResponse) -> bool {
            self.x == other.x
                && self.y == other.y
                && self.title == other.title
                && self.text == other.text
                && self.labels == other.labels
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_notes() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let fixtures1 =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;
        let fixtures2 =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name2").await;

        for i in 0..5 {
            MacroNote::changeset()
                .scenario_id(fixtures1.scenario.id)
                .x(rng().random_range(0..100))
                .y(rng().random_range(0..100))
                .title(format!("Note title 1{}", i))
                .text(format!("Note text 1{}", i))
                .labels(Tags::new(vec!["A".to_string(), format!("Label {}", i)]))
                .create(&mut db_pool.get_ok())
                .await
                .expect("Failed to create macro note");
        }

        for i in 0..5 {
            MacroNote::changeset()
                .scenario_id(fixtures2.scenario.id)
                .x(rng().random_range(0..100))
                .y(rng().random_range(0..100))
                .title(format!("Note title 2{}", i))
                .text(format!("Note text 2{}", i))
                .labels(Tags::new(vec!["A".to_string(), format!("Label 2{}", i)]))
                .create(&mut db_pool.get_ok())
                .await
                .expect("Failed to create macro note");
        }

        let request = app.get(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_notes?page=1&page_size=3",
            fixtures1.project.id, fixtures1.study.id, fixtures1.scenario.id
        ));
        let response: MacroNoteListResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let ids: Vec<i64> = response.results.iter().map(|note| note.id).collect();
        let mut sorted_ids = ids.clone();
        sorted_ids.sort();

        assert_eq!(ids, sorted_ids);
        assert_eq!(5, response.stats.count);
        assert_eq!(3, response.results.len());
        assert!(
            response
                .results
                .iter()
                .all(|note| note.title.starts_with("Note title 1"))
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_note() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();

        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let notes_data = vec![
            MacroNoteForm {
                x: 10,
                y: 22,
                title: "Note title 1".to_string(),
                text: "Note text 1".to_string(),
                labels: Tags::new(vec!["A".to_string(), "B".to_string()]),
            },
            MacroNoteForm {
                x: 1,
                y: 2,
                title: "Note title 2".to_string(),
                text: "Note text 2".to_string(),
                labels: Tags::new(vec!["A".to_string(), "C".to_string()]),
            },
        ];

        let request = app
            .post(&format!(
                "/projects/{}/studies/{}/scenarios/{}/macro_notes",
                fixtures.project.id, fixtures.study.id, fixtures.scenario.id
            ))
            .json(&MacroNoteBatchForm {
                macro_notes: notes_data.clone(),
            });
        let response: MacroNoteBatchResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        assert_eq!(notes_data.len(), response.macro_notes.len());

        for (form, response_note) in notes_data.iter().zip(&response.macro_notes) {
            assert_eq!(form, response_note);
            let note = MacroNote::retrieve(db_pool.get_ok(), response_note.id)
                .await
                .unwrap()
                .expect("Failed to retrieve note");
            assert_eq!(MacroNoteResponse::from(note), *response_note);
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_note_scenario_not_found() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let notes_data = vec![MacroNoteForm {
            x: 10,
            y: 22,
            title: "Note title 1".to_string(),
            text: "Note text 1".to_string(),
            labels: Tags::new(vec!["A".to_string()]),
        }];

        let request = app
            .post(&format!(
                "/projects/{}/studies/{}/scenarios/{}/macro_notes",
                fixtures.project.id,
                fixtures.study.id,
                fixtures.scenario.id + 1
            ))
            .json(&MacroNoteBatchForm {
                macro_notes: notes_data.clone(),
            });
        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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

        let response: MacroNoteResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(MacroNoteResponse::from(note), response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn get_note_not_found() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let request = app.get(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_notes/999999",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id
        ));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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

        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_note() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let note = MacroNote::changeset()
            .scenario_id(fixtures.scenario.id)
            .x(10)
            .y(20)
            .title("Note title".to_string())
            .text("Note text".to_string())
            .labels(Tags::new(vec!["A".to_string(), "B".to_string()]))
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create macro note");
        let update = MacroNoteForm {
            x: 30,
            y: 30,
            title: "New title".to_string(),
            text: "New text".to_string(),
            labels: Tags::new(vec!["New label".to_string(), "B".to_string()]),
        };

        let request = app
            .put(&format!(
                "/projects/{}/studies/{}/scenarios/{}/macro_notes/{}",
                fixtures.project.id, fixtures.study.id, fixtures.scenario.id, note.id
            ))
            .json(&update);

        let response: MacroNoteResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let note = MacroNote::retrieve(db_pool.get_ok(), note.id)
            .await
            .unwrap()
            .expect("Failed to retrieve note");

        assert_eq!(update, response);
        assert_eq!(MacroNoteResponse::from(note), response);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_note_not_found() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let update = MacroNoteForm {
            x: 30,
            y: 30,
            title: "New title".to_string(),
            text: "New text".to_string(),
            labels: Tags::new(vec!["New label".to_string(), "B".to_string()]),
        };

        let request = app
            .put(&format!(
                "/projects/{}/studies/{}/scenarios/{}/macro_notes/999999",
                fixtures.project.id, fixtures.study.id, fixtures.scenario.id
            ))
            .json(&update);

        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_note() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let note = MacroNote::changeset()
            .scenario_id(fixtures.scenario.id)
            .x(10)
            .y(20)
            .title("Note title".to_string())
            .text("Note text".to_string())
            .labels(Tags::new(vec!["A".to_string(), "B".to_string()]))
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create macro note");

        let request = app.delete(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_notes/{}",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id, note.id
        ));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let still_exists = MacroNote::exists(&mut db_pool.get_ok(), note.id)
            .await
            .expect("Failed to check if macro note still exists");
        assert!(!still_exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_note_not_found() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let fixtures =
            create_scenario_fixtures_set(&mut db_pool.get_ok(), "test_scenario_name").await;

        let request = app.delete(&format!(
            "/projects/{}/studies/{}/scenarios/{}/macro_notes/999999",
            fixtures.project.id, fixtures.study.id, fixtures.scenario.id
        ));

        app.fetch(request)
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }
}
