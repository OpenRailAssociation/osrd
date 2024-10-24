use crate::{
    drivers::{LABEL_QUEUE_NAME, LABEL_VERSION_IDENTIFIER},
    Key,
};

use super::{
    worker_driver::{DriverError, WorkerDriver, WorkerMetadata},
    LABEL_MANAGED_BY, LABEL_WORKER_ID, LABEL_WORKER_KEY, MANAGED_BY_VALUE,
};
use k8s_openapi::{
    api::{
        apps::v1::{Deployment, DeploymentSpec},
        autoscaling::v1::HorizontalPodAutoscaler,
        core::v1::{
            Affinity, Container, EnvVar, LocalObjectReference, PodSpec, PodTemplateSpec,
            ResourceRequirements, Toleration,
        },
    },
    apimachinery::pkg::apis::meta::v1::LabelSelector,
};
use keda::{MetricType, ScaledObject};
use kube::{api::ObjectMeta, Client};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashMap},
    fmt::Debug,
    future::Future,
    pin::Pin,
};
use tracing::{debug, info, instrument};
use uuid::Uuid;

mod keda;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HPAOptions {
    /// The minimum number of replicas
    pub min_replicas: i32,

    /// The maximum number of replicas
    pub max_replicas: i32,

    /// The target CPU utilization percentage
    pub target_cpu_utilization_percentage: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct KedaOptions {
    /// Polling Interval in seconds
    pub polling_interval: i32,

    /// Cooldown Period in seconds
    pub cooldown_period: i32,

    /// Min Replicas for the HPA of the ScaledObject
    pub min_replicas: i32,

    /// Max Replicas for the HPA of the ScaledObject
    pub max_replicas: i32,

    /// Amqp Host
    pub amqp_host: String,

    /// Mode
    pub mode: String,

    /// Value
    pub value: String,

    /// Activation Value
    pub activation_value: String,

    /// Use cached metrics
    pub use_cached_metrics: bool,

    /// Metric Type
    pub metric_type: MetricType,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum AutoscalingOptions {
    Hpa(HPAOptions),
    Keda(KedaOptions),
    NoScaling,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct KubernetesDeploymentOptions {
    /// The default environment variables to set for the worker (passthrough to kubernetes deployment)
    pub default_env: Option<Vec<EnvVar>>,

    /// The resources to allocate to the worker (passthrough to kubernetes deployment)
    pub resources: Option<ResourceRequirements>,

    /// The node selector to use for the worker (passthrough to kubernetes deployment)
    pub node_selector: Option<BTreeMap<String, String>>,

    /// The affinity to use for the worker (passthrough to kubernetes deployment)
    pub affinity: Option<Affinity>,

    /// The tolerations to use for the worker (passthrough to kubernetes deployment)
    pub tolerations: Option<Vec<Toleration>>,

    /// The labels to add to the worker (passthrough to kubernetes deployment)
    pub labels: Option<BTreeMap<String, String>>,

    /// The annotations to add to the worker (passthrough to kubernetes deployment)
    pub annotations: Option<BTreeMap<String, String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct KubernetesDriverOptions {
    /// The name of the Docker image to use for the worker
    pub container_image: String,

    /// The image pull secrets to use for the worker
    pub image_pull_secrets: Option<Vec<LocalObjectReference>>,

    /// Docker start command
    pub start_command: Vec<String>,

    /// The prefix to use for the deployment names
    pub deployment_prefix: String,

    /// The namespace to use for the deployments
    pub namespace: String,

    /// The autoscaling options to use for the worker
    pub autoscaling: Option<AutoscalingOptions>,

    /// The options to use for the kubernetes deployment
    pub kube_deployment_options: KubernetesDeploymentOptions,
}

pub struct KubernetesDriver {
    client: Client,
    pool_id: String,
    options: KubernetesDriverOptions,
    amqp_uri: String,
    max_message_size: i64,
    version_identifier: String,
}

impl Debug for KubernetesDriver {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("KubernetesDriver")
            .field("pool_id", &self.pool_id)
            .field("options", &self.options)
            .field("amqp_uri", &self.amqp_uri)
            .field("version_identifier", &self.version_identifier)
            .finish()
    }
}

impl KubernetesDriver {
    pub async fn new(
        options: KubernetesDriverOptions,
        amqp_uri: String,
        max_message_size: i64,
        pool_id: String,
    ) -> KubernetesDriver {
        let version_identifier = std::env::var("OSRD_GIT_DESCRIBE")
            .unwrap_or_else(|_| format!("run-{}", Uuid::new_v4()));

        let hashed = format!("{:x}", Sha256::digest(version_identifier))[..16].to_string();

        KubernetesDriver {
            client: Client::try_default()
                .await
                .expect("Failed to connect to Kubernetes"),
            options,
            amqp_uri,
            max_message_size,
            pool_id,
            version_identifier: hashed,
        }
    }

    #[instrument]
    async fn create_hpa_autoscaler(
        &self,
        worker_id: String,
        worker_key: Key,
        hpa: HPAOptions,
        queue_name: String,
        worker_deployment_name: String,
        current_hpa_version: Option<String>,
    ) -> Result<(), super::worker_driver::DriverError> {
        let mut hpa = HorizontalPodAutoscaler {
            metadata: ObjectMeta {
                name: Some(worker_deployment_name.clone()),
                namespace: Some(self.options.namespace.clone()),
                labels: Some({
                    let mut labels = BTreeMap::new();
                    labels.insert(LABEL_MANAGED_BY.to_owned(), MANAGED_BY_VALUE.to_owned());
                    labels.insert(LABEL_WORKER_ID.to_owned(), worker_id);
                    labels.insert(LABEL_WORKER_KEY.to_owned(), worker_key.to_string());
                    labels.insert(LABEL_QUEUE_NAME.to_owned(), queue_name.clone());
                    labels.insert(
                        LABEL_VERSION_IDENTIFIER.to_owned(),
                        self.version_identifier.clone(),
                    );
                    labels
                }),
                ..Default::default()
            },
            spec: Some({
                k8s_openapi::api::autoscaling::v1::HorizontalPodAutoscalerSpec {
                    scale_target_ref:
                        k8s_openapi::api::autoscaling::v1::CrossVersionObjectReference {
                            api_version: Some("apps/v1".to_string()),
                            kind: "Deployment".to_string(),
                            name: worker_deployment_name.clone(),
                        },
                    min_replicas: Some(hpa.min_replicas),
                    max_replicas: hpa.max_replicas,
                    target_cpu_utilization_percentage: Some(hpa.target_cpu_utilization_percentage),
                }
            }),
            ..Default::default()
        };

        if let Some(version) = current_hpa_version {
            debug!(?hpa, "Updating HPA");

            hpa.metadata.resource_version = Some(version);

            kube::api::Api::<HorizontalPodAutoscaler>::namespaced(
                self.client.clone(),
                &self.options.namespace,
            )
            .replace(
                &worker_deployment_name,
                &kube::api::PostParams::default(),
                &hpa,
            )
            .await
            .map_err(super::worker_driver::DriverError::KubernetesError)?;
        } else {
            debug!(?hpa, "Creating HPA");

            kube::api::Api::<HorizontalPodAutoscaler>::namespaced(
                self.client.clone(),
                &self.options.namespace,
            )
            .create(&kube::api::PostParams::default(), &hpa)
            .await
            .map_err(super::worker_driver::DriverError::KubernetesError)?;
        }

        Ok(())
    }

    #[instrument]
    async fn create_keda_autoscaler(
        &self,
        worker_id: String,
        worker_key: Key,
        keda: KedaOptions,
        queue_name: String,
        worker_deployment_name: String,
        current_scaled_object_version: Option<String>,
    ) -> Result<(), super::worker_driver::DriverError> {
        let mut scaled_object = keda::ScaledObject {
            metadata: ObjectMeta {
                name: Some(worker_deployment_name.clone()),
                namespace: Some(self.options.namespace.clone()),
                labels: Some({
                    let mut labels = BTreeMap::new();
                    labels.insert(LABEL_MANAGED_BY.to_owned(), MANAGED_BY_VALUE.to_owned());
                    labels.insert(LABEL_WORKER_ID.to_owned(), worker_id);
                    labels.insert(LABEL_WORKER_KEY.to_owned(), worker_key.to_string());
                    labels.insert(LABEL_QUEUE_NAME.to_owned(), queue_name.clone());
                    labels.insert(
                        LABEL_VERSION_IDENTIFIER.to_owned(),
                        self.version_identifier.clone(),
                    );
                    labels
                }),
                ..Default::default()
            },
            spec: keda::ScaledObjectSpec {
                scale_target_ref: keda::ScaleTargetRef {
                    api_version: "apps/v1".to_string(),
                    kind: "Deployment".to_string(),
                    name: worker_deployment_name.clone(),
                    env_source_container_name: None,
                },
                polling_interval: Some(keda.polling_interval),
                cooldown_period: Some(keda.cooldown_period),
                initial_cooldown_period: None,
                idle_replica_count: None,
                min_replica_count: Some(keda.min_replicas),
                max_replica_count: Some(keda.max_replicas),
                triggers: vec![keda::Trigger {
                    type_: "rabbitmq".to_string(),
                    use_cached_metrics: Some(keda.use_cached_metrics),
                    metric_type: keda.metric_type.clone(),
                    metadata: {
                        let mut metadata = HashMap::new();
                        metadata.insert("host".to_string(), keda.amqp_host.clone());
                        metadata.insert("protocol".to_string(), "auto".to_string());
                        metadata.insert("mode".to_string(), keda.mode.clone());
                        metadata.insert("value".to_string(), keda.value.clone());
                        metadata
                            .insert("activationValue".to_string(), keda.activation_value.clone());
                        metadata.insert("queueName".to_string(), queue_name);
                        metadata
                    },
                }],
            },
        };

        if let Some(version) = current_scaled_object_version {
            debug!(?scaled_object.metadata.name, "Updating Keda ScaledObject");

            scaled_object.metadata.resource_version = Some(version);

            kube::api::Api::<ScaledObject>::namespaced(
                self.client.clone(),
                &self.options.namespace,
            )
            .replace(
                &worker_deployment_name,
                &kube::api::PostParams::default(),
                &scaled_object,
            )
            .await
            .map_err(super::worker_driver::DriverError::KubernetesError)?;
        } else {
            debug!(?scaled_object.metadata.name, "Creating Keda ScaledObject");

            kube::api::Api::<ScaledObject>::namespaced(
                self.client.clone(),
                &self.options.namespace,
            )
            .create(&kube::api::PostParams::default(), &scaled_object)
            .await
            .map_err(super::worker_driver::DriverError::KubernetesError)?;
        }

        Ok(())
    }
}

impl WorkerDriver for KubernetesDriver {
    #[instrument]
    fn get_or_create_worker_group(
        &mut self,
        queue_name: String,
        worker_key: Key,
    ) -> Pin<Box<dyn Future<Output = Result<Uuid, DriverError>> + Send + '_>> {
        Box::pin(async move {
            let mut current_worker_id = None;
            let mut last_known_version = None;

            let current_workers = self.list_worker_groups().await?;

            for worker in current_workers {
                let worker_version = worker
                    .metadata
                    .get(LABEL_VERSION_IDENTIFIER)
                    .expect("version_identifier not found")
                    .to_owned();

                if worker.worker_key == worker_key && worker_version == self.version_identifier {
                    // It's an update, and we found a worker with the same key and version
                    // so we should not update it
                    return Ok(worker.worker_id);
                } else if worker.worker_key == worker_key {
                    // It's an update, and we found a worker with the same key but different version
                    // so we should update it
                    info!(?worker.worker_key, "Updating worker with key");
                    current_worker_id = Some(worker.worker_id);
                    last_known_version = worker
                        .metadata
                        .get("LAST_KNOWN_VERSION")
                        .map(|v| v.to_owned());
                }
            }

            let is_update = current_worker_id.is_some();
            let new_id = current_worker_id.unwrap_or_else(Uuid::new_v4);
            let worker_deployment_name = format!(
                "{}-{}-{}",
                self.options.deployment_prefix, self.pool_id, worker_key
            );

            let final_env = {
                let mut env = self
                    .options
                    .kube_deployment_options
                    .default_env
                    .clone()
                    .unwrap_or_default();

                env.push(EnvVar {
                    name: "WORKER_ID".to_string(),
                    value: Some(new_id.to_string()),
                    ..Default::default()
                });
                env.push(EnvVar {
                    name: "WORKER_KEY".to_string(),
                    value: Some(worker_key.to_string()),
                    ..Default::default()
                });
                env.push(EnvVar {
                    name: "WORKER_AMQP_URI".to_string(),
                    value: Some(self.amqp_uri.clone()),
                    ..Default::default()
                });
                env.push(EnvVar {
                    name: "WORKER_MAX_MSG_SIZE".to_string(),
                    value: Some(self.max_message_size.to_string()),
                    ..Default::default()
                });
                env.push(EnvVar {
                    name: "WORKEY_ID_USE_HOSTNAME".to_string(),
                    value: Some("1".to_string()),
                    ..Default::default()
                });
                env
            };

            let match_labels = {
                let mut labels = BTreeMap::new();
                labels.insert(LABEL_MANAGED_BY.to_owned(), MANAGED_BY_VALUE.to_owned());
                labels.insert(LABEL_WORKER_ID.to_owned(), new_id.to_string());
                labels.insert(LABEL_WORKER_KEY.to_owned(), worker_key.to_string());
                labels
            };

            let labels = {
                let mut labels = match_labels.clone();
                labels.insert(
                    LABEL_VERSION_IDENTIFIER.to_owned(),
                    self.version_identifier.clone(),
                );
                labels.insert(LABEL_QUEUE_NAME.to_owned(), queue_name.clone());
                labels
            };

            // Create a new deployment
            let mut deployment = Deployment {
                metadata: ObjectMeta {
                    name: Some(worker_deployment_name.clone()),
                    namespace: Some(self.options.namespace.clone()),
                    labels: Some(labels.clone()),
                    ..Default::default()
                },
                spec: Some(DeploymentSpec {
                    selector: LabelSelector {
                        match_labels: Some(match_labels.clone()),
                        ..Default::default()
                    },
                    replicas: Some(1),
                    template: PodTemplateSpec {
                        metadata: Some(ObjectMeta {
                            labels: {
                                let mut labels = labels.clone();
                                if let Some(deployment_labels) =
                                    &self.options.kube_deployment_options.labels
                                {
                                    labels.extend(deployment_labels.clone());
                                }
                                Some(labels)
                            },
                            annotations: self.options.kube_deployment_options.annotations.clone(),
                            ..Default::default()
                        }),
                        spec: Some(PodSpec {
                            image_pull_secrets: self.options.image_pull_secrets.clone(),
                            containers: vec![Container {
                                name: worker_deployment_name.clone(),
                                image: Some(self.options.container_image.clone()),
                                env: Some(final_env),
                                command: Some(self.options.start_command.clone()),
                                resources: self.options.kube_deployment_options.resources.clone(),
                                image_pull_policy: Some("Always".to_string()),
                                ..Default::default()
                            }],
                            node_selector: self
                                .options
                                .kube_deployment_options
                                .node_selector
                                .clone(),
                            affinity: self.options.kube_deployment_options.affinity.clone(),
                            tolerations: self.options.kube_deployment_options.tolerations.clone(),
                            ..Default::default()
                        }),
                    },
                    ..Default::default()
                }),
                ..Default::default()
            };

            debug!(?deployment, "Creating deployment");

            // Create the deployment
            if is_update {
                deployment.metadata.resource_version = last_known_version;

                kube::api::Api::<Deployment>::namespaced(
                    self.client.clone(),
                    &self.options.namespace,
                )
                .replace(
                    &worker_deployment_name,
                    &kube::api::PostParams::default(),
                    &deployment,
                )
                .await
                .map_err(super::worker_driver::DriverError::KubernetesError)?;
            } else {
                kube::api::Api::<Deployment>::namespaced(
                    self.client.clone(),
                    &self.options.namespace,
                )
                .create(&kube::api::PostParams::default(), &deployment)
                .await
                .map_err(super::worker_driver::DriverError::KubernetesError)?;
            }

            // Create the autoscaler if needed
            match &self.options.autoscaling {
                // Using HorizontalPodAutoscaler
                Some(AutoscalingOptions::Hpa(hpa)) => {
                    let mut current_hpa_version = None;

                    if is_update {
                        let current_hpa = kube::api::Api::<HorizontalPodAutoscaler>::namespaced(
                            self.client.clone(),
                            &self.options.namespace,
                        )
                        .get(&worker_deployment_name)
                        .await
                        .ok();

                        if let Some(current_hpa) = current_hpa {
                            current_hpa_version = current_hpa
                                .metadata
                                .resource_version
                                .as_ref()
                                .map(|v| v.to_owned());
                        }
                    }

                    self.create_hpa_autoscaler(
                        new_id.to_string(),
                        worker_key,
                        hpa.clone(),
                        queue_name,
                        worker_deployment_name,
                        current_hpa_version,
                    )
                    .await?;
                }

                // Using Keda as the autoscaler
                Some(AutoscalingOptions::Keda(keda)) => {
                    let mut current_scaled_object_version = None;

                    if is_update {
                        let current_scaled_object = kube::api::Api::<ScaledObject>::namespaced(
                            self.client.clone(),
                            &self.options.namespace,
                        )
                        .get(&worker_deployment_name)
                        .await
                        .ok();

                        if let Some(current_scaled_object) = current_scaled_object {
                            current_scaled_object_version = current_scaled_object
                                .metadata
                                .resource_version
                                .as_ref()
                                .map(|v| v.to_owned());
                        }
                    }

                    self.create_keda_autoscaler(
                        new_id.to_string(),
                        worker_key,
                        keda.clone(),
                        queue_name,
                        worker_deployment_name,
                        current_scaled_object_version,
                    )
                    .await?;
                }

                // No autoscaler configured
                Some(AutoscalingOptions::NoScaling) | None => {}
            }

            Ok(new_id)
        })
    }

    #[instrument]
    fn destroy_worker_group(
        &mut self,
        worker_key: Key,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>> {
        Box::pin(async move {
            let current_workers = self.list_worker_groups().await?;

            for worker in current_workers {
                if worker.worker_key == worker_key {
                    let worker_deployment_name = format!(
                        "{}-{}-{}",
                        self.options.deployment_prefix, self.pool_id, worker.worker_key
                    );

                    // Delete the deployment
                    kube::api::Api::<Deployment>::namespaced(
                        self.client.clone(),
                        &self.options.namespace,
                    )
                    .delete(&worker_deployment_name, &kube::api::DeleteParams::default())
                    .await
                    .map_err(super::worker_driver::DriverError::KubernetesError)?;

                    // Delete the autoscaler
                    if self.options.autoscaling.is_some() {
                        kube::api::Api::<HorizontalPodAutoscaler>::namespaced(
                            self.client.clone(),
                            &self.options.namespace,
                        )
                        .delete(&worker_deployment_name, &kube::api::DeleteParams::default())
                        .await
                        .map_err(super::worker_driver::DriverError::KubernetesError)?;
                    }

                    return Ok(());
                }
            }

            Ok(())
        })
    }

    #[instrument]
    fn list_worker_groups(
        &self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<WorkerMetadata>, DriverError>> + Send + '_>> {
        Box::pin(async move {
            let deployments = kube::api::Api::<Deployment>::namespaced(
                self.client.clone(),
                &self.options.namespace,
            )
            .list(&kube::api::ListParams::default())
            .await
            .map_err(super::worker_driver::DriverError::KubernetesError)?;

            let workers = deployments
                .iter()
                .filter_map(|deployment| {
                    deployment.metadata.labels.as_ref().and_then(|labels| {
                        if labels.get(LABEL_MANAGED_BY) == Some(&MANAGED_BY_VALUE.to_owned()) {
                            let worker_id =
                                labels.get(LABEL_WORKER_ID).expect("worker_id not found");
                            let worker_key =
                                labels.get(LABEL_WORKER_KEY).expect("worker_key not found");

                            let mut metadata = HashMap::new();
                            metadata.insert(
                                LABEL_VERSION_IDENTIFIER.to_owned(),
                                labels
                                    .get(LABEL_VERSION_IDENTIFIER)
                                    .expect("version_identifier not found")
                                    .clone(),
                            );
                            metadata.insert(
                                LABEL_QUEUE_NAME.to_owned(),
                                labels
                                    .get(LABEL_QUEUE_NAME)
                                    .expect("queue_name not found")
                                    .clone(),
                            );
                            metadata.insert(
                                "LAST_KNOWN_VERSION".to_owned(),
                                deployment
                                    .metadata
                                    .resource_version
                                    .as_ref()
                                    .expect("resource_version should be present on existing object")
                                    .to_owned(),
                            );

                            Some(super::worker_driver::WorkerMetadata {
                                external_id: deployment.metadata.name.clone()?,
                                worker_id: Uuid::parse_str(worker_id)
                                    .expect("worker_id not a valid UUID"),
                                worker_key: Key::decode(worker_key),
                                metadata,
                            })
                        } else {
                            None
                        }
                    })
                })
                .collect();

            Ok(workers)
        })
    }

    #[instrument]
    fn cleanup_stalled(
        &mut self,
    ) -> Pin<Box<dyn Future<Output = Result<(), DriverError>> + Send + '_>> {
        Box::pin(async move {
            // List all worker groups
            let current_workers = self.list_worker_groups().await?;

            // If we have autoscaling enabled, we need to check if the autoscalers have deployments.
            // If there is no deployment, we should clean up the autoscaler.
            match self.options.autoscaling {
                Some(AutoscalingOptions::Hpa(_)) => {
                    // list hpas, check if the deployment is in current_workers and if not, delete the hpa
                    let hpas = kube::api::Api::<HorizontalPodAutoscaler>::namespaced(
                        self.client.clone(),
                        &self.options.namespace,
                    )
                    .list(&kube::api::ListParams::default())
                    .await
                    .map_err(DriverError::KubernetesError)?;

                    for hpa in hpas.iter() {
                        // Check if managed by osrdyne otherwise ignore
                        if hpa
                            .metadata
                            .labels
                            .as_ref()
                            .and_then(|labels| labels.get(LABEL_MANAGED_BY))
                            != Some(&MANAGED_BY_VALUE.to_owned())
                        {
                            continue;
                        }

                        let worker_key = hpa
                            .metadata
                            .labels
                            .as_ref()
                            .and_then(|labels| labels.get(LABEL_WORKER_KEY))
                            .expect("worker_key not found");

                        let worker_deployment_name =
                            hpa.metadata.name.clone().expect("name not found");

                        if !current_workers
                            .iter()
                            .any(|worker| worker.worker_key == Key::decode(worker_key))
                        {
                            info!(%worker_deployment_name, "Deleting HPA as the worker is not found");

                            kube::api::Api::<HorizontalPodAutoscaler>::namespaced(
                                self.client.clone(),
                                &self.options.namespace,
                            )
                            .delete(&worker_deployment_name, &kube::api::DeleteParams::default())
                            .await
                            .map_err(DriverError::KubernetesError)?;
                        }
                    }
                }

                Some(AutoscalingOptions::Keda(_)) => {
                    // list scaled objects, check if the deployment is in current_workers and if not, delete the scaled object
                    let scaled_objects = kube::api::Api::<keda::ScaledObject>::namespaced(
                        self.client.clone(),
                        &self.options.namespace,
                    )
                    .list(&kube::api::ListParams::default())
                    .await
                    .map_err(DriverError::KubernetesError)?;

                    for scaled_object in scaled_objects.iter() {
                        // Check if managed by osrdyne otherwise ignore
                        if scaled_object.metadata.labels.as_ref().and_then(
                            |labels: &BTreeMap<String, String>| labels.get(LABEL_MANAGED_BY),
                        ) != Some(&MANAGED_BY_VALUE.to_owned())
                        {
                            continue;
                        }

                        let worker_key = scaled_object
                            .metadata
                            .labels
                            .as_ref()
                            .and_then(|labels| labels.get(LABEL_WORKER_KEY))
                            .expect("worker_key not found");

                        let worker_deployment_name = scaled_object.metadata.name.clone().unwrap();

                        if !current_workers
                            .iter()
                            .any(|worker| worker.worker_key == Key::decode(worker_key))
                        {
                            info!(%worker_deployment_name, "Deleting Keda ScaledObject as the worker is not found");

                            kube::api::Api::<keda::ScaledObject>::namespaced(
                                self.client.clone(),
                                &self.options.namespace,
                            )
                            .delete(&worker_deployment_name, &kube::api::DeleteParams::default())
                            .await
                            .map_err(DriverError::KubernetesError)?;
                        }
                    }
                }

                _ => {}
            }

            Ok(())
        })
    }
}
