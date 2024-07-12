use std::{collections::HashMap, future::Future, pin::Pin};

use bollard::{
    container::{
        Config, CreateContainerOptions, NetworkingConfig, RemoveContainerOptions,
        StartContainerOptions,
    },
    secret::HostConfig,
    Docker,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::Key;

use super::{
    worker_driver::{DriverError, WorkerDriver, WorkerMetadata},
    LABEL_CORE_ID, LABEL_INFRA_ID, LABEL_MANAGED_BY, MANAGED_BY_VALUE,
};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DockerDriverOptions {
    /// The name of the Docker image to use for the core
    pub core_image: String,
    /// The prefix to use for the container names
    pub container_prefix: String,
    /// The command to run in the container
    pub container_command: Option<Vec<String>>,
    /// The default environment variables to set for the core
    pub default_env: Vec<String>,
    // Should the containers be started in host networking mode
    pub host_networking: Option<bool>,
}

pub struct DockerDriver {
    client: Docker,
    options: DockerDriverOptions,
    amqp_uri: String,
}

impl DockerDriver {
    pub fn new(options: DockerDriverOptions, amqp_uri: String) -> DockerDriver {
        DockerDriver {
            client: Docker::connect_with_socket_defaults().expect("Failed to connect to Docker"),
            options,
            amqp_uri,
        }
    }
}

impl WorkerDriver for DockerDriver {
    fn get_or_create_core_pool(
        &self,
        infra_id: Key,
    ) -> Pin<Box<dyn Future<Output = Result<Uuid, DriverError>> + Send + '_>> {
        Box::pin(async move {
            let current_cores = self.list_core_pools().await?;
            for core in current_cores {
                if core.infra_id == infra_id {
                    return Ok(core.core_id);
                }
            }

            let new_id = Uuid::new_v4();

            let final_env = {
                let mut env = self.options.default_env.clone();
                env.push(format!("WORKER_ID={}", new_id));
                env.push(format!("WORKER_KEY={}", infra_id));
                env.push(format!("WORKER_AMQP_URI={}", self.amqp_uri));
                env
            };

            let labels = {
                let mut labels = std::collections::HashMap::new();
                labels.insert(LABEL_MANAGED_BY.to_owned(), MANAGED_BY_VALUE.to_owned());
                labels.insert(LABEL_CORE_ID.to_owned(), new_id.to_string());
                labels.insert(LABEL_INFRA_ID.to_owned(), infra_id.to_string());
                labels
            };

            let container_name = format!("{}-core-{}", self.options.container_prefix, infra_id);
            log::info!("Creating container {}", container_name);
            let options = CreateContainerOptions {
                name: container_name.clone(),
                platform: None,
            };

            let mut networking_config = Some(NetworkingConfig {
                endpoints_config: HashMap::from([(
                    "osrd_default".to_string(),
                    bollard::models::EndpointSettings {
                        ..Default::default()
                    },
                )]),
            });

            let mut host_config = HostConfig {
                auto_remove: Some(true),
                ..Default::default()
            };

            if self.options.host_networking == Some(true) {
                networking_config = None;
                host_config.network_mode = Some("host".to_string());
            }

            let config = Config {
                image: Some(self.options.core_image.clone()),
                env: Some(final_env),
                labels: Some(labels),
                cmd: self.options.container_command.clone(),
                networking_config,
                host_config: Some(host_config),
                ..Default::default()
            };

            self.client
                .create_container(Some(options), config)
                .await
                .map_err(DriverError::DockerError)?;

            self.client
                .start_container(
                    container_name.as_str(),
                    None::<StartContainerOptions<String>>,
                )
                .await
                .map_err(DriverError::DockerError)?;

            Ok(new_id)
        })
    }

    fn destroy_core_pool(
        &self,
        infra_id: Key,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>> {
        Box::pin(async move {
            let current_cores = self.list_core_pools().await?;
            for core in current_cores {
                if core.infra_id == infra_id {
                    log::info!("Removing container {}", core.external_id);
                    self.client
                        .remove_container(
                            &core.external_id,
                            Some(RemoveContainerOptions {
                                force: true,
                                ..Default::default()
                            }),
                        )
                        .await
                        .map_err(DriverError::DockerError)?;
                }
            }

            Ok(())
        })
    }

    fn list_core_pools(
        &self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<WorkerMetadata>, DriverError>> + Send + '_>> {
        Box::pin(async move {
            let containers = self
                .client
                .list_containers::<String>(None)
                .await
                .map_err(DriverError::DockerError)?;

            let cores = containers
                .iter()
                .filter_map(|container| {
                    container.labels.as_ref().and_then(|labels| {
                        if labels.get(LABEL_MANAGED_BY) == Some(&MANAGED_BY_VALUE.to_string()) {
                            Some(WorkerMetadata {
                                external_id: container.id.clone().expect("container id missing"),
                                core_id: Uuid::parse_str(
                                    labels.get(LABEL_CORE_ID).expect("core_id label missing"),
                                )
                                .expect("core_id label is not a valid UUID"),
                                infra_id: Key::decode(
                                    labels.get(LABEL_INFRA_ID).expect("infra_id label missing"),
                                ),
                            })
                        } else {
                            None
                        }
                    })
                })
                .collect();

            Ok(cores)
        })
    }
}
