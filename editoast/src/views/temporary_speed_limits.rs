use axum::extract::Json;
use axum::extract::State;
use axum::Extension;
use chrono::NaiveDateTime;
use chrono::Utc;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::DirectionalTrackRange;
use serde::de::Error as SerdeError;
use serde::{Deserialize, Serialize};
use std::result::Result as StdResult;
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::error::Result;
use crate::models::temporary_speed_limits::TemporarySpeedLimit;
use crate::models::temporary_speed_limits::TemporarySpeedLimitGroup;
use crate::models::Changeset;
use crate::views::AuthenticationExt;
use crate::views::AuthorizationError;
use crate::Create;
use crate::CreateBatch;
use crate::Model;
use editoast_authz::BuiltinRole;

crate::routes! {
    "/temporary_speed_limit_group" => create_temporary_speed_limit_group,
}

#[derive(Serialize, ToSchema)]
struct TemporarySpeedLimitItemForm {
    start_date_time: NaiveDateTime,
    end_date_time: NaiveDateTime,
    track_ranges: Vec<DirectionalTrackRange>,
    speed_limit: f64,
    obj_id: String,
}

#[derive(Serialize, Deserialize, ToSchema)]
struct TemporarySpeedLimitCreateForm {
    speed_limit_group_name: String,
    #[schema(inline)]
    speed_limits: Vec<TemporarySpeedLimitItemForm>,
}

#[derive(Serialize, Deserialize, ToSchema)]
struct TemporarySpeedLimitCreateResponse {
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
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Internal {
            start_date_time: NaiveDateTime,
            end_date_time: NaiveDateTime,
            track_ranges: Vec<DirectionalTrackRange>,
            speed_limit: f64,
            obj_id: String,
        }
        let Internal {
            start_date_time,
            end_date_time,
            track_ranges,
            speed_limit,
            obj_id,
        } = Internal::deserialize(deserializer)?;

        // Check dates
        if end_date_time <= start_date_time {
            return Err(SerdeError::custom(format!(
                "The temporary_speed_limit start date '{}' must be before the end date '{}'",
                start_date_time, end_date_time
            )));
        }

        Ok(TemporarySpeedLimitItemForm {
            start_date_time,
            end_date_time,
            track_ranges,
            speed_limit,
            obj_id,
        })
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "temporary_speed_limit")]
enum TemporarySpeedLimitError {
    #[error("Name '{name}' already used")]
    #[editoast_error(status = 400)]
    NameAlreadyUsed { name: String },
}

fn map_diesel_error(e: InternalError, name: impl AsRef<str>) -> InternalError {
    if e.message.contains(
        r#"duplicate key value violates unique constraint "temporary_speed_limit_group_name_key""#,
    ) {
        TemporarySpeedLimitError::NameAlreadyUsed {
            name: name.as_ref().to_string(),
        }
        .into()
    } else {
        e
    }
}

#[utoipa::path(
    post, path = "",
    tag = "temporary_speed_limits",
    request_body = inline(TemporarySpeedLimitCreateForm),
    responses(
        (status = 201, body = inline(TemporarySpeedLimitCreateResponse), description = "The id of the created temporary speed limit group." ),
    )
)]
async fn create_temporary_speed_limit_group(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(TemporarySpeedLimitCreateForm {
        speed_limit_group_name,
        speed_limits,
    }): Json<TemporarySpeedLimitCreateForm>,
) -> Result<Json<TemporarySpeedLimitCreateResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let conn = &mut db_pool.get().await?;

    // Create the speed limits group
    let TemporarySpeedLimitGroup { id: group_id, .. } = TemporarySpeedLimitGroup::changeset()
        .name(speed_limit_group_name.clone())
        .creation_date(Utc::now().naive_utc())
        .create(conn)
        .await
        .map_err(|e| map_diesel_error(e, speed_limit_group_name))?;

    // Create the speed limits
    let speed_limits_changesets = speed_limits
        .into_iter()
        .map(|speed_limit| speed_limit.into_temporary_speed_limit_changeset(group_id))
        .collect::<Vec<_>>();
    let _: Vec<_> = TemporarySpeedLimit::create_batch(conn, speed_limits_changesets).await?;

    Ok(Json(TemporarySpeedLimitCreateResponse { group_id }))
}

#[cfg(test)]
mod tests {
    use crate::{
        models::temporary_speed_limits::TemporarySpeedLimitGroup, List, Retrieve, SelectionSettings,
    };
    use axum::http::StatusCode;
    use rstest::rstest;
    use serde_json::json;
    use uuid::Uuid;

    use crate::{
        models::temporary_speed_limits::TemporarySpeedLimit,
        views::{
            temporary_speed_limits::TemporarySpeedLimitCreateResponse, test_app::TestAppBuilder,
        },
    };

    #[rstest]
    async fn create_temporary_speed_limits_succeeds() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let group_name = Uuid::new_v4().to_string();
        let request_obj_id = Uuid::new_v4().to_string();
        let request_speed_limit = 80.;
        let request = app.post("/temporary_speed_limit_group").json(&json!(
            {
                "speed_limit_group_name": group_name,
                "speed_limits": [
                {
                    "start_date_time": "2024-01-01T08:00:00",
                    "end_date_time": "2024-01-01T09:00:00",
                    "track_ranges": [],
                    "speed_limit": request_speed_limit,
                    "obj_id": request_obj_id,
                }]
            }
        ));

        // Speed limit group checks

        let TemporarySpeedLimitCreateResponse { group_id } =
            app.fetch(request).assert_status(StatusCode::OK).json_into();

        let created_group = TemporarySpeedLimitGroup::retrieve(&mut pool.get_ok(), group_id)
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

    #[rstest]
    async fn create_temporary_speed_limit_groups_with_identical_name_fails() {
        let app = TestAppBuilder::default_app();

        let group_name = Uuid::new_v4().to_string();
        let request = app.post("/temporary_speed_limit_group").json(&json!(
            {
                "speed_limit_group_name": group_name,
                "speed_limits": [
                {
                    "start_date_time": "2024-01-01T08:00:00",
                    "end_date_time": "2024-01-01T09:00:00",
                    "track_ranges": [],
                    "speed_limit": 80,
                    "obj_id": Uuid::new_v4().to_string(),
                }]
            }
        ));

        let _ = app.fetch(request).assert_status(StatusCode::OK);

        let request = app.post("/temporary_speed_limit_group").json(&json!(
            {
                "speed_limit_group_name": Uuid::new_v4().to_string(),
                "speed_limits": [
                {
                    "start_date_time": "2024-01-01T08:00:00",
                    "end_date_time": "2024-01-01T09:00:00",
                    "track_ranges": [],
                    "speed_limit": 80,
                    "obj_id": Uuid::new_v4().to_string(),
                }]
            }
        ));

        let _ = app.fetch(request).assert_status(StatusCode::OK);

        let request = app.post("/temporary_speed_limit_group").json(&json!(
            {
                "speed_limit_group_name": group_name,
                "speed_limits": [
                {
                    "start_date_time": "2024-01-01T08:00:00",
                    "end_date_time": "2024-01-01T09:00:00",
                    "track_ranges": [],
                    "speed_limit": 80,
                    "obj_id": Uuid::new_v4().to_string(),
                }]
            }
        ));

        let _ = app.fetch(request).assert_status(StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn create_ltv_with_invalid_invalid_time_period_fails() {
        let app = TestAppBuilder::default_app();

        let request = app.post("/temporary_speed_limit_group").json(&json!(
            {
                "speed_limit_group_name": Uuid::new_v4().to_string(),
                "speed_limits": [
                {
                    "start_date_time": "2024-01-01T08:00:00",
                    "end_date_time": "2023-01-01T09:00:00",
                    "track_ranges": [],
                    "speed_limit": 80,
                    "obj_id": Uuid::new_v4().to_string(),
                },
            ]}
        ));

        let _ = app
            .fetch(request)
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    }
}
