use crate::api_error::ApiResult;
use crate::chartos::MapLayers;
use rocket::serde::json::{json, Value as JsonValue};

use rocket::State;

/// Returns all defined layers description in a json format
#[get("/info")]
pub async fn info_route(map_layers: &State<MapLayers>) -> ApiResult<JsonValue> {
    Ok(json!(map_layers.layers))
}

#[cfg(test)]
mod tests {
    use crate::views::tests::create_test_client;
    use rocket::http::Status;

    #[test]
    fn info() {
        let client = create_test_client();
        let response = client.get("/layers/info").dispatch();
        assert_eq!(response.status(), Status::Ok);
    }
}
