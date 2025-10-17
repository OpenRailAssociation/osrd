use std::{env, sync::Arc};

use axum::{Json, Router, extract::State, routing::get};
use axum_tracing_opentelemetry::middleware::OtelAxumLayer;
use serde::Serialize;
use tokio::sync::{Mutex, watch};
use tracing::info;

use crate::drivers::worker_driver::WorkerMetadata;

#[derive(Clone)]
struct AppState {
    known_workers: Arc<Mutex<Arc<Vec<WorkerMetadata>>>>,
}

pub async fn create_server(addr: String, known_workers: watch::Receiver<Arc<Vec<WorkerMetadata>>>) {
    let app_state = AppState {
        known_workers: Arc::default(),
    };

    tokio::spawn(app_state_updater(app_state.clone(), known_workers));

    let app = Router::new()
        .route("/version", get(version))
        .route("/health", get(health_check))
        .route("/list", get(worker_group_list))
        .layer(OtelAxumLayer::default())
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind(addr.clone())
        .await
        .expect("Failed to bind to address");

    info!(%addr, "Starting API server");

    axum::serve(listener, app)
        .await
        .expect("Failed to start server");

    info!(%addr, "Shutting down API server");
}

async fn app_state_updater(
    state: AppState,
    mut known_workers_recv: watch::Receiver<Arc<Vec<WorkerMetadata>>>,
) {
    loop {
        let changed = known_workers_recv.changed().await;
        if changed.is_err() {
            // Channel closed, exit
            return;
        }
        let known_workers = known_workers_recv.borrow_and_update().clone();
        {
            let mut state_known_workers = state.known_workers.lock().await;
            *state_known_workers = known_workers;
        }
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
struct ListWorkersResponse {
    workers: Arc<Vec<WorkerMetadata>>,
}

async fn worker_group_list(State(state): State<AppState>) -> Json<ListWorkersResponse> {
    let known_workers = state.known_workers.lock().await.clone();
    Json(ListWorkersResponse {
        workers: known_workers,
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
