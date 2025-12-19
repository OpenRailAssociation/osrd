use crate::AppState;
use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;

use axum::Extension;
use axum::extract::Json;
use axum::extract::State;
use schemas::infra::Direction;
use schemas::primitives::TimeWindow;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct LevelCrossingOccupancyForm {
    train_ids: Vec<i64>,
    level_crossing_ids: Vec<i64>,
    infra_id: i64,
    electrical_profile_set_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct LevelCrossingOccupancy {
    //TODO : Replace train_id with occurence_id after merging train schedule and paced train
    train_id: i64,
    #[serde(flatten)]
    #[schema(inline)]
    time_window: TimeWindow,
    direction: Direction,
}

/// Get the occupancy of a set of level crossings for a set of trains
#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "level_crossing",
    request_body = inline(LevelCrossingOccupancyForm),
    responses(
        (status = 200, description = "Occupancy periods of the given level crossings", body = inline(HashMap<i64, Vec<LevelCrossingOccupancy>>)),
    ),
)]
pub(in crate::views) async fn occupancy(
    State(AppState {
        config: _,
        db_pool: _,
        valkey_client: _,
        core_client: _,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Json(LevelCrossingOccupancyForm {
        train_ids: _,
        level_crossing_ids: _,
        infra_id,
        electrical_profile_set_id: _,
    }): Json<LevelCrossingOccupancyForm>,
) -> Result<Json<HashMap<i64, Vec<LevelCrossingOccupancy>>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    //TODO: implement real logic

    Ok(Json(HashMap::new()))
}
