use serde::Serialize;
use tokio::select;

use crate::drivers::worker_driver::WorkerMetadata;
use crate::pool::{ActivityMessage, ActivityMessageKind};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

#[derive(Clone, Copy, Debug, Serialize)]
pub enum WorkerStatus {
    // If the worker is killed we just don't track it anymore
    Loading,
    Ready,
}

pub async fn status_tracker(
    mut known_workers_watch: tokio::sync::watch::Receiver<Arc<Vec<WorkerMetadata>>>,
    mut activity_receiver: tokio::sync::mpsc::Receiver<ActivityMessage>,
    worker_status_watch: tokio::sync::watch::Sender<Arc<HashMap<Vec<u8>, WorkerStatus>>>,
) {
    let mut worker_states = HashMap::<Vec<u8>, WorkerStatus>::new();
    let mut first_run = true;
    loop {
        select! {
            changed = known_workers_watch.changed() => {
                if changed.is_err() {
                    // Channel closed, exit
                    return;
                }
                let known_workers = known_workers_watch.borrow_and_update().clone();

                let known_workers_ids = HashSet::<Vec<u8>>::from_iter(
                    known_workers
                        .iter()
                        .map(|w: &WorkerMetadata| w.worker_id.to_string().into_bytes()),
                );
                worker_states.retain(|id, _| known_workers_ids.contains(id));

                for worker in known_workers.iter() {
                    let worker_id = worker.worker_id.to_string().into_bytes();
                    if !worker_states.contains_key(&worker_id) {
                        // If this is the first time we have a worker list, mark all workers as ready
                        // They may have been loaded from a previous OSRDyne run
                        worker_states.insert(worker_id.to_vec(), if !first_run {WorkerStatus::Loading} else {WorkerStatus::Ready});
                    }
                }
                first_run = false;
            },
            activity = activity_receiver.recv() => {
                if let Some(activity) = activity {
                    match activity.kind {
                        ActivityMessageKind::Ready => {
                            if !worker_states.contains_key(&activity.worker_id) {
                                log::warn!("Received Ready message for unknown worker {}", String::from_utf8_lossy(&activity.worker_id));
                            }
                            worker_states.insert(activity.worker_id, WorkerStatus::Ready);
                        }
                        ActivityMessageKind::Unknown => {}
                    }
                } else {
                    // Channel closed, exit
                    return;
                }
            }
        }

        let _ = worker_status_watch.send(Arc::new(worker_states.clone()));
    }
}
