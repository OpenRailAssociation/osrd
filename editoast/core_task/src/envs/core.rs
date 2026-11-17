use core_client::CoreClient;

/// Innermost environment to configure Core basic parameters
#[derive(Debug, Clone)]
pub struct CoreEnv {
    pub infra_id: u64,
    pub infra_version: i64,
    pub client: CoreClient,
}

#[cfg(test)]
impl CoreEnv {
    pub(crate) fn new_mock(mock: core_client::mocking::MockingClient) -> Self {
        use std::collections::HashSet;
        use std::sync::Arc;

        Self {
            infra_id: 1,
            infra_version: 1,
            client: CoreClient {
                shared: Arc::new(mock.into()),
                feature_flags: HashSet::default(),
            },
        }
    }
}
