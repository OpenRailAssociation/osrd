use std::sync::Arc;

use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use tokio::sync::Mutex;
use tracing::info;

use crate::drivers::core_driver::CoreMetadata;

#[derive(Clone)]
struct AppState {
    known_cores: Arc<Mutex<Vec<CoreMetadata>>>,
}

pub async fn create_server(addr: String, known_cores: Arc<Mutex<Vec<CoreMetadata>>>) {
    let app_state = AppState { known_cores };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/status", get(list_cores))
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind(addr.clone())
        .await
        .expect("Failed to bind to address");

    info!("Starting API server on {}", addr);

    axum::serve(listener, app)
        .await
        .expect("Failed to start server");
}

#[derive(Serialize)]
struct HealthCheckResponse {
    status: &'static str,
}

async fn health_check() -> Json<HealthCheckResponse> {
    Json(HealthCheckResponse { status: "ok" })
}

#[derive(Serialize)]
struct ListCoresResponse {
    cores: Vec<CoreMetadata>,
}

async fn list_cores(State(state): State<AppState>) -> Json<ListCoresResponse> {
    let latest_known_cores = state.known_cores.lock().await;
    Json(ListCoresResponse {
        cores: latest_known_cores.clone(),
    })
}
