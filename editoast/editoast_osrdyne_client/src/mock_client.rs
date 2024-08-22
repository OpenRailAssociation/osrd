use std::collections::HashMap;

use crate::OsrdyneClient;
use crate::OsrdyneClientInternal;
use crate::WorkerStatus;

#[derive(Default)]
pub(crate) struct MockClient {
    statuses: HashMap<String, WorkerStatus>,
}

impl MockClient {
    pub async fn get_workers_statuses<'a, T>(
        &self,
        keys: &[T],
    ) -> Result<HashMap<String, WorkerStatus>, crate::Error>
    where
        T: AsRef<str>,
    {
        Ok(keys
            .iter()
            .map(|key| {
                let status = self
                    .statuses
                    .get(key.as_ref())
                    .copied()
                    .unwrap_or(WorkerStatus::Ready);
                (key.as_ref().to_owned(), status)
            })
            .collect::<HashMap<String, WorkerStatus>>())
    }
}

#[derive(Default)]
pub struct MockClientBuilder {
    statuses: HashMap<String, WorkerStatus>,
}

impl MockClientBuilder {
    pub fn with_status(mut self, worker_key: &str, status: WorkerStatus) -> Self {
        self.statuses.insert(worker_key.to_owned(), status);
        self
    }

    pub fn build(self) -> OsrdyneClient {
        OsrdyneClient {
            inner: OsrdyneClientInternal::MockClient(MockClient {
                statuses: self.statuses,
            }),
        }
    }
}
