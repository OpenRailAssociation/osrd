use crate::map::{Layer, MapLayers};
use actix_web::get;
use actix_web::web::{Data, Json};
use std::collections::HashMap;

/// Returns all defined layers description in a json format
#[get("/info")]
pub async fn info_route(map_layers: Data<MapLayers>) -> Json<HashMap<String, Layer>> {
    Json(map_layers.layers.clone())
}

#[cfg(test)]
mod tests {
    use crate::views::tests::create_test_service;
    use actix_web::test as actix_test;
    use actix_web::test::{self, TestRequest};

    #[actix_test]
    async fn info() {
        let app = create_test_service().await;
        let request = TestRequest::get().uri("/layers/info").to_request();
        let response = test::call_service(&app, request).await;
        assert!(response.status().is_success());
    }
}
