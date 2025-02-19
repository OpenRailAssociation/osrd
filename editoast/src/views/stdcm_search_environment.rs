use axum::extract::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use axum::Extension;
use chrono::DateTime;
use chrono::Utc;
use editoast_authz::BuiltinRole;
use editoast_models::DbConnectionPoolV2;
use serde::de::Error as SerdeError;
use serde::Deserialize;
use std::result::Result as StdResult;
use utoipa::ToSchema;

#[cfg(test)]
use serde::Serialize;

use crate::error::Result;
use crate::models::stdcm_search_environment::StdcmSearchEnvironment;
use crate::models::Changeset;
use crate::models::Create;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::Model;

crate::routes! {
    "/stdcm/search_environment" => {
        create,
        retrieve_latest,
    },
}

editoast_common::schemas! {
    StdcmSearchEnvironmentCreateForm,
    StdcmSearchEnvironment,
}

#[derive(ToSchema)]
#[cfg_attr(test, derive(Serialize))]
struct StdcmSearchEnvironmentCreateForm {
    infra_id: i64,
    electrical_profile_set_id: Option<i64>,
    work_schedule_group_id: Option<i64>,
    temporary_speed_limit_group_id: Option<i64>,
    timetable_id: i64,
    search_window_begin: DateTime<Utc>,
    search_window_end: DateTime<Utc>,
    enabled_from: DateTime<Utc>,
    enabled_until: DateTime<Utc>,
}

impl<'de> Deserialize<'de> for StdcmSearchEnvironmentCreateForm {
    fn deserialize<D>(deserializer: D) -> StdResult<StdcmSearchEnvironmentCreateForm, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Internal {
            infra_id: i64,
            electrical_profile_set_id: Option<i64>,
            work_schedule_group_id: Option<i64>,
            temporary_speed_limit_group_id: Option<i64>,
            timetable_id: i64,
            search_window_begin: DateTime<Utc>,
            search_window_end: DateTime<Utc>,
            enabled_from: DateTime<Utc>,
            enabled_until: DateTime<Utc>,
        }
        let internal = Internal::deserialize(deserializer)?;

        // Check dates
        if internal.search_window_begin >= internal.search_window_end {
            return Err(SerdeError::custom(format!(
                "The search environment simulation window begin '{}' must be before the end '{}'",
                internal.search_window_begin, internal.search_window_end
            )));
        }
        if internal.enabled_from >= internal.enabled_until {
            return Err(SerdeError::custom(format!(
                "The search environment enabled window begin '{}' must be before the end '{}'",
                internal.enabled_from, internal.enabled_until
            )));
        }

        Ok(StdcmSearchEnvironmentCreateForm {
            infra_id: internal.infra_id,
            electrical_profile_set_id: internal.electrical_profile_set_id,
            work_schedule_group_id: internal.work_schedule_group_id,
            temporary_speed_limit_group_id: internal.temporary_speed_limit_group_id,
            timetable_id: internal.timetable_id,
            search_window_begin: internal.search_window_begin,
            search_window_end: internal.search_window_end,
            enabled_from: internal.enabled_from,
            enabled_until: internal.enabled_until,
        })
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
    }
}

#[utoipa::path(
    post, path = "",
    tag = "stdcm_search_environment",
    request_body = StdcmSearchEnvironmentCreateForm,
    responses(
        (status = 201, body = StdcmSearchEnvironment),
    )
)]
async fn create(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(form): Json<StdcmSearchEnvironmentCreateForm>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::StdcmAdmin].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;
    let changeset: Changeset<StdcmSearchEnvironment> = form.into();
    Ok((StatusCode::CREATED, Json(changeset.create(conn).await?)))
}

#[utoipa::path(
    get, path = "",
    tag = "stdcm_search_environment",
    responses(
        (status = 200, body = StdcmSearchEnvironment),
        (status = 204, description = "No search environment was created")
    )
)]
async fn retrieve_latest(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
) -> Result<Response> {
    let authorized = auth
        .check_roles([BuiltinRole::Stdcm].into())
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

#[cfg(test)]
pub mod tests {
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
    use crate::{Create, Retrieve};

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
        };

        let request = app.post("/stdcm/search_environment").json(&form);

        // WHEN
        let stdcm_search_env = app
            .fetch(request)
            .assert_status(StatusCode::CREATED)
            .json_into::<StdcmSearchEnvironment>();

        // THEN
        let stdcm_search_env_in_db =
            StdcmSearchEnvironment::retrieve(&mut pool.get_ok(), stdcm_search_env.id)
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
}
