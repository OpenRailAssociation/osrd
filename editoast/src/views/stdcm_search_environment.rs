use crate::views::pagination::PaginatedList;
use crate::views::pagination::PaginationQueryParams;
use crate::views::pagination::PaginationStats;
use authz::Role;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use chrono::DateTime;
use chrono::Utc;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use serde::de::Error as SerdeError;
use std::result::Result as StdResult;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::stdcm_search_environment::StdcmSearchEnvironment;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "stdcm_search_env")]
enum StdcmSearchEnvError {
    /// Could not find the stdcm search env with the given ID
    #[error("Stdcm search environment '{env_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { env_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[editoast_derive::openapi_schema]
#[derive(Deserialize, ToSchema)]
#[serde(remote = "Self")]
#[cfg_attr(test, derive(Serialize))]
pub(in crate::views) struct StdcmSearchEnvironmentCreateForm {
    infra_id: i64,
    electrical_profile_set_id: Option<i64>,
    work_schedule_group_id: Option<i64>,
    temporary_speed_limit_group_id: Option<i64>,
    timetable_id: i64,
    search_window_begin: DateTime<Utc>,
    search_window_end: DateTime<Utc>,
    enabled_from: DateTime<Utc>,
    enabled_until: DateTime<Utc>,
    #[schema(value_type = Option<common::geometry::GeoJson>)]
    active_perimeter: Option<geos::geojson::Geometry>,
}

impl<'de> Deserialize<'de> for StdcmSearchEnvironmentCreateForm {
    fn deserialize<D>(deserializer: D) -> StdResult<StdcmSearchEnvironmentCreateForm, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let create_form = StdcmSearchEnvironmentCreateForm::deserialize(deserializer)?;
        // Check dates
        if create_form.search_window_begin >= create_form.search_window_end {
            return Err(SerdeError::custom(format!(
                "The search environment simulation window begin '{}' must be before the end '{}'",
                create_form.search_window_begin, create_form.search_window_end
            )));
        }
        if create_form.enabled_from >= create_form.enabled_until {
            return Err(SerdeError::custom(format!(
                "The search environment enabled window begin '{}' must be before the end '{}'",
                create_form.enabled_from, create_form.enabled_until
            )));
        }
        Ok(create_form)
    }
}

#[cfg(test)]
impl Serialize for StdcmSearchEnvironmentCreateForm {
    fn serialize<S>(&self, serializer: S) -> StdResult<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        StdcmSearchEnvironmentCreateForm::serialize(self, serializer)
    }
}

impl From<StdcmSearchEnvironmentCreateForm> for Changeset<StdcmSearchEnvironment> {
    fn from(form: StdcmSearchEnvironmentCreateForm) -> Self {
        StdcmSearchEnvironment::changeset()
            .infra_id(form.infra_id)
            .electrical_profile_set_id(form.electrical_profile_set_id)
            .work_schedule_group_id(form.work_schedule_group_id)
            .temporary_speed_limit_group_id(form.temporary_speed_limit_group_id)
            .timetable_id(form.timetable_id)
            .search_window_begin(form.search_window_begin)
            .search_window_end(form.search_window_end)
            .enabled_from(form.enabled_from)
            .enabled_until(form.enabled_until)
            .active_perimeter(form.active_perimeter.map(diesel_json::Json))
    }
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "stdcm_search_environment",
    request_body = StdcmSearchEnvironmentCreateForm,
    responses(
        (status = 201, body = StdcmSearchEnvironment),
    )
)]
pub(in crate::views) async fn create(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(form): Json<StdcmSearchEnvironmentCreateForm>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::Admin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let changeset: Changeset<StdcmSearchEnvironment> = form.into();
    Ok((StatusCode::CREATED, Json(changeset.create(conn).await?)))
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "stdcm_search_environment",
    responses(
        (status = 200, body = StdcmSearchEnvironment),
        (status = 204, description = "No search environment was created")
    )
)]
pub(in crate::views) async fn retrieve_latest(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
) -> Result<Response> {
    let authorized = auth
        .check_roles([Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let search_env = StdcmSearchEnvironment::retrieve_latest_enabled(conn).await;
    if let Some(search_env) = search_env {
        Ok(Json(search_env).into_response())
    } else {
        tracing::error!("STDCM search environment queried but none was created");
        Ok(StatusCode::NO_CONTENT.into_response())
    }
}

#[derive(IntoParams, Deserialize)]
#[allow(unused)]
pub(in crate::views) struct StdcmSearchEnvIdParam {
    /// An stdcm search environment ID
    env_id: i64,
}

#[editoast_derive::route]
#[utoipa::path(
    delete, path = "",
    tag = "stdcm_search_environment",
    params(StdcmSearchEnvIdParam),
    responses(
        (status = 204, description = "The stdcm search environment was deleted successfully"),
    )
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(StdcmSearchEnvIdParam { env_id }): Path<StdcmSearchEnvIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::Admin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    StdcmSearchEnvironment::delete_static_or_fail(conn, env_id, || StdcmSearchEnvError::NotFound {
        env_id,
    })
    .await?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct SdcmSearchEnvListResponse {
    #[schema(value_type = Vec<StdcmSearchEnvironment>)]
    results: Vec<StdcmSearchEnvironment>,
    #[serde(flatten)]
    stats: PaginationStats,
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "stdcm_search_environment",
    params(PaginationQueryParams<1000>),
    responses(
        (status = 200, body = inline(SdcmSearchEnvListResponse), description = "The paginated list of all existing stdcm search environments"),
    )
)]
pub(in crate::views) async fn list(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Query(page_settings): Query<PaginationQueryParams<1000>>,
) -> Result<Json<SdcmSearchEnvListResponse>> {
    let authorized = auth
        .check_roles([Role::Admin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    let mut conn = db_pool.get().await?;
    let settings = page_settings
        .into_selection_settings()
        .order_by(|| StdcmSearchEnvironment::ID.asc());
    let (listed_envs, stats) = StdcmSearchEnvironment::list_paginated(&mut conn, settings).await?;
    Ok(Json(SdcmSearchEnvListResponse {
        results: listed_envs,
        stats,
    }))
}

#[cfg(test)]
pub mod tests {
    use std::collections::HashSet;

    use axum::http::StatusCode;
    use chrono::Duration;
    use chrono::DurationRound;
    use chrono::TimeZone;
    use chrono::Utc;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use super::*;
    use crate::models::stdcm_search_environment::tests::stdcm_search_env_fixtures;
    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn create_stdcm_search_env() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let (
            infra,
            timetable,
            work_schedule_group,
            temporary_speed_limit_group,
            electrical_profile_set,
        ) = stdcm_search_env_fixtures(&mut pool.get_ok()).await;

        let form = StdcmSearchEnvironmentCreateForm {
            infra_id: infra.id,
            electrical_profile_set_id: Some(electrical_profile_set.id),
            work_schedule_group_id: Some(work_schedule_group.id),
            temporary_speed_limit_group_id: Some(temporary_speed_limit_group.id),
            timetable_id: timetable.id,
            search_window_begin: Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap(),
            search_window_end: Utc.with_ymd_and_hms(2024, 1, 15, 0, 0, 0).unwrap(),
            enabled_from: Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap(),
            enabled_until: Utc.with_ymd_and_hms(2024, 1, 1, 23, 59, 59).unwrap(),
            active_perimeter: None,
        };

        let request = app.post("/stdcm/search_environment").json(&form);

        // WHEN
        let stdcm_search_env = app
            .fetch(request)
            .assert_status(StatusCode::CREATED)
            .json_into::<StdcmSearchEnvironment>();

        // THEN
        let stdcm_search_env_in_db =
            StdcmSearchEnvironment::retrieve(pool.get_ok(), stdcm_search_env.id)
                .await
                .expect("Failed to retrieve stdcm search environment")
                .expect("Stdcm search environment not found");
        assert_eq!(stdcm_search_env, stdcm_search_env_in_db);
    }

    #[rstest]
    async fn retrieve_stdcm_search_env() {
        // GIVEN
        let app = TestAppBuilder::default_app();

        let pool = app.db_pool();

        let (
            infra,
            timetable,
            work_schedule_group,
            temporary_speed_limit_group,
            electrical_profile_set,
        ) = stdcm_search_env_fixtures(&mut pool.get_ok()).await;

        let enabled_from =
            Utc::now().duration_trunc(Duration::seconds(1)).unwrap() - Duration::days(1);
        let enabled_until =
            Utc::now().duration_trunc(Duration::seconds(1)).unwrap() + Duration::days(1);

        let best_env = StdcmSearchEnvironment::changeset()
            .infra_id(infra.id)
            .electrical_profile_set_id(Some(electrical_profile_set.id))
            .work_schedule_group_id(Some(work_schedule_group.id))
            .temporary_speed_limit_group_id(Some(temporary_speed_limit_group.id))
            .timetable_id(timetable.id)
            .search_window_begin(Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap())
            .search_window_end(Utc.with_ymd_and_hms(2024, 1, 15, 0, 0, 0).unwrap())
            .enabled_from(enabled_from)
            .enabled_until(enabled_until);
        let too_old = best_env
            .clone()
            .enabled_from(enabled_from - Duration::days(3))
            .enabled_until(enabled_until - Duration::days(3));
        let too_young = best_env
            .clone()
            .enabled_from(enabled_from + Duration::days(3))
            .enabled_until(enabled_until + Duration::days(3));

        for env in [best_env, too_old, too_young] {
            env.create(&mut pool.get_ok())
                .await
                .expect("Failed to create stdcm search environment");
        }

        let request = app.get("/stdcm/search_environment");

        // WHEN
        let stdcm_search_env = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<StdcmSearchEnvironment>();

        // THEN
        assert_eq!(stdcm_search_env.enabled_from, enabled_from);
        assert_eq!(stdcm_search_env.enabled_until, enabled_until);
    }

    #[rstest]
    async fn retrieve_stdcm_search_env_not_found() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        StdcmSearchEnvironment::delete_all(&mut pool.get_ok())
            .await
            .expect("Failed to delete all search environments");

        // WHEN
        let request = app.get("/stdcm/search_environment");
        let response = app.fetch(request);

        // THEN
        response.assert_status(StatusCode::NO_CONTENT);
    }

    #[rstest]
    async fn delete_stdcm_search_env() {
        // GIVEN
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let (
            infra,
            timetable,
            work_schedule_group,
            temporary_speed_limit_group,
            electrical_profile_set,
        ) = stdcm_search_env_fixtures(&mut pool.get_ok()).await;

        let env = StdcmSearchEnvironment::changeset()
            .infra_id(infra.id)
            .electrical_profile_set_id(Some(electrical_profile_set.id))
            .work_schedule_group_id(Some(work_schedule_group.id))
            .temporary_speed_limit_group_id(Some(temporary_speed_limit_group.id))
            .timetable_id(timetable.id)
            .search_window_begin(Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap())
            .search_window_end(Utc.with_ymd_and_hms(2024, 1, 15, 0, 0, 0).unwrap())
            .enabled_from(Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap())
            .enabled_until(Utc.with_ymd_and_hms(2024, 1, 1, 23, 59, 59).unwrap())
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create stdcm search environment");

        let request = app.delete(&format!("/stdcm/search_environment/{}", env.id));

        // WHEN
        app.fetch(request).assert_status(StatusCode::NO_CONTENT);

        // THEN
        let deleted_env_exists = StdcmSearchEnvironment::exists(&mut pool.get_ok(), env.id)
            .await
            .expect("Failed to query stdcm search environment");

        assert_eq!(deleted_env_exists, false);
    }

    #[rstest]
    async fn list_stdcm_search_env() {
        // GIVEN
        let app = TestAppBuilder::default_app();

        let pool = app.db_pool();

        let (
            infra,
            timetable,
            work_schedule_group,
            temporary_speed_limit_group,
            electrical_profile_set,
        ) = stdcm_search_env_fixtures(&mut pool.get_ok()).await;

        let env1 = StdcmSearchEnvironment::changeset()
            .infra_id(infra.id)
            .electrical_profile_set_id(Some(electrical_profile_set.id))
            .work_schedule_group_id(Some(work_schedule_group.id))
            .temporary_speed_limit_group_id(Some(temporary_speed_limit_group.id))
            .timetable_id(timetable.id)
            .search_window_begin(Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap())
            .search_window_end(Utc.with_ymd_and_hms(2024, 1, 15, 0, 0, 0).unwrap())
            .enabled_from(Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap())
            .enabled_until(Utc.with_ymd_and_hms(2024, 1, 1, 23, 59, 59).unwrap())
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create stdcm search environment");

        let env2 = env1
            .clone()
            .into_changeset()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create stdcm search environment");

        let env3 = env1
            .clone()
            .into_changeset()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create stdcm search environment");

        let request = app.get("/stdcm/search_environment/list");

        // WHEN
        let stdcm_search_env_response = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<SdcmSearchEnvListResponse>();

        // THEN
        let created_ids = HashSet::from([env1.id, env2.id, env3.id]);
        let retrieved_ids: HashSet<i64> = stdcm_search_env_response
            .results
            .iter()
            .map(|env| env.id)
            .collect();
        assert_eq!(
            created_ids
                .difference(&retrieved_ids)
                .collect::<HashSet<_>>(),
            HashSet::default()
        );
    }
}
