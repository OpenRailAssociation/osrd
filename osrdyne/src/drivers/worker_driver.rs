use std::{
    collections::HashMap,
    fmt::{self, Display, Formatter},
    future::Future,
    pin::Pin,
};

use serde::Serialize;
use uuid::Uuid;

use crate::Key;

#[derive(Clone, Serialize, Debug)]
pub struct WorkerMetadata {
    /// External identifier (container id in Docker, deployment name in Kubernetes)
    pub external_id: String,
    /// Internal UUID of the worker.
    pub worker_id: Uuid,
    /// Group ID for which this worker provides services.
    pub worker_key: Key,
    /// Metadata attached to the worker.
    pub metadata: HashMap<String, String>,
}

#[derive(Debug)]
#[allow(clippy::enum_variant_names)]
pub enum DriverError {
    /// Docker error
    DockerError(bollard::errors::Error),
    /// Kubernetes error
    KubernetesError(kube::Error),
    /// Process-compose error
    ProcessComposeError(anyhow::Error),
}

impl Display for DriverError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            DriverError::DockerError(e) => write!(f, "Docker error: {}", e),
            DriverError::KubernetesError(e) => write!(f, "Kubernetes error: {}", e),
            DriverError::ProcessComposeError(e) => write!(f, "process-compose error: {}", e),
        }
    }
}

pub trait WorkerDriver: Send {
    /// Schedule a worker to run on a specific key.
    /// If the worker is already scheduled, nothing happens.
    /// Returns the internal UUID of the worker.
    fn get_or_create_worker_group(
        &mut self,
        queue_name: String,
        worker_key: Key,
    ) -> Pin<Box<dyn Future<Output = Result<Uuid, DriverError>> + Send + '_>>;

    /// Unschedules a worker from the given group.
    fn destroy_worker_group(
        &mut self,
        worker_key: Key,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>>;

    /// This method should check if any ressources are dangling and clean them up.
    fn cleanup_stalled(
        &mut self,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>>;

    /// Returns the status of a worker.
    fn list_worker_groups(
        &self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<WorkerMetadata>, DriverError>> + Send + '_>>;
}
