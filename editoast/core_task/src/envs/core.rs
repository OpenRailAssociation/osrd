use std::sync::Arc;

/// Innermost simulation environment to configure Core basic parameters
pub struct CoreEnv {
    pub infra_id: u64,
    pub infra_version: i64,
    pub client: Arc<core_client::CoreClient>,
}
