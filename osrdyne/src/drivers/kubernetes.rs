use crate::Key;

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
use keda::MetricType;
use kube::{api::ObjectMeta, Client};
use log::debug;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap},
    future::Future,
    pin::Pin,
};
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
}

impl KubernetesDriver {
    pub async fn new(
        options: KubernetesDriverOptions,
        amqp_uri: String,
        pool_id: String,
    ) -> KubernetesDriver {
        KubernetesDriver {
            client: Client::try_default()
                .await
                .expect("Failed to connect to Kubernetes"),
            options,
            amqp_uri,
            pool_id,
        }
    }
}

impl KubernetesDriver {
    async fn create_hpa_autoscaler(
        &self,
        worker_key: Key,
        hpa: HPAOptions,
        worker_deployment_name: String,
    ) -> Result<(), super::worker_driver::DriverError> {
        let hpa = HorizontalPodAutoscaler {
            metadata: ObjectMeta {
                name: Some(worker_deployment_name.clone()),
                namespace: Some(self.options.namespace.clone()),
                labels: Some({
                    let mut labels = BTreeMap::new();
                    labels.insert(LABEL_MANAGED_BY.to_owned(), MANAGED_BY_VALUE.to_owned());
                    labels.insert(LABEL_WORKER_ID.to_owned(), worker_key.to_string());
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

        debug!("Creating HPA: {:?}", hpa);

        kube::api::Api::<HorizontalPodAutoscaler>::namespaced(
            self.client.clone(),
            &self.options.namespace,
        )
        .create(&kube::api::PostParams::default(), &hpa)
        .await
        .map_err(super::worker_driver::DriverError::KubernetesError)?;

        Ok(())
    }

    async fn create_keda_autoscaler(
        &self,
        worker_key: Key,
        keda: KedaOptions,
        queue_name: String,
        worker_deployment_name: String,
    ) -> Result<(), super::worker_driver::DriverError> {
        let scaled_object = keda::ScaledObject {
            metadata: ObjectMeta {
                name: Some(worker_deployment_name.clone()),
                namespace: Some(self.options.namespace.clone()),
                labels: Some({
                    let mut labels = BTreeMap::new();
                    labels.insert(LABEL_MANAGED_BY.to_owned(), MANAGED_BY_VALUE.to_owned());
                    labels.insert(LABEL_WORKER_ID.to_owned(), worker_key.to_string());
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
                max_replicas_count: Some(keda.max_replicas),
                triggers: vec![keda::Trigger {
                    type_: "rabbitmq".to_string(),
                    use_cached_metrics: keda.use_cached_metrics,
                    metric_type: keda.metric_type.clone(),
                    metadata: {
                        let mut metadata = HashMap::new();
                        metadata.insert("host".to_string(), keda.amqp_host.clone());
                        metadata.insert("protocol".to_string(), "amqp".to_string());
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

        debug!("Creating Keda ScaledObject: {:?}", scaled_object);

        kube::api::Api::namespaced(self.client.clone(), &self.options.namespace)
            .create(&kube::api::PostParams::default(), &scaled_object)
            .await
            .map_err(super::worker_driver::DriverError::KubernetesError)?;

        Ok(())
    }
}

impl WorkerDriver for KubernetesDriver {
    fn get_or_create_worker_group(
        &mut self,
        queue_name: String,
        worker_key: Key,
    ) -> Pin<Box<dyn Future<Output = Result<Uuid, DriverError>> + Send + '_>> {
        Box::pin(async move {
            let current_workers = self.list_worker_groups().await?;
            for worker in current_workers {
                if worker.worker_key == worker_key {
                    return Ok(worker.worker_id);
                }
            }

            let new_id = Uuid::new_v4();
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
                    name: "WORKEY_ID_USE_HOSTNAME".to_string(),
                    value: Some("1".to_string()),
                    ..Default::default()
                });
                env
            };

            let labels = {
                let mut labels = BTreeMap::new();
                labels.insert(LABEL_MANAGED_BY.to_owned(), MANAGED_BY_VALUE.to_owned());
                labels.insert(LABEL_WORKER_ID.to_owned(), new_id.to_string());
                labels.insert(LABEL_WORKER_KEY.to_owned(), worker_key.to_string());
                labels
            };

            // Create a new deployment
            let deployment = Deployment {
                metadata: ObjectMeta {
                    name: Some(worker_deployment_name.clone()),
                    namespace: Some(self.options.namespace.clone()),
                    labels: Some(labels.clone()),
                    ..Default::default()
                },
                spec: Some(DeploymentSpec {
                    selector: LabelSelector {
                        match_labels: Some(labels.clone()),
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

            debug!("Creating deployment: {:?}", deployment);

            // Create the deployment
            kube::api::Api::<Deployment>::namespaced(self.client.clone(), &self.options.namespace)
                .create(&kube::api::PostParams::default(), &deployment)
                .await
                .map_err(super::worker_driver::DriverError::KubernetesError)?;

            // Create the autoscaler if needed
            match &self.options.autoscaling {
                // Using HorizontalPodAutoscaler
                Some(AutoscalingOptions::Hpa(hpa)) => {
                    self.create_hpa_autoscaler(worker_key, hpa.clone(), worker_deployment_name)
                        .await?;
                }

                // Using Keda as the autoscaler
                Some(AutoscalingOptions::Keda(keda)) => {
                    self.create_keda_autoscaler(
                        worker_key,
                        keda.clone(),
                        queue_name,
                        worker_deployment_name,
                    )
                    .await?;
                }

                // No autoscaler configured
                Some(AutoscalingOptions::NoScaling) | None => {}
            }

            Ok(new_id)
        })
    }

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

                            Some(super::worker_driver::WorkerMetadata {
                                external_id: deployment.metadata.name.clone()?,
                                worker_id: Uuid::parse_str(worker_id)
                                    .expect("worker_id not a valid UUID"),
                                worker_key: Key::decode(worker_key),
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
}
