use axum::Json;
use axum::extract::State;
use common::Version;

use crate::AppState;

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    responses(
        (status = 200, description = "Return the service version", body = Version),
    ),
)]
pub(in crate::views) async fn version(
    State(AppState { config, .. }): State<AppState>,
) -> Json<Version> {
    Json(Version {
        git_describe: config.app_version.clone(),
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::views::test_app::TestAppBuilder;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn version() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/version");
        let response: HashMap<String, Option<String>> = app.fetch(request).await.json_into();
        assert!(response.contains_key("git_describe"));
    }
}
