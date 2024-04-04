use std::{future::Future, pin::Pin};

use bollard::{
    container::{Config, CreateContainerOptions, RemoveContainerOptions, StartContainerOptions},
    Docker,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{
    core_driver::{CoreDriver, CoreMetadata, DriverError},
    LABEL_CORE_ID, LABEL_INFRA_ID, LABEL_MANAGED_BY, MANAGED_BY_VALUE,
};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DockerDriverOptions {
    /// The name of the Docker image to use for the core
    pub core_image_name: String,
    /// The tag of the Docker image to use for the core
    pub core_image_tag: String,
    /// The prefix to use for the container names
    pub container_prefix: String,
    /// The default environment variables to set for the core
    pub default_env: Vec<String>,
}

pub struct DockerDriver {
    client: Docker,
    options: DockerDriverOptions,
}

impl DockerDriver {
    pub fn new(options: DockerDriverOptions) -> DockerDriver {
        DockerDriver {
            client: Docker::connect_with_socket_defaults().expect("Failed to connect to Docker"),
            options,
        }
    }
}

impl CoreDriver for DockerDriver {
    fn get_or_create_core_pool(
        &self,
        infra_id: usize,
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
                env.push(format!("CORE_ID={}", new_id));
                env.push(format!("INFRA_ID={}", infra_id));
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

            let options = CreateContainerOptions {
                name: container_name.clone(),
                platform: None,
            };
            let config = Config {
                image: Some(format!(
                    "{}:{}",
                    self.options.core_image_name, self.options.core_image_tag
                )),
                env: Some(final_env),
                labels: Some(labels),
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
        infra_id: usize,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>> {
        Box::pin(async move {
            let current_cores = self.list_core_pools().await?;
            for core in current_cores {
                if core.infra_id == infra_id {
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
    ) -> Pin<Box<dyn Future<Output = Result<Vec<CoreMetadata>, DriverError>> + Send + '_>> {
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
                            Some(CoreMetadata {
                                external_id: container.id.clone().expect("container id missing"),
                                core_id: Uuid::parse_str(
                                    labels.get(LABEL_CORE_ID).expect("core_id label missing"),
                                )
                                .expect("core_id label is not a valid UUID"),
                                infra_id: labels
                                    .get(LABEL_INFRA_ID)
                                    .expect("infra_id label missing")
                                    .parse()
                                    .expect("infra_id label is not a valid number"),
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
