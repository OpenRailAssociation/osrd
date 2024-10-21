use axum::extract::Json;
use axum::extract::State;
use axum::Extension;
use chrono::NaiveDateTime;
use chrono::Utc;
use editoast_derive::EditoastError;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::infra::{DirectionalTrackRange, Sign};
use editoast_schemas::primitives::Identifier;
use serde::de::Error as SerdeError;
use serde::{Deserialize, Serialize};
use std::collections::{HashSet, HashMap};
use std::result::Result as StdResult;
use thiserror::Error;
use utoipa::ToSchema;
use std::iter::Extend;

use crate::error::InternalError;
use crate::error::Result;
use crate::infra_cache::Graph;
use crate::infra_cache::InfraCache;
use crate::models::temporary_speed_limits::TemporarySpeedLimit;
use crate::models::temporary_speed_limits::TemporarySpeedLimitGroup;
use crate::models::Changeset;
use crate::models::Infra;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use crate::AppState;
use crate::Create;
use crate::CreateBatch;
use crate::Model;
use crate::Retrieve;
use editoast_authz::BuiltinRole;

use super::infra::InfraApiError;

crate::routes! {
    "/temporary_speed_limit_group" => create_temporary_speed_limit_group,
}

#[derive(Serialize, ToSchema)]
struct TemporarySpeedLimitItemForm {
    start_date_time: NaiveDateTime,
    end_date_time: NaiveDateTime,
    signals: Vec<Sign>,
    speed_limit: f64,
    obj_id: String,
}

struct TemporarySpeedLimitImport {
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

impl TemporarySpeedLimitImport {
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

    fn from_temporary_speed_limit_item(speed_limit: TemporarySpeedLimitItemForm, graph: &Graph) -> Self {
        let track_ranges: Vec<DirectionalTrackRange> =
            track_ranges_from_signals(&speed_limit.signals, &graph);
        TemporarySpeedLimitImport {
            start_date_time: speed_limit.start_date_time,
            end_date_time: speed_limit.end_date_time,
            track_ranges,
            speed_limit: speed_limit.speed_limit,
            obj_id: speed_limit.obj_id,
        }
    }
}

/// Retrieve from the infrastructure the track sections which match a list of temporary speed limit
/// signals. The input signals vector is expected to contain valid temporary speed limit signals,
/// i.e. signals which sign type is either `EXECUTION` or `RESUME`.
fn track_ranges_from_signals(signals: &Vec<Sign>, graph: &Graph) -> Vec<DirectionalTrackRange> {
    // TODO
    // - Merge adjacent directional track ranges together into a bigger one.
    // - Use sets instead of maps for storing directional track ranges -> Implement Hash for
    // DirectionalTrackRange ?
    let (execution_signals, resume_signals): (Vec<_>, Vec<_>) = signals
        .into_iter()
        .filter(|s| s.sign_type == "E".into() || s.sign_type == "R".into())
        .partition(|s| s.sign_type == "E".into());
    let mut speed_limit_track_ranges: Vec<DirectionalTrackRange> = Vec::new();
    execution_signals.into_iter()
        .for_each(|start_signal| speed_limit_track_ranges.extend(impacted_tracks(start_signal, &resume_signals, graph, f64::MAX)));
    speed_limit_track_ranges.into_iter().collect::<Vec<_>>()
}

/// Do a graph traversal from `entry` up to any of the `exits` and return the visited track ranges
/// which correspond to the track ranges impacted by the temporary speed limit.
/// For a given resume signal, a valid exit is:
///     - A resume signal.
///     - Another execution signal (which will define another temporary speed limit and void the
///     current one).
/// The algorithm stops looking for more track ranges if the distance from `entry` to the track
/// range being currently explored track range exceeds the maximum distance defined, so that a
/// missing `exit` signal in a given direction does not cause the temporary speed limit to keep
/// exploring the whole infrastructure.
/// # Parameters:
/// - `entry`: The entry point of the LTV.
/// - `exits`: any valid exit for the LTV, i.e. any signal that exists in the infrastructure (does
/// this mean we need to persist signals ? If we take any signal as a valid stop case we need to
/// consider the signals related to already imported LTVs, and they are not present anymore in the
/// current import request.)
/// - `max_distance`: The maximum distance (in meters ?) after which we consider the exit signal is
/// missing and we stop adding new track ranges from the current path.
fn impacted_tracks(entry: &Sign, exits: &Vec<&Sign>, graph: &Graph, _max_distance: f64) -> Vec<DirectionalTrackRange> {

    // TrackEndpoint right after the entry sign (in the correct direction):
    let first_track_endpoint: &TrackEndpoint = todo!();

    // Identifiers of the track sections that have already been reached and should be ignored:
    let mut visited_tracks: HashSet<Identifier> = HashSet::new();

    // Neighbors of the explored tracks, i.e. the tracks that should be visited next:
    let mut next_tracks: Vec<&TrackEndpoint> = vec![first_track_endpoint];

    // Directional track ranges reached from `entry` during the graph exploration.
    let first_track_range: DirectionalTrackRange = todo!();
    let mut related_tracks_ranges: Vec<DirectionalTrackRange> = Vec::new();
    related_tracks_ranges.push(first_track_range);

    while !next_tracks.is_empty() {
        let curr_track = next_tracks.pop().unwrap();
        if !visited_tracks.insert(curr_track.track) {
            // Track already visited; skipping it.
            continue
        }
        // TODO check if there is a resume signal on that track range
        // - If so, add the current track range with the resume sign offset to the returned tracks.
        // - Otherwise, add the track neighbours to the next tracks to be visited and add the full
        // track to the returned tracks.
        let neighbours = graph.get_all_neighbours(curr_track);
        next_tracks.extend(neighbours);
        // TODO Add associated directional track range to the list of impacted track ranges

    }
    related_tracks_ranges
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
            signals: Vec<Sign>,
            speed_limit: f64,
            obj_id: String,
        }
        let Internal {
            start_date_time,
            end_date_time,
            signals,
            speed_limit,
            obj_id,
        } = Internal::deserialize(deserializer)?;

        // Validation checks

        if end_date_time <= start_date_time {
            return Err(SerdeError::custom(format!(
                "The temporary_speed_limit start date '{}' must be before the end date '{}'",
                start_date_time, end_date_time
            )));
        }

        Ok(TemporarySpeedLimitItemForm {
            start_date_time,
            end_date_time,
            signals,
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
    State(app_state): State<AppState>,
    Extension(authorizer): AuthorizerExt,
    Json(TemporarySpeedLimitCreateForm {
        speed_limit_group_name,
        speed_limits,
    }): Json<TemporarySpeedLimitCreateForm>,
) -> Result<Json<TemporarySpeedLimitCreateResponse>> {
    let authorized = authorizer
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

    // Retrieve the infra

    let MAGIC_INFRA_NUMBER = 2; // TODO fixme
    let infra_caches = app_state.infra_caches.clone();
    let infra = Infra::retrieve_or_fail(conn, MAGIC_INFRA_NUMBER, || {
        InfraApiError::NotFound {
            infra_id: MAGIC_INFRA_NUMBER,
        }
    })
    .await?;
    let infra_cache = InfraCache::get_or_load(conn, &infra_caches, &infra).await?;
    let graph = Graph::load(&infra_cache);

    // Create the speed limits
    let speed_limits_changesets = speed_limits
        .into_iter()
        .map(|speed_limit| TemporarySpeedLimitImport::from_temporary_speed_limit_item(speed_limit, &graph))
        .map(|speed_limit| speed_limit.into_temporary_speed_limit_changeset(group_id))
        .collect::<Vec<_>>();
    let _: Vec<_> = TemporarySpeedLimit::create_batch(conn, speed_limits_changesets).await?;

    Ok(Json(TemporarySpeedLimitCreateResponse { group_id }))
}

#[cfg(test)]
mod tests {
    use crate::{
        models::temporary_speed_limits::TemporarySpeedLimitGroup, views::test_app::TestApp, List,
        Retrieve, SelectionSettings,
    };
    use axum::http::StatusCode;
    use axum_test::TestRequest;
    use chrono::{DateTime, Duration, NaiveDateTime, Utc};
    use rstest::rstest;
    use serde_json::json;
    use uuid::Uuid;

    use crate::{
        models::temporary_speed_limits::TemporarySpeedLimit,
        views::{
            temporary_speed_limits::TemporarySpeedLimitCreateResponse, test_app::TestAppBuilder,
        },
    };

    struct TimePeriod {
        start_date_time: NaiveDateTime,
        end_date_time: NaiveDateTime,
    }

    impl TestApp {
        fn create_temporary_speed_limit_group_request(
            &self,
            group_name: Option<&str>,
            obj_id: Option<&str>,
            time_period: Option<TimePeriod>,
        ) -> TestRequest {
            let group_name = group_name
                .map(String::from)
                .unwrap_or(Uuid::new_v4().to_string());
            let obj_id = obj_id
                .map(String::from)
                .unwrap_or(Uuid::new_v4().to_string());
            let TimePeriod {
                start_date_time,
                end_date_time,
            } = time_period.unwrap_or(TimePeriod {
                start_date_time: Utc::now().naive_utc(),
                end_date_time: Utc::now().naive_utc() + Duration::days(1),
            });
            self.post("/temporary_speed_limit_group").json(&json!(
                    {
                        "speed_limit_group_name": group_name,
                        "speed_limits": [
                        {
                            "start_date_time": start_date_time,
                            "end_date_time": end_date_time,
                            "signals": [
                            {
                                "track": Uuid::new_v4(),
                                "position": 3000.4,
                                "side": "LEFT",
                                "direction": "START_TO_STOP",
                                "type": "E",
                                "value": "1000",
                                "kp": "147+292",
                            }
                        ],
                            "speed_limit": 80.,
                            "obj_id": obj_id,
                        }]
                    }
            ))
        }
    }

    #[rstest]
    async fn create_temporary_speed_limits_succeeds() {
        let app = TestAppBuilder::default_app();
        let pool = app.db_pool();

        let group_name = Uuid::new_v4().to_string();
        let request_obj_id = Uuid::new_v4().to_string();

        let request = app.create_temporary_speed_limit_group_request(
            Some(&group_name),
            Some(&request_obj_id),
            None,
        );

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
        let request = app.create_temporary_speed_limit_group_request(Some(&group_name), None, None);
        let _ = app.fetch(request).assert_status(StatusCode::OK);

        let request = app.create_temporary_speed_limit_group_request(None, None, None);
        let _ = app.fetch(request).assert_status(StatusCode::OK);

        let request = app.create_temporary_speed_limit_group_request(Some(&group_name), None, None);
        let _ = app.fetch(request).assert_status(StatusCode::BAD_REQUEST);
    }

    #[rstest]
    async fn create_ltv_with_invalid_invalid_time_period_fails() {
        let app = TestAppBuilder::default_app();

        let time_period = TimePeriod {
            start_date_time: Utc::now().naive_utc() + Duration::days(1),
            end_date_time: Utc::now().naive_utc(),
        };

        let request = app.create_temporary_speed_limit_group_request(None, None, Some(time_period));

        let _ = app
            .fetch(request)
            .assert_status(StatusCode::UNPROCESSABLE_ENTITY);
    }
}
