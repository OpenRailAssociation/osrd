use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json;

use crate::error::Result;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;

crate::routes! {
    "/speed_limit_tags" => {
        speed_limit_tags,
    },
}

#[utoipa::path(
    tag = "speed_limit_tags",
    responses(
        (status = 200, description = "List of configured speed-limit tags", body = Vec<String>, example = json!(["V200", "MA80"])),
    ),
)]
#[get("")]
async fn speed_limit_tags(
    speed_limit_tag_ids_data: Data<SpeedLimitTagIds>,
) -> Result<Json<SpeedLimitTagIds>> {
    Ok(Json(speed_limit_tag_ids_data.get_ref().clone()))
}

#[cfg(test)]
mod tests {
    use actix_http::StatusCode;
    use actix_web::test::TestRequest;
    use rstest::rstest;

    use crate::views::test_app::TestAppBuilder;

    #[rstest]
    async fn get_speed_limit_list() {
        let app = TestAppBuilder::default_app();

        let request = TestRequest::get().uri("/speed_limit_tags").to_request();

        let response: Vec<String> = app.fetch(request).assert_status(StatusCode::OK).json_into();

        assert!(response.len() >= 2);
        assert!(response.contains(&"MA80".to_string()));
        assert!(response.contains(&"V200".to_string()));
    }
}
