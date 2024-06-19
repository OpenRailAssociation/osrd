use std::time::Duration;

use crate::drivers::{docker::DockerDriverOptions, kubernetes::KubernetesDriverOptions};
use serde::{Deserialize, Serialize};

use figment::{
    providers::{Env, Format, Serialized, Toml},
    Figment,
};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum WorkerDriverConfig {
    Noop,
    DockerDriver(DockerDriverOptions),
    KubernetesDriver(KubernetesDriverOptions),
}

#[derive(Deserialize, Serialize)]
pub struct OsrdyneConfig {
    pub amqp_uri: String,
    pub management_port: u16,
    pub management_host: Option<String>,
    pub pool_id: String,
    pub max_workers: Option<usize>,
    pub worker_driver: WorkerDriverConfig,
    pub worker_loop_interval: Duration,
    pub default_message_ttl: Option<usize>,
    pub max_length: Option<usize>,
    pub max_length_bytes: Option<usize>,
}

impl Default for OsrdyneConfig {
    fn default() -> Self {
        Self {
            amqp_uri: "amqp://127.0.0.1:5672/%2f".into(),
            management_port: 15672,
            management_host: None,
            pool_id: "default".to_string(),
            max_workers: None,
            worker_driver: WorkerDriverConfig::Noop,
            worker_loop_interval: Duration::from_millis(500),
            default_message_ttl: None,
            max_length: None,
            max_length_bytes: None,
        }
    }
}

pub fn parse_config() -> Result<OsrdyneConfig, figment::Error> {
    Figment::from(Serialized::defaults(OsrdyneConfig::default()))
        .merge(Toml::file("osrdyne.toml"))
        // We use `__` as a separator for nested keys
        .merge(Env::prefixed("OSRDYNE__").split("__"))
        .extract()
}
