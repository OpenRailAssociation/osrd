use std::{env, sync::Arc};

use axum::{extract::State, routing::get, Json, Router};
use log::info;
use serde::Serialize;
use tokio::sync::Mutex;

use crate::drivers::worker_driver::WorkerMetadata;

#[derive(Clone)]
struct AppState {
    known_workers: Arc<Mutex<Arc<Vec<WorkerMetadata>>>>,
}

pub async fn create_server(
    addr: String,
    known_workers: tokio::sync::watch::Receiver<Arc<Vec<WorkerMetadata>>>,
) {
    let app_state = AppState {
        known_workers: Arc::new(Mutex::new(Arc::new(vec![]))),
    };

    tokio::spawn(app_state_updater(app_state.clone(), known_workers));

    let app = Router::new()
        .route("/version", get(version))
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

    info!("Shutting down API server on {}", addr);
}

async fn app_state_updater(
    state: AppState,
    mut known_workers: tokio::sync::watch::Receiver<Arc<Vec<WorkerMetadata>>>,
) {
    while known_workers.changed().await.is_ok() {
        let mut state_known_workers = state.known_workers.lock().await;
        *state_known_workers = known_workers.borrow().clone();
    }
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
    cores: Vec<WorkerMetadata>,
}

async fn list_cores(State(state): State<AppState>) -> Json<ListCoresResponse> {
    let latest_known_workers = state.known_workers.lock().await;
    Json(ListCoresResponse {
        cores: (**latest_known_workers).clone(),
    })
}

#[derive(Serialize)]
pub struct Version {
    git_describe: Option<String>,
}

async fn version() -> Json<Version> {
    Json(Version {
        git_describe: env::var("OSRD_GIT_DESCRIBE").ok(),
    })
}
