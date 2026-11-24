use crate::generated_data::sprite_config::SpriteConfig;
use axum::extract::Json;

/// This endpoint returns the list of supported signaling systems
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "sprites",
    responses(
        (status = 200, description = "List of supported signaling systems", body = Vec<String>, example = json!(["BAL", "TVM300"])),
    ),
)]
pub(in crate::views) async fn get() -> Json<Vec<&'static str>> {
    let sprite_configs = SpriteConfig::load();
    let signaling_systems = sprite_configs.keys().copied().collect();
    Json(signaling_systems)
}

#[cfg(test)]
mod tests {
    use crate::views::test_app;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn signaling_systems() {
        let app = test_app!().skip_authz().build();
        let response: Vec<String> = app
            .get("/sprites/signaling_systems")
            .await
            .assert_status_ok()
            .json();

        assert!(response.contains(&"BAL".to_string()));
        assert!(response.contains(&"BAPR".to_string()));
        assert!(response.contains(&"TVM300".to_string()));
        assert!(response.contains(&"TVM430".to_string()));
        assert!(response.contains(&"ETCS_LEVEL2".to_string()));
    }
}
