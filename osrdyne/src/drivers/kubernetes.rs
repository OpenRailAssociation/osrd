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
            Affinity, Container, EnvVar, PodSpec, PodTemplateSpec, ResourceRequirements, Toleration,
        },
    },
    apimachinery::pkg::apis::meta::v1::LabelSelector,
};
use kube::{api::ObjectMeta, Client};
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, future::Future, pin::Pin};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AutoscalingOptions {
    /// The minimum number of replicas
    pub min_replicas: i32,
    /// The maximum number of replicas
    pub max_replicas: i32,
    /// The target CPU utilization percentage
    pub target_cpu_utilization_percentage: i32,
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
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct KubernetesDriverOptions {
    /// The name of the Docker image to use for the worker
    pub container_image: String,

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

impl WorkerDriver for KubernetesDriver {
    fn get_or_create_worker_group(
        &self,
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
            let worker_deployment_name =
                format!("{}-{}", self.options.deployment_prefix, worker_key);
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
                            labels: Some(labels.clone()),
                            ..Default::default()
                        }),
                        spec: Some(PodSpec {
                            containers: vec![Container {
                                name: worker_deployment_name.clone(),
                                image: Some(self.options.container_image.clone()),
                                env: Some(final_env),
                                command: Some(self.options.start_command.clone()),
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

            // Create the autoscaler if needed
            if let Some(autoscaling) = &self.options.autoscaling {
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
                            min_replicas: Some(autoscaling.min_replicas),
                            max_replicas: autoscaling.max_replicas,
                            target_cpu_utilization_percentage: Some(
                                autoscaling.target_cpu_utilization_percentage,
                            ),
                        }
                    }),
                    ..Default::default()
                };

                kube::api::Api::<HorizontalPodAutoscaler>::namespaced(
                    self.client.clone(),
                    &self.options.namespace,
                )
                .create(&kube::api::PostParams::default(), &hpa)
                .await
                .map_err(super::worker_driver::DriverError::KubernetesError)?;
            }

            // Create the deployment
            kube::api::Api::<Deployment>::namespaced(self.client.clone(), &self.options.namespace)
                .create(&kube::api::PostParams::default(), &deployment)
                .await
                .map_err(super::worker_driver::DriverError::KubernetesError)?;

            Ok(new_id)
        })
    }

    fn destroy_worker_group(
        &self,
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
