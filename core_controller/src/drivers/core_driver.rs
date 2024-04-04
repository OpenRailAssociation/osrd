use std::{
    fmt::{self, Display, Formatter},
    future::Future,
    pin::Pin,
};

use serde::Serialize;
use uuid::Uuid;

#[derive(Clone, Serialize, Debug)]
pub struct CoreMetadata {
    /// External identifier (container id in Docker, deployment name in Kubernetes)
    pub external_id: String,
    /// Internal UUID of the core.
    pub core_id: Uuid,
    /// Infrastructure ID for which this core provides services.
    pub infra_id: usize,
}

#[derive(Debug)]
pub enum DriverError {
    /// Docker error
    DockerError(bollard::errors::Error),
    /// Kubernetes error
    KubernetesError(kube::Error),
}

impl Display for DriverError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            DriverError::DockerError(e) => write!(f, "Docker error: {}", e),
            DriverError::KubernetesError(e) => write!(f, "Kubernetes error: {}", e),
        }
    }
}

pub trait CoreDriver {
    /// Schedule a core to run on a specific infrastructure.
    /// If the core is already scheduled, nothing happens.
    /// Returns the internal UUID of the core.
    fn get_or_create_core_pool(
        &self,
        infra_id: usize,
    ) -> Pin<Box<dyn Future<Output = Result<Uuid, DriverError>> + Send + '_>>;

    /// Unschedules a core from the given infrastructure.
    fn destroy_core_pool(
        &self,
        infra_id: usize,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>>;

    /// Returns the status of a core.
    fn list_core_pools(
        &self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<CoreMetadata>, DriverError>> + Send + '_>>;
}
