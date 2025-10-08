use std::sync::Arc;

/// Innermost environment to configure Core basic parameters
pub struct CoreEnv {
    pub infra_id: u64,
    pub infra_version: i64,
    pub client: Arc<core_client::CoreClient>,
}

#[cfg(test)]
impl CoreEnv {
    pub(crate) fn new_mock(mock: core_client::mocking::MockingClient) -> Self {
        Self {
            infra_id: 1,
            infra_version: 1,
            client: Arc::new(mock.into()),
        }
    }
}
