use axum::extract::State;
use axum::Json;

use crate::error::Result;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::AppState;

crate::routes! {
    "/speed_limit_tags" => speed_limit_tags,
}

#[utoipa::path(
    get, path = "",
    tag = "speed_limit_tags",
    responses(
        (status = 200, description = "List of configured speed-limit tags", body = Vec<String>, example = json!(["V200", "MA80"])),
    ),
)]
async fn speed_limit_tags(
    State(AppState {
        speed_limit_tag_ids,
        ..
    }): State<AppState>,
) -> Result<Json<SpeedLimitTagIds>> {
    Ok(Json(speed_limit_tag_ids.as_ref().clone()))
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use rstest::rstest;

    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn get_speed_limit_list() {
        let app = TestAppBuilder::default_app();

        let request = app.get("/speed_limit_tags");

        let response: Vec<String> = app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert!(response.len() >= 2);
        assert!(response.contains(&"MA80".to_string()));
        assert!(response.contains(&"V200".to_string()));
    }
}
