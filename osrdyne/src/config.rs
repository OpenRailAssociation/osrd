use std::{path::PathBuf, time::Duration};

use crate::drivers::{
    docker::DockerDriverOptions, kubernetes::KubernetesDriverOptions,
    process_compose::PCDriverOptions,
};
use serde::{Deserialize, Serialize};

use figment::{
    providers::{Env, Format, Serialized, Yaml},
    Figment,
};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum WorkerDriverConfig {
    Noop,
    DockerDriver(DockerDriverOptions),
    KubernetesDriver(KubernetesDriverOptions),
    ProcessComposeDriver(PCDriverOptions),
}

#[derive(Debug, Deserialize, Serialize)]
pub struct OsrdyneConfig {
    pub amqp_uri: String,
    pub max_msg_size: i64,
    pub management_uri: String,
    pub pool_id: String,
    pub worker_driver: WorkerDriverConfig,
    pub worker_loop_interval: Duration,
    pub default_message_ttl: Option<usize>,
    pub max_length: Option<usize>,
    pub max_length_bytes: Option<usize>,
    pub api_address: String,
    pub extra_lifetime: Option<Duration>,
}

impl Default for OsrdyneConfig {
    fn default() -> Self {
        Self {
            amqp_uri: "amqp://osrd:password@osrd-rabbitmq:5672/%2f".into(),
            max_msg_size: 1024 * 1024 * 128 * 5,
            management_uri: "http://osrd:password@osrd-rabbitmq:15672".into(),
            pool_id: "core".to_string(),
            worker_driver: WorkerDriverConfig::Noop,
            worker_loop_interval: Duration::from_millis(500),
            default_message_ttl: None,
            max_length: None,
            max_length_bytes: None,
            api_address: "0.0.0.0:4242".into(), // TODO: decide on the port
            extra_lifetime: None,
        }
    }
}

pub fn parse_config(file: Option<PathBuf>) -> Result<OsrdyneConfig, figment::Error> {
    let provider = if let Some(file) = file {
        log::info!("Using configuration file: {}", file.display());
        Yaml::file_exact(file)
    } else {
        Yaml::file("osrdyne.yml")
    };
    Figment::from(Serialized::defaults(OsrdyneConfig::default()))
        .merge(provider)
        // We use `__` as a separator for nested keys
        .merge(Env::prefixed("OSRDYNE__").split("__"))
        .extract()
}
