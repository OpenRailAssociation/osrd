use axum::Extension;
use axum::extract::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use chrono::DateTime;
use chrono::Utc;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use schemas::infra::DirectionalTrackRange;
use serde::Deserialize;
use serde::Serialize;
use serde::de::Error as SerdeError;
use std::result::Result as StdResult;
use std::sync::Arc;
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use authz::Role;
use editoast_models::TemporarySpeedLimit;
use editoast_models::TemporarySpeedLimitGroup;
use editoast_models::temporary_speed_limits;

#[derive(Deserialize, ToSchema)]
#[serde(remote = "Self")]
#[cfg_attr(test, derive(Serialize))]
struct TemporarySpeedLimitItemForm {
    start_date_time: DateTime<Utc>,
    end_date_time: DateTime<Utc>,
    track_ranges: Vec<DirectionalTrackRange>,
    speed_limit: f64,
    obj_id: String,
}

#[derive(Deserialize, ToSchema)]
#[cfg_attr(test, derive(Serialize))]
pub(in crate::views) struct TemporarySpeedLimitCreateForm {
    speed_limit_group_name: String,
    #[schema(inline)]
    speed_limits: Vec<TemporarySpeedLimitItemForm>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct TemporarySpeedLimitCreateResponse {
    group_id: i64,
}

impl TemporarySpeedLimitItemForm {
    fn into_temporary_speed_limit_changeset(
        self,
        temporary_speed_limit_group_id: i64,
    ) -> Changeset<TemporarySpeedLimit> {
        TemporarySpeedLimit::changeset()
            .start_date_time(self.start_date_time)
            .end_date_time(self.end_date_time)
            .track_ranges(self.track_ranges)
            .speed_limit(self.speed_limit)
            .obj_id(self.obj_id)
            .temporary_speed_limit_group_id(temporary_speed_limit_group_id)
    }
}

impl<'de> Deserialize<'de> for TemporarySpeedLimitItemForm {
    fn deserialize<D>(deserializer: D) -> StdResult<TemporarySpeedLimitItemForm, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let speed_limit = TemporarySpeedLimitItemForm::deserialize(deserializer)?;
        if speed_limit.end_date_time <= speed_limit.start_date_time {
            return Err(SerdeError::custom(format!(
                "The temporary_speed_limit start date '{}' must be before the end date '{}'",
                speed_limit.start_date_time, speed_limit.end_date_time,
            )));
        }
        Ok(speed_limit)
    }
}

#[cfg(test)]
impl Serialize for TemporarySpeedLimitItemForm {
    fn serialize<S>(&self, serializer: S) -> StdResult<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        TemporarySpeedLimitItemForm::serialize(self, serializer)
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "temporary_speed_limit")]
enum TemporarySpeedLimitError {
    #[error("Name '{name}' already used")]
    #[editoast_error(status = 400)]
    NameAlreadyUsed { name: String },
    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

impl From<temporary_speed_limits::TslGroupError> for TemporarySpeedLimitError {
    fn from(e: temporary_speed_limits::TslGroupError) -> Self {
        match e {
            temporary_speed_limits::TslGroupError::NameAlreadyUsed { name } => {
                Self::NameAlreadyUsed { name }
            }
            temporary_speed_limits::TslGroupError::Database(err) => Self::Database(err),
        }
    }
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "temporary_speed_limits",
    request_body = inline(TemporarySpeedLimitCreateForm),
    responses(
        (status = 201, body = inline(TemporarySpeedLimitCreateResponse), description = "The id of the created temporary speed limit group." ),
    )
)]
pub(in crate::views) async fn create_temporary_speed_limit_group(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Json(TemporarySpeedLimitCreateForm {
        speed_limit_group_name,
        speed_limits,
    }): Json<TemporarySpeedLimitCreateForm>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    // Create the speed limits group
    let TemporarySpeedLimitGroup { id: group_id, .. } = TemporarySpeedLimitGroup::changeset()
        .name(speed_limit_group_name.clone())
        .creation_date(Utc::now())
        .create(conn)
        .await
        .map_err(TemporarySpeedLimitError::from)?;

    // Create the speed limits
    let speed_limits_changesets = speed_limits
        .into_iter()
        .map(|speed_limit| speed_limit.into_temporary_speed_limit_changeset(group_id))
        .collect::<Vec<_>>();
    let _: Vec<_> = TemporarySpeedLimit::create_batch(conn, speed_limits_changesets)
        .await
        .map_err(TemporarySpeedLimitError::from)?;

    Ok((
        StatusCode::CREATED,
        Json(TemporarySpeedLimitCreateResponse { group_id }),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::views::test_app::TestApp;
    use axum_test::TestRequest;
    use chrono::DateTime;
    use chrono::Duration;
    use chrono::Utc;
    use editoast_models::TemporarySpeedLimitGroup;

    use schemas::infra::Direction;
    use schemas::infra::DirectionalTrackRange;
    use serde_json::json;
    use uuid::Uuid;

    use crate::views::temporary_speed_limits::TemporarySpeedLimitCreateResponse;
    use crate::views::test_app::TestAppBuilder;
    use editoast_models::TemporarySpeedLimit;

    struct TimePeriod {
        start_date_time: DateTime<Utc>,
        end_date_time: DateTime<Utc>,
    }

    impl TestApp {
        fn create_temporary_speed_limit_group_request(
            &self,
            RequestParameters {
                group_name,
                obj_id,
                time_period:
                    TimePeriod {
                        start_date_time,
                        end_date_time,
                    },
                track_ranges,
            }: RequestParameters,
        ) -> TestRequest {
            self.post("/temporary_speed_limit_group").json(&json!(
                    {
                        "speed_limit_group_name": group_name,
                        "speed_limits": [                    {
                            "start_date_time": start_date_time,
                            "end_date_time": end_date_time,
                            "track_ranges": track_ranges,
                            "speed_limit": 80.,
                            "obj_id": obj_id,
                        }]
                    }
            ))
        }
    }

    struct RequestParameters {
        group_name: String,
        obj_id: String,
        time_period: TimePeriod,
        track_ranges: Vec<DirectionalTrackRange>,
    }

    impl RequestParameters {
        fn new() -> Self {
            RequestParameters {
                group_name: Uuid::new_v4().to_string(),
                obj_id: Uuid::new_v4().to_string(),
                time_period: TimePeriod {
                    start_date_time: Utc::now(),
                    end_date_time: Utc::now() + Duration::days(1),
                },
                track_ranges: vec![
                    DirectionalTrackRange {
                        track: "TA0".into(),
                        begin: 0.,
                        end: 2000.,
                        direction: Direction::StartToStop,
                    },
                    DirectionalTrackRange {
                        track: "TA1".into(),
                        begin: 0.,
                        end: 1950.,
                        direction: Direction::StartToStop,
                    },
                ],
            }
        }

        fn with_group_name(mut self, group_name: String) -> Self {
            self.group_name = group_name;
            self
        }

        fn with_obj_id(mut self, obj_id: String) -> Self {
            self.obj_id = obj_id;
            self
        }

        fn with_time_period(mut self, time_period: TimePeriod) -> Self {
            self.time_period = time_period;
            self
        }

        fn with_track_ranges(mut self, track_ranges: Vec<DirectionalTrackRange>) -> Self {
            self.track_ranges = track_ranges;
            self
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_temporary_speed_limits_succeeds() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let group_name = Uuid::new_v4().to_string();
        let request_obj_id = Uuid::new_v4().to_string();

        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new()
                .with_group_name(group_name.clone())
                .with_obj_id(request_obj_id.clone()),
        );

        // Speed limit group checks

        let TemporarySpeedLimitCreateResponse { group_id } = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();
        let created_group = TemporarySpeedLimitGroup::retrieve(pool.get_ok(), group_id)
            .await
            .expect("Failed to retrieve the created temporary speed limit group")
            .expect("No temporary speed limit group matches the group identifier of the endpoint response");

        assert_eq!(created_group.name, group_name);

        // Speed limit checks

        let selection_settings: SelectionSettings<TemporarySpeedLimit> = SelectionSettings::new()
            .filter(move || TemporarySpeedLimit::TEMPORARY_SPEED_LIMIT_GROUP_ID.eq(group_id));
        let created_speed_limits: Vec<TemporarySpeedLimit> =
            TemporarySpeedLimit::list(&mut pool.get_ok(), selection_settings)
                .await
                .expect("Failed to retrieve temporary speed limits from the database");

        assert_eq!(created_speed_limits.len(), 1);
        let TemporarySpeedLimit { obj_id, .. } = &created_speed_limits[0];
        assert_eq!(obj_id, &request_obj_id);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_temporary_speed_limit_groups_with_identical_name_fails() {
        let app = TestAppBuilder::default_app();

        let group_name = Uuid::new_v4().to_string();
        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new().with_group_name(group_name.clone()),
        );
        let _ = app.fetch(request).await.assert_status(StatusCode::CREATED);

        let request = app.create_temporary_speed_limit_group_request(RequestParameters::new());
        let _ = app.fetch(request).await.assert_status(StatusCode::CREATED);

        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new().with_group_name(group_name.clone()),
        );
        let _ = app
            .fetch(request)
            .await
            .assert_status(StatusCode::BAD_REQUEST);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_ltv_with_invalid_invalid_time_period_fails() {
        let app = TestAppBuilder::default_app();

        let time_period = TimePeriod {
            start_date_time: Utc::now() + Duration::days(1),
            end_date_time: Utc::now(),
        };

        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new().with_time_period(time_period),
        );

        let _ = app
            .fetch(request)
            .await
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[ignore] // TODO is this something we want to enforce ?
    async fn create_ltv_with_no_tracks_fails() {
        let app = TestAppBuilder::default_app();

        let request = app.create_temporary_speed_limit_group_request(
            RequestParameters::new().with_track_ranges(vec![]),
        );

        let _ = app
            .fetch(request)
            .await
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    }
}
