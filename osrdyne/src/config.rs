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
use tracing::info;
use url::Url;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum WorkerDriverConfig {
    Noop,
    DockerDriver(DockerDriverOptions),
    KubernetesDriver(KubernetesDriverOptions),
    ProcessComposeDriver(PCDriverOptions),
}

#[derive(Deserialize, Serialize)]
pub struct OsrdyneConfig {
    pub amqp_uri: String,
    pub management_uri: String,
    pub pool_id: String,
    pub worker_driver: WorkerDriverConfig,
    pub worker_loop_interval: Duration,
    pub default_message_ttl: Option<usize>,
    pub max_length: Option<usize>,
    pub max_length_bytes: Option<usize>,
    pub api_address: String,
    pub extra_lifetime: Option<Duration>,
    pub opentelemetry: Option<OpentelemetryConfig>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct OpentelemetryConfig {
    pub service_name: Option<String>,
    pub endpoint: Url,
}

impl Default for OpentelemetryConfig {
    fn default() -> Self {
        Self {
            service_name: None,
            endpoint: "http://jaeger:4317".parse().unwrap(),
        }
    }
}

impl std::fmt::Debug for OsrdyneConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let mut url = url::Url::parse(&self.amqp_uri).map_err(|_| std::fmt::Error)?;
        let _ = url.set_password(Some("*****"));
        f.debug_struct("OsrdyneConfig")
            .field("amqp_uri", &format!("{url}"))
            .field("management_port", &self.management_port)
            .field("management_host", &self.management_host)
            .field("pool_id", &self.pool_id)
            .field("worker_driver", &self.worker_driver)
            .field("worker_loop_interval", &self.worker_loop_interval)
            .field("default_message_ttl", &self.default_message_ttl)
            .field("max_length", &self.max_length)
            .field("max_length_bytes", &self.max_length_bytes)
            .field("api_address", &self.api_address)
            .field("extra_lifetime", &self.extra_lifetime)
            .finish()
    }
}

impl Default for OsrdyneConfig {
    fn default() -> Self {
        Self {
            amqp_uri: "amqp://osrd:password@osrd-rabbitmq:5672/%2f".into(),
            management_uri: "http://osrd:password@osrd-rabbitmq:15672".into(),
            pool_id: "core".to_string(),
            worker_driver: WorkerDriverConfig::Noop,
            worker_loop_interval: Duration::from_millis(500),
            default_message_ttl: None,
            max_length: None,
            max_length_bytes: None,
            api_address: "0.0.0.0:4242".into(), // TODO: decide on the port
            extra_lifetime: None,
            opentelemetry: None,
        }
    }
}

pub fn parse_config(file: Option<PathBuf>) -> Result<OsrdyneConfig, figment::Error> {
    let provider = if let Some(file) = file {
        info!(file = %file.display(), "load configuration file");
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
