use super::AppState;
use axum::Json;
use axum::extract::Path;
use axum::extract::State;
use axum::response::IntoResponse;
use editoast_derive::EditoastError;
use editoast_models::Timetable;
use editoast_models::TrainScheduleLinking;
use editoast_models::prelude::*;
use editoast_models::train_schedule_linking::TrainScheduleLinkingChangeset;
use itertools::Itertools;
use reqwest::StatusCode;
use schemas::timetable_type::TimetableType;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::timetable::TimetableIdParam;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct LinkingResponse {
    pub id: i64,
    pub source: LinkingOccurrenceId,
    pub target: LinkingOccurrenceId,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
#[schema(title_variants)]
pub enum LinkingOccurrenceId {
    Unique {
        train_schedule_id: i64,
        train_schedule_instance_index: Option<i64>,
    },
    PacedOccurrence {
        train_schedule_id: i64,
        occurrence_index: i64,
        train_schedule_instance_index: Option<i64>,
    },
    AddedException {
        train_schedule_id: i64,
        added_exception_id: i64,
        train_schedule_instance_index: Option<i64>,
    },
}

fn get_linking_occurrence_id(
    train_schedule_id: i64,
    occurrence_index: Option<i64>,
    added_exception_id: Option<i64>,
    train_schedule_instance_index: Option<i64>,
) -> LinkingOccurrenceId {
    match (occurrence_index, added_exception_id) {
        (None, None) => LinkingOccurrenceId::Unique {
            train_schedule_id,
            train_schedule_instance_index,
        },
        (Some(occurrence_index), None) => LinkingOccurrenceId::PacedOccurrence {
            train_schedule_id,
            occurrence_index,
            train_schedule_instance_index,
        },
        (None, Some(added_exception_id)) => LinkingOccurrenceId::AddedException {
            train_schedule_id,
            added_exception_id,
            train_schedule_instance_index,
        },
        (Some(_), Some(_)) => {
            unreachable!("A train can't be both a regular occurrence and an added exception")
        }
    }
}

impl From<TrainScheduleLinking> for LinkingResponse {
    fn from(linking: TrainScheduleLinking) -> Self {
        LinkingResponse {
            id: linking.id,
            source: get_linking_occurrence_id(
                linking.source_train_schedule_id,
                linking.source_occurrence_index,
                linking.source_added_exception_id,
                linking.source_train_schedule_instance_index,
            ),
            target: get_linking_occurrence_id(
                linking.target_train_schedule_id,
                linking.target_occurrence_index,
                linking.target_added_exception_id,
                linking.target_train_schedule_instance_index,
            ),
        }
    }
}

#[derive(Debug, Error, EditoastError, Serialize)]
#[editoast_error(base_id = "train_schedule_linking")]
enum LinkingError {
    #[error("Timetable {timetable_id} does not exist")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },
    #[error("Occurrence {occurrence} is already used as a source.")]
    #[editoast_error(status = 409)]
    SourceAlreadyUsed { occurrence: String },
    #[error("Occurrence {occurrence} is already used as a target.")]
    #[editoast_error(status = 409)]
    TargetAlreadyUsed { occurrence: String },
    #[error(
        "Timetable {timetable_id} has type {timetable_type}, so it can't have occurrences with train_schedule_instance_index"
    )]
    #[editoast_error(status = 409)]
    RequestIncompatibleWithTimetableType {
        timetable_id: i64,
        timetable_type: TimetableType,
    },
    #[error("{count} linking(s) could not be found")]
    #[editoast_error(status = 404)]
    BatchNotFound { count: usize },
    #[error(transparent)]
    #[from(forward)]
    #[serde(skip)]
    Database(editoast_models::Error),
}

impl From<editoast_models::Error> for LinkingError {
    fn from(err: editoast_models::Error) -> Self {
        match &err {
            editoast_models::Error::UniqueViolation {
                constraint,
                column: _,
                value,
            } => match constraint.as_str() {
                "unique_source" => Self::SourceAlreadyUsed {
                    occurrence: format!(
                        "(timetable_id, train_schedule_id, occurrence_index, added_exception_id, train_schedule_instance_index) = ({})",
                        value.clone()
                    ),
                },
                "unique_target" => Self::TargetAlreadyUsed {
                    occurrence: format!(
                        "(timetable_id, train_schedule_id, occurrence_index, added_exception_id, train_schedule_instance_index) = ({})",
                        value.clone()
                    ),
                },
                _ => Self::Database(err),
            },
            _ => Self::Database(err),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct ListLinkingsQuery {
    pub timetable_id: i64,
    #[schema(max_items = 200)]
    pub train_schedules: Vec<i64>,
}

/// List train schedule linkings whose target or source is part of the input train schedules
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "linkings",
    request_body = inline(ListLinkingsQuery),
    responses(
        (status = 200, description = "The linkings for a given timetable and given train schedules.", body = inline(Vec<LinkingResponse>)),
        (status = 404, description = "Timetable doesn't exist.")
    ),
)]
pub(in crate::views) async fn list(
    State(AppState { db_pool, .. }): State<AppState>,
    Json(ListLinkingsQuery {
        timetable_id,
        train_schedules,
    }): Json<ListLinkingsQuery>,
) -> Result<Json<Vec<LinkingResponse>>> {
    use database::tables::train_schedule_linking::dsl;
    use diesel::BoolExpressionMethods;
    use diesel::prelude::*;
    use editoast_models::prelude::*;

    let conn = &mut db_pool.get().await?;
    Timetable::exists_or_fail(conn, timetable_id, || LinkingError::TimetableNotFound {
        timetable_id,
    })
    .await?;

    let settings = SelectionSettings::new()
        .filter(move || TrainScheduleLinking::TIMETABLE_ID.eq(timetable_id))
        .filter(move || {
            FilterSetting::<TrainScheduleLinking>::new(
                dsl::source_train_schedule_id
                    .eq_any(train_schedules.clone())
                    .or(dsl::target_train_schedule_id.eq_any(train_schedules.clone())),
            )
        });
    let linkings = TrainScheduleLinking::list(conn, settings).await?;
    Ok(Json(linkings.into_iter().map_into().collect()))
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct LinkingCreateForm {
    pub source: LinkingOccurrenceId,
    pub target: LinkingOccurrenceId,
}

impl LinkingOccurrenceId {
    pub fn train_schedule_id(&self) -> i64 {
        match self {
            LinkingOccurrenceId::Unique {
                train_schedule_id, ..
            } => *train_schedule_id,
            LinkingOccurrenceId::PacedOccurrence {
                train_schedule_id, ..
            } => *train_schedule_id,
            LinkingOccurrenceId::AddedException {
                train_schedule_id, ..
            } => *train_schedule_id,
        }
    }
    pub fn train_schedule_instance_index(&self) -> Option<i64> {
        match self {
            LinkingOccurrenceId::Unique {
                train_schedule_instance_index,
                ..
            } => *train_schedule_instance_index,
            LinkingOccurrenceId::PacedOccurrence {
                train_schedule_instance_index,
                ..
            } => *train_schedule_instance_index,
            LinkingOccurrenceId::AddedException {
                train_schedule_instance_index,
                ..
            } => *train_schedule_instance_index,
        }
    }
    pub fn occurrence_index(&self) -> Option<i64> {
        match self {
            LinkingOccurrenceId::PacedOccurrence {
                occurrence_index, ..
            } => Some(*occurrence_index),
            _ => None,
        }
    }
    pub fn added_exception_id(&self) -> Option<i64> {
        match self {
            LinkingOccurrenceId::AddedException {
                added_exception_id, ..
            } => Some(*added_exception_id),
            _ => None,
        }
    }
}

impl From<LinkingCreateForm> for TrainScheduleLinkingChangeset {
    fn from(LinkingCreateForm { source, target }: LinkingCreateForm) -> Self {
        TrainScheduleLinking::changeset()
            .source_train_schedule_id(source.train_schedule_id())
            .source_occurrence_index(source.occurrence_index())
            .source_added_exception_id(source.added_exception_id())
            .source_train_schedule_instance_index(source.train_schedule_instance_index())
            .target_train_schedule_id(target.train_schedule_id())
            .target_occurrence_index(target.occurrence_index())
            .target_added_exception_id(target.added_exception_id())
            .target_train_schedule_instance_index(target.train_schedule_instance_index())
    }
}

/// Create linkings in batch
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "linkings",
    params(TimetableIdParam),
    request_body = Vec<LinkingCreateForm>,
    responses(
        (status = 201, description = "Linkings created", body = inline(Vec<LinkingResponse>)),
    ),
)]
pub(in crate::views) async fn create(
    State(AppState { db_pool, .. }): State<AppState>,
    Path(TimetableIdParam { id: timetable_id }): Path<TimetableIdParam>,
    Json(linking_forms): Json<Vec<LinkingCreateForm>>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;

    let timetable = Timetable::retrieve_or_fail(conn.clone(), timetable_id, || {
        LinkingError::TimetableNotFound { timetable_id }
    })
    .await?;

    if timetable.timetable_type.0 == TimetableType::Hourly
        || timetable.timetable_type.0 == TimetableType::Calendar
    {
        for linking in &linking_forms {
            if linking.source.train_schedule_instance_index().is_some()
                || linking.target.train_schedule_instance_index().is_some()
            {
                return Err(LinkingError::RequestIncompatibleWithTimetableType {
                    timetable_id: timetable.id,
                    timetable_type: *timetable.timetable_type,
                }
                .into());
            }
        }
    }

    let changesets: Vec<TrainScheduleLinkingChangeset> = linking_forms
        .into_iter()
        .map_into()
        .map(|linking: TrainScheduleLinkingChangeset| linking.timetable_id(timetable_id))
        .collect();
    let linkings: Vec<TrainScheduleLinking> = TrainScheduleLinking::create_batch(conn, changesets)
        .await
        .map_err(LinkingError::from)?;
    let response: Vec<LinkingResponse> = linkings.into_iter().map_into().collect();
    Ok((StatusCode::CREATED, Json(response)))
}

/// Delete linkings in batch
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "linkings",
    request_body = Vec<i64>,
    responses(
        (status = 204, description = "Linkings deleted"),
    ),
)]
pub(in crate::views) async fn delete(
    State(AppState { db_pool, .. }): State<AppState>,
    Json(linking_ids): Json<Vec<i64>>,
) -> Result<impl IntoResponse> {
    let conn = &mut db_pool.get().await?;

    TrainScheduleLinking::delete_batch_or_fail(conn, linking_ids, |count| {
        LinkingError::BatchNotFound { count }
    })
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use authz::Role;
    use editoast_models::prelude::{Create, Model};
    use reqwest::StatusCode;
    use serde_json::json;

    use crate::error::InternalError;
    use crate::fixtures::create_simple_paced_train;
    use crate::fixtures::create_timetable;
    use crate::fixtures::create_timetable_with_train_schedule_set;
    use crate::views::test_app::TestRequestExt as _;
    use crate::views::test_app::test_app;

    use super::*;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_list() {
        let app = test_app!().build();
        let pool = app.db_pool();
        let conn = &mut pool.get_ok();

        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let (timetable, train_schedule_set) = create_timetable_with_train_schedule_set(conn).await;
        let train_schedule_1 = create_simple_paced_train(conn, train_schedule_set.id).await;
        let train_schedule_2 = create_simple_paced_train(conn, train_schedule_set.id).await;
        let linking_1 = TrainScheduleLinking::changeset()
            .timetable_id(timetable.id)
            .source_train_schedule_id(train_schedule_1.id)
            .source_occurrence_index(Some(1))
            .target_train_schedule_id(train_schedule_1.id)
            .target_occurrence_index(Some(2))
            .create(conn)
            .await
            .expect("Failed to create a linking");
        let linking_2 = TrainScheduleLinking::changeset()
            .timetable_id(timetable.id)
            .source_train_schedule_id(train_schedule_1.id)
            .source_occurrence_index(Some(2))
            .target_train_schedule_id(train_schedule_2.id)
            .target_occurrence_index(Some(1))
            .create(conn)
            .await
            .expect("Failed to create a linking");

        let other_timetable = create_timetable(conn).await;
        // Create another linking on an other timetable to make sure it doesn't appear in the requests
        TrainScheduleLinking::changeset()
            .timetable_id(other_timetable.id)
            .source_train_schedule_id(train_schedule_1.id)
            .source_occurrence_index(Some(0))
            .target_train_schedule_id(train_schedule_2.id)
            .target_occurrence_index(Some(0))
            .create(conn)
            .await
            .expect("Failed to create a linking");

        let request = ListLinkingsQuery {
            timetable_id: timetable.id,
            train_schedules: vec![train_schedule_1.id],
        };

        let response: Vec<LinkingResponse> = app
            .post("/train_schedules/linkings")
            .json(&json!(request))
            .by_user(user.as_ref())
            .await
            .assert_status(StatusCode::OK)
            .json();

        assert_eq!(
            response
                .into_iter()
                .map(|linking| linking.id)
                .collect::<HashSet<i64>>(),
            HashSet::from([linking_1.id, linking_2.id])
        );

        let request = ListLinkingsQuery {
            timetable_id: timetable.id,
            train_schedules: vec![train_schedule_2.id],
        };

        let response: Vec<LinkingResponse> = app
            .post("/train_schedules/linkings")
            .json(&json!(request))
            .by_user(user.as_ref())
            .await
            .assert_status(StatusCode::OK)
            .json();

        assert_eq!(
            response
                .into_iter()
                .map(|linking| linking.id)
                .collect::<Vec<i64>>(),
            vec![linking_2.id]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_create() {
        let app = test_app!().build();
        let pool = app.db_pool();
        let conn = &mut pool.get_ok();
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let (timetable, train_schedule_set) = create_timetable_with_train_schedule_set(conn).await;
        let train_schedule_1 = create_simple_paced_train(conn, train_schedule_set.id).await;
        let train_schedule_2 = create_simple_paced_train(conn, train_schedule_set.id).await;

        let source = LinkingOccurrenceId::PacedOccurrence {
            train_schedule_id: train_schedule_1.id,
            occurrence_index: 0,
            train_schedule_instance_index: None,
        };
        let target = LinkingOccurrenceId::PacedOccurrence {
            train_schedule_id: train_schedule_2.id,
            occurrence_index: 0,
            train_schedule_instance_index: None,
        };
        let request = vec![LinkingCreateForm {
            source: source.clone(),
            target: target.clone(),
        }];

        let created_linkings: Vec<LinkingResponse> = app
            .post(format!("/timetable/{}/train_schedule_linkings", timetable.id).as_str())
            .json(&json!(request))
            .by_user(user.as_ref())
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        assert_eq!(created_linkings.len(), 1);
        assert_eq!(created_linkings[0].source, source);
        assert_eq!(created_linkings[0].target, target);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_create_already_used() {
        let app = test_app!().build();
        let pool = app.db_pool();
        let conn = &mut pool.get_ok();
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let (timetable, train_schedule_set) = create_timetable_with_train_schedule_set(conn).await;
        let train_schedule_1 = create_simple_paced_train(conn, train_schedule_set.id).await;
        let train_schedule_2 = create_simple_paced_train(conn, train_schedule_set.id).await;

        TrainScheduleLinking::changeset()
            .timetable_id(timetable.id)
            .source_train_schedule_id(train_schedule_1.id)
            .source_occurrence_index(Some(0))
            .target_train_schedule_id(train_schedule_2.id)
            .target_occurrence_index(Some(0))
            .create(conn)
            .await
            .expect("Failed to create a linking");

        let request = vec![LinkingCreateForm {
            source: LinkingOccurrenceId::PacedOccurrence {
                train_schedule_id: train_schedule_1.id,
                occurrence_index: 0,
                train_schedule_instance_index: None,
            },
            target: LinkingOccurrenceId::PacedOccurrence {
                train_schedule_id: train_schedule_2.id,
                occurrence_index: 1,
                train_schedule_instance_index: None,
            },
        }];

        // Make sure an error is returned for a source already used
        let response: InternalError = app
            .post(format!("/timetable/{}/train_schedule_linkings", timetable.id).as_str())
            .json(&json!(request))
            .by_user(user.as_ref())
            .await
            .assert_status(StatusCode::CONFLICT)
            .json();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule_linking:SourceAlreadyUsed"
        );

        let request = vec![LinkingCreateForm {
            source: LinkingOccurrenceId::PacedOccurrence {
                train_schedule_id: train_schedule_1.id,
                occurrence_index: 1,
                train_schedule_instance_index: None,
            },
            target: LinkingOccurrenceId::PacedOccurrence {
                train_schedule_id: train_schedule_2.id,
                occurrence_index: 0,
                train_schedule_instance_index: None,
            },
        }];

        // Make sure an error is returned for a target already used
        let response: InternalError = app
            .post(format!("/timetable/{}/train_schedule_linkings", timetable.id).as_str())
            .json(&json!(request))
            .by_user(user.as_ref())
            .await
            .assert_status(StatusCode::CONFLICT)
            .json();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule_linking:TargetAlreadyUsed"
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_delete() {
        let app = test_app!().build();
        let pool = app.db_pool();
        let conn = &mut pool.get_ok();

        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let (timetable, train_schedule_set) = create_timetable_with_train_schedule_set(conn).await;
        let train_schedule_1 = create_simple_paced_train(conn, train_schedule_set.id).await;
        let train_schedule_2 = create_simple_paced_train(conn, train_schedule_set.id).await;
        let linking_1 = TrainScheduleLinking::changeset()
            .timetable_id(timetable.id)
            .source_train_schedule_id(train_schedule_1.id)
            .source_occurrence_index(Some(1))
            .target_train_schedule_id(train_schedule_1.id)
            .target_occurrence_index(Some(2))
            .create(conn)
            .await
            .expect("Failed to create a linking");
        let linking_2 = TrainScheduleLinking::changeset()
            .timetable_id(timetable.id)
            .source_train_schedule_id(train_schedule_1.id)
            .source_occurrence_index(Some(2))
            .target_train_schedule_id(train_schedule_2.id)
            .target_occurrence_index(Some(1))
            .create(conn)
            .await
            .expect("Failed to create a linking");

        app.post("/train_schedules/linkings/delete")
            .json(&json!(vec![linking_1.id]))
            .by_user(user.as_ref())
            .await
            .assert_status(StatusCode::NO_CONTENT);

        let linkings = TrainScheduleLinking::list(conn, SelectionSettings::new())
            .await
            .expect("Failed to list all linkings");

        assert_eq!(linkings.len(), 1);
        assert_eq!(linkings[0].id, linking_2.id);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_batch_not_found() {
        let app = test_app!().build();
        let pool = app.db_pool();
        let conn = &mut pool.get_ok();
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let (timetable, train_schedule_set) = create_timetable_with_train_schedule_set(conn).await;
        let train_schedule_1 = create_simple_paced_train(conn, train_schedule_set.id).await;
        let train_schedule_2 = create_simple_paced_train(conn, train_schedule_set.id).await;

        let linking = TrainScheduleLinking::changeset()
            .timetable_id(timetable.id)
            .source_train_schedule_id(train_schedule_1.id)
            .source_occurrence_index(Some(0))
            .target_train_schedule_id(train_schedule_2.id)
            .target_occurrence_index(Some(0))
            .create(conn)
            .await
            .expect("Failed to create a linking");

        let response: InternalError = app
            .post("/train_schedules/linkings/delete")
            .json(&json!(vec![linking.id, linking.id + 1]))
            .by_user(user.as_ref())
            .await
            .assert_status(StatusCode::NOT_FOUND)
            .json();

        assert_eq!(
            &response.error_type,
            "editoast:train_schedule_linking:BatchNotFound"
        );
        assert_eq!(&response.context["count"], 1);
    }
}
