use crate::drivers::{
    docker::DockerDriverOptions, kubernetes::KubernetesDriverOptions, mq::RabbitMQDriverOptions,
};
use figment::{
    providers::{Env, Format, Serialized, Yaml},
    Figment,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum Provider {
    Docker(DockerDriverOptions),
    Kubernetes(KubernetesDriverOptions),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RedisOptions {
    pub url: String,
    pub core_last_seen_prefix: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Config {
    pub loop_interval: u64,
    pub core_timeout: i64,
    pub api_listen_addr: String,
    pub provider: Provider,
    pub rabbitmq: RabbitMQDriverOptions,
    pub redis: RedisOptions,
}

impl Default for Config {
    fn default() -> Config {
        // if env DEFAULT_CC_*_HOST are not set, use rabbitmq (container name) otherwise use the env value
        // Used for local development, making easier to seperate host mode to docker network mode
        let default_rmq_host =
            std::env::var("DEFAULT_CC_RMQ_HOST").unwrap_or("rabbitmq".to_string());
        let default_redis_host: String =
            std::env::var("DEFAULT_CC_REDIS_HOST").unwrap_or("redis".to_string());

        Config {
            loop_interval: 3,
            core_timeout: 900,
            api_listen_addr: "0.0.0.0:6000".to_string(),
            redis: RedisOptions {
                url: format!("redis://{}:6379/0", default_redis_host),
                core_last_seen_prefix: "core/last_seen_msg".to_string(),
            },
            provider: Provider::Docker(DockerDriverOptions {
                core_image_name: "ghcr.io/openrail/openrailassociation/osrd-edge/osrd-core"
                    .to_string(),
                core_image_tag: "dev".to_string(),
                container_prefix: "dyn-osrd".to_string(),
                default_env: vec![],
            }),
            rabbitmq: RabbitMQDriverOptions {
                api_url: format!("http://osrd:password@{}:15672/api", default_rmq_host),
                vhost: "%2F".to_string(), // URL-encoded "/"
                exchange: "amq.direct".to_string(),
                queue_prefix: "core".to_string(),
            },
        }
    }
}

pub fn load() -> Result<Config, figment::Error> {
    Figment::from(Serialized::defaults(Config::default()))
        .merge(Yaml::file("core_controller.toml"))
        .merge(Env::prefixed("CC_"))
        .extract()
}
