use std::{
    collections::{HashMap, HashSet},
    env,
    sync::Arc,
};

use axum::{body::Body, extract::State, response::IntoResponse, routing::get, Json, Router};
use log::info;
use serde::Serialize;
use tokio::{
    select,
    sync::{watch, Mutex},
};

use crate::{drivers::worker_driver::WorkerMetadata, status_tracker::WorkerStatus, Key};
use axum_extra::extract::Query;
use serde::Deserialize;

#[derive(Clone, Serialize)]
struct WorkerState {
    worker_metadata: Option<WorkerMetadata>,
    status: WorkerStatus,
}

#[derive(Clone)]
struct AppState {
    known_workers: Arc<Mutex<HashMap<String, WorkerState>>>,
    is_noop: bool,
}

pub async fn create_server(
    addr: String,
    known_workers: watch::Receiver<Arc<Vec<WorkerMetadata>>>,
    worker_status: watch::Receiver<Arc<HashMap<String, WorkerStatus>>>,
    is_noop: bool,
) {
    let app_state = AppState {
        known_workers: Arc::new(Mutex::new(HashMap::new())),
        is_noop,
    };

    tokio::spawn(app_state_updater(
        app_state.clone(),
        known_workers,
        worker_status,
    ));

    let app = Router::new()
        .route("/version", get(version))
        .route("/health", get(health_check))
        .route("/status", get(list_workers))
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
    mut known_workers_recv: watch::Receiver<Arc<Vec<WorkerMetadata>>>,
    mut worker_status_recv: watch::Receiver<Arc<HashMap<String, WorkerStatus>>>,
) {
    let mut known_workers = Arc::new(vec![]);
    let mut worker_status = Arc::new(HashMap::new());
    loop {
        select! {
            changed = known_workers_recv.changed() => {
                    if changed.is_err() {
                        // Channel closed, exit
                        return;
                    }
                known_workers = known_workers_recv.borrow_and_update().clone();
            }
            changed = worker_status_recv.changed() => {
                    if changed.is_err() {
                        // Channel closed, exit
                        return;
                    }
                worker_status = worker_status_recv.borrow_and_update().clone();
            }
        }
        let mut known_workers_with_status = HashMap::new();
        for worker in known_workers.iter() {
            let status = worker_status.get(&worker.worker_id.to_string());
            known_workers_with_status.insert(
                worker.worker_id.to_string(),
                WorkerState {
                    worker_metadata: Some(worker.clone()),
                    status: status.cloned().unwrap_or(WorkerStatus::Loading),
                },
            );
        }
        let mut state_known_workers = state.known_workers.lock().await;
        *state_known_workers = known_workers_with_status;
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
    workers: HashMap<String, WorkerState>,
}

#[derive(Deserialize)]
struct ListWorkersQuery {
    keys: Option<Vec<Key>>,
}

#[derive(Debug, thiserror::Error)]
enum ListWorkerError {
    #[error("Worker metadata missing while not in noop mode")]
    MissingWorkerMetadata,
}

impl IntoResponse for ListWorkerError {
    fn into_response(self) -> http::Response<Body> {
        match self {
            ListWorkerError::MissingWorkerMetadata => http::Response::builder()
                .status(http::StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from("Worker metadata missing while not in noop mode"))
                .unwrap(),
        }
    }
}

async fn list_workers(
    State(state): State<AppState>,
    Query(query): Query<ListWorkersQuery>,
) -> Result<Json<ListWorkersResponse>, ListWorkerError> {
    let latest_known_workers = state.known_workers.lock().await.clone();
    let filtered_workers = match (query.keys, state.is_noop) {
        (Some(keys), false) => filter_workers(keys, latest_known_workers)?,
        (Some(keys), true) => keys
            .into_iter()
            .map(|key| {
                (
                    key.encode(),
                    WorkerState {
                        worker_metadata: Some(WorkerMetadata {
                            external_id: "noop".to_string(),
                            worker_id: uuid::Uuid::nil(),
                            worker_key: key,
                            metadata: Default::default(),
                        }),
                        // In noop mode, we can't track the worker states.
                        // We consider them always ready, as this mode is only used when debugging.
                        status: WorkerStatus::Ready,
                    },
                )
            })
            .collect(),
        (None, _) => latest_known_workers.into_iter().collect(),
    };
    Ok(Json(ListWorkersResponse {
        workers: filtered_workers,
    }))
}

fn filter_workers(
    keys: Vec<Key>,
    latest_known_workers: HashMap<String, WorkerState>,
) -> Result<HashMap<String, WorkerState>, ListWorkerError> {
    let keys_set: HashSet<_> = keys.into_iter().collect();
    let mut filtered_workers = HashMap::new();
    for (k, s) in latest_known_workers.into_iter() {
        let worker_key = s
            .worker_metadata
            .as_ref()
            .ok_or(ListWorkerError::MissingWorkerMetadata)?
            .worker_key
            .clone();
        if keys_set.contains(&worker_key) {
            filtered_workers.insert(k, s);
        }
    }
    Ok(filtered_workers)
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
