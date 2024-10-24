use crate::Key;

use super::worker_driver::{DriverError, WorkerDriver, WorkerMetadata};
use std::{future::Future, pin::Pin};
use tracing::instrument;
use uuid::Uuid;

#[derive(Debug)]
pub struct NoopDriver {
    fixed_pool_id: Uuid,
}

impl NoopDriver {
    pub fn new() -> Self {
        NoopDriver {
            fixed_pool_id: Uuid::new_v4(),
        }
    }
}

impl WorkerDriver for NoopDriver {
    #[instrument]
    fn get_or_create_worker_group(
        &mut self,
        _queue_name: String,
        _worker_key: Key,
    ) -> Pin<Box<dyn Future<Output = Result<Uuid, DriverError>> + Send + '_>> {
        Box::pin(async move { Ok(self.fixed_pool_id) })
    }

    #[instrument]
    fn destroy_worker_group(
        &mut self,
        _worker_key: Key,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>> {
        Box::pin(async move { Ok(()) })
    }

    #[instrument]
    fn list_worker_groups(
        &self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<WorkerMetadata>, DriverError>> + Send + '_>> {
        Box::pin(async move {
            Ok(vec![WorkerMetadata {
                external_id: self.fixed_pool_id.to_string(),
                worker_id: self.fixed_pool_id,
                worker_key: Key::decode("0"),
                metadata: Default::default(),
            }])
        })
    }

    #[instrument]
    fn cleanup_stalled(
        &mut self,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>> {
        Box::pin(async move { Ok(()) })
    }
}
