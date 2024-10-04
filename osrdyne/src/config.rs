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
use url::Url;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum WorkerDriverConfig {
    Noop,
    DockerDriver(DockerDriverOptions),
    KubernetesDriver(KubernetesDriverOptions),
    ProcessComposeDriver(PCDriverOptions),
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub enum TelemetryKind {
    #[default]
    None,
    Datadog,
    Opentelemetry,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct OsrdyneConfig {
    pub amqp_uri: String,
    pub management_port: u16,
    pub management_host: Option<String>,
    pub pool_id: String,
    pub worker_driver: WorkerDriverConfig,
    pub worker_loop_interval: Duration,
    pub default_message_ttl: Option<usize>,
    pub max_length: Option<usize>,
    pub max_length_bytes: Option<usize>,
    pub api_address: String,
    pub extra_lifetime: Option<Duration>,
    pub telemetry_kind: TelemetryKind,
    pub service_name: String,
    pub telemetry_endpoint: Url,
}

impl Default for OsrdyneConfig {
    fn default() -> Self {
        Self {
            amqp_uri: "amqp://osrd:password@osrd-rabbitmq:5672/%2f".into(),
            management_port: 15672,
            management_host: None,
            pool_id: "core".to_string(),
            worker_driver: WorkerDriverConfig::Noop,
            worker_loop_interval: Duration::from_millis(500),
            default_message_ttl: None,
            max_length: None,
            max_length_bytes: None,
            api_address: "0.0.0.0:4242".into(), // TODO: decide on the port
            extra_lifetime: None,
            telemetry_kind: TelemetryKind::default(),
            service_name: "osrd-osrdyne".into(),
            telemetry_endpoint: Url::parse("http://localhost:4317").unwrap(),
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
