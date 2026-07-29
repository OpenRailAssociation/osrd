use super::AppState;
use axum::Json;
use axum::extract::State;
use editoast_derive::EditoastError;
use editoast_models::Timetable;
use editoast_models::TrainScheduleLinking;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::Result;

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

#[derive(Debug, Error, EditoastError, Serialize, derive_more::From)]
#[editoast_error(base_id = "train_schedule_linking")]
enum LinkingError {
    #[error("Timetable {timetable_id} does not exist")]
    #[editoast_error(status = 404)]
    TimetableNotFound { timetable_id: i64 },
    #[error(transparent)]
    #[from(forward)]
    #[serde(skip)]
    Database(editoast_models::Error),
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
