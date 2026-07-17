use authz::Role;
use axum::extract::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use database::DbConnectionPoolV2;

use editoast_models::search_journey_environment::SearchJourneyEnvironmentWithTimetables;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::error::Result;

#[derive(Serialize, Deserialize, ToSchema)]
struct SearchJourneyEnvironmentResponse {
    id: i64,
    infra_id: i64,
    timetable_ids: Vec<i64>,
}

impl From<SearchJourneyEnvironmentWithTimetables> for SearchJourneyEnvironmentResponse {
    fn from(env: SearchJourneyEnvironmentWithTimetables) -> Self {
        Self {
            id: env.id,
            infra_id: env.infra_id,
            timetable_ids: env.timetable_ids,
        }
    }
}

#[editoast_derive::route(Role::Admin)]
#[utoipa::path(
    get, path = "",
    tag = "search_journey_environment",
    responses(
        (status = 200, body = SearchJourneyEnvironmentResponse, description = "The most recent search journey environment"),
        (status = 204, description = "No search environment exists")
    )
)]
pub(in crate::views) async fn retrieve_latest(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
) -> Result<Response> {
    let conn = &mut db_pool.get().await?;
    let env = SearchJourneyEnvironmentWithTimetables::retrieve_latest(conn).await?;
    if let Some(env) = env {
        Ok(Json(SearchJourneyEnvironmentResponse::from(env)).into_response())
    } else {
        tracing::warn!("Search journey environment queried but no environment exists");
        Ok(StatusCode::NO_CONTENT.into_response())
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::views::test_app;
    use editoast_models::SearchJourneyEnvironment;
    use editoast_models::prelude::*;
    use editoast_models::search_journey_environment::fixtures::search_journey_env_fixtures;
    use pretty_assertions::assert_eq;
    use std::collections::HashSet;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn retrieve_search_journey_env() {
        let app = test_app!().skip_authz().build();
        let pool = app.db_pool();
        let conn = &mut pool.get_ok();

        let (infra, timetables) = search_journey_env_fixtures(conn).await;
        let timetable_ids: HashSet<i64> = timetables.iter().map(|t| t.id).collect();

        let _first = SearchJourneyEnvironment::changeset()
            .infra_id(infra.id)
            .create(conn)
            .await
            .expect("Failed to create search journey environment");

        let latest =
            SearchJourneyEnvironment::create_with_timetables(infra.id, timetable_ids.clone(), conn)
                .await
                .expect("Failed to create search journey environment");

        let env = app
            .get("/search_journeys/search_environment")
            .await
            .assert_status_ok()
            .json::<SearchJourneyEnvironmentResponse>();

        assert_eq!(env.id, latest.id);
        assert_eq!(env.infra_id, infra.id);

        let retrieved_timetable_ids: HashSet<i64> = env.timetable_ids.into_iter().collect();
        assert_eq!(retrieved_timetable_ids, timetable_ids);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn retrieve_search_journey_env_not_found() {
        let app = test_app!().skip_authz().build();
        let response = app.get("/search_journeys/search_environment").await;
        response.assert_status_no_content();
    }
}
