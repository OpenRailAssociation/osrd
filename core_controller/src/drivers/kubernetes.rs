use super::{
    core_driver::{CoreDriver, CoreMetadata, DriverError},
    LABEL_CORE_ID, LABEL_INFRA_ID, LABEL_MANAGED_BY, MANAGED_BY_VALUE,
};
use k8s_openapi::{
    api::{
        apps::v1::{Deployment, DeploymentSpec},
        autoscaling::v1::HorizontalPodAutoscaler,
        core::v1::{
            Affinity, Container, EnvVar, HTTPGetAction, PodSpec, PodTemplateSpec, Probe,
            ResourceRequirements, Service, Toleration,
        },
    },
    apimachinery::pkg::util::intstr::IntOrString,
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
    /// The default environment variables to set for the core (passthrough to kubernetes deployment)
    pub default_env: Option<Vec<EnvVar>>,

    /// The resources to allocate to the core (passthrough to kubernetes deployment)
    pub resources: Option<ResourceRequirements>,

    /// The node selector to use for the core (passthrough to kubernetes deployment)
    pub node_selector: Option<BTreeMap<String, String>>,

    /// The affinity to use for the core (passthrough to kubernetes deployment)
    pub affinity: Option<Affinity>,

    /// The tolerations to use for the core (passthrough to kubernetes deployment)
    pub tolerations: Option<Vec<Toleration>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct KubernetesDriverOptions {
    /// The name of the Docker image to use for the core
    pub core_image_name: String,

    /// The tag of the Docker image to use for the core
    pub core_image_tag: String,

    /// The prefix to use for the deployment names
    pub deployment_prefix: String,

    /// The namespace to use for the deployments
    pub namespace: String,

    /// The URL of the Editoast instance
    pub editoast_url: String,

    /// The port to use for the core
    pub core_port: u16,

    /// Whether to deploy a service for the core (for http request)
    pub deploy_service: bool,

    /// The autoscaling options to use for the core
    pub autoscaling: Option<AutoscalingOptions>,

    /// The options to use for the kubernetes deployment
    pub kube_deployment_options: KubernetesDeploymentOptions,
}

pub struct KubernetesDriver {
    client: Client,
    options: KubernetesDriverOptions,
}

impl KubernetesDriver {
    pub async fn new(options: KubernetesDriverOptions) -> KubernetesDriver {
        KubernetesDriver {
            client: Client::try_default()
                .await
                .expect("Failed to connect to Kubernetes"),
            options,
        }
    }
}

impl CoreDriver for KubernetesDriver {
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
            let core_deployment_name =
                format!("{}-core-{}", self.options.deployment_prefix, infra_id);
            let final_env = {
                let mut env = self
                    .options
                    .kube_deployment_options
                    .default_env
                    .clone()
                    .unwrap_or_default();
                env.push(EnvVar {
                    name: "CORE_ID".to_string(),
                    value: Some(new_id.to_string()),
                    ..Default::default()
                });
                env.push(EnvVar {
                    name: "INFRA_ID".to_string(),
                    value: Some(infra_id.to_string()),
                    ..Default::default()
                });
                env.push(EnvVar {
                    name: "CORE_PORT".to_string(),
                    value: Some(self.options.core_port.to_string()),
                    ..Default::default()
                });
                env.push(EnvVar {
                    name: "CORE_EDITOAST_URL".to_string(),
                    value: Some(self.options.editoast_url.clone()),
                    ..Default::default()
                });
                env
            };

            let health_probe = Some(HTTPGetAction {
                path: Some("/ready".to_string()),
                port: IntOrString::Int(8080),
                ..Default::default()
            });

            // Create a new deployment
            let deployment = Deployment {
                metadata: ObjectMeta {
                    name: Some(core_deployment_name.clone()),
                    namespace: Some(self.options.namespace.clone()),
                    labels: Some({
                        let mut labels = BTreeMap::new();
                        labels.insert(LABEL_MANAGED_BY.to_owned(), MANAGED_BY_VALUE.to_owned());
                        labels.insert(LABEL_CORE_ID.to_owned(), new_id.to_string());
                        labels.insert(LABEL_INFRA_ID.to_owned(), infra_id.to_string());
                        labels
                    }),
                    ..Default::default()
                },
                spec: Some(DeploymentSpec {
                    replicas: Some(1),
                    template: PodTemplateSpec {
                        spec: Some(PodSpec {
                            containers: vec![Container {
                                name: core_deployment_name.clone(),
                                image: Some(format!(
                                    "{}:{}",
                                    self.options.core_image_name, self.options.core_image_tag
                                )),
                                liveness_probe: Some(Probe {
                                    http_get: health_probe.clone(),
                                    initial_delay_seconds: Some(30),
                                    period_seconds: Some(10),
                                    timeout_seconds: Some(10),
                                    ..Default::default()
                                }),
                                readiness_probe: Some(Probe {
                                    http_get: health_probe,
                                    ..Default::default()
                                }),
                                env: Some(final_env),
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
                        ..Default::default()
                    },
                    ..Default::default()
                }),
                ..Default::default()
            };

            // Create the service if needed
            if self.options.deploy_service {
                let service = Service {
                    metadata: ObjectMeta {
                        name: Some(core_deployment_name.clone()),
                        namespace: Some(self.options.namespace.clone()),
                        labels: Some({
                            let mut labels = BTreeMap::new();
                            labels.insert(LABEL_MANAGED_BY.to_owned(), MANAGED_BY_VALUE.to_owned());
                            labels.insert(LABEL_CORE_ID.to_owned(), new_id.to_string());
                            labels.insert(LABEL_INFRA_ID.to_owned(), infra_id.to_string());
                            labels
                        }),
                        ..Default::default()
                    },
                    spec: Some({
                        let mut ports = Vec::new();
                        ports.push(k8s_openapi::api::core::v1::ServicePort {
                            port: 80,
                            target_port: Some(IntOrString::Int(self.options.core_port as i32)),
                            ..Default::default()
                        });
                        k8s_openapi::api::core::v1::ServiceSpec {
                            selector: Some({
                                let mut selector = BTreeMap::new();
                                selector.insert(LABEL_CORE_ID.to_owned(), new_id.to_string());
                                selector.insert(LABEL_INFRA_ID.to_owned(), infra_id.to_string());
                                selector
                            }),
                            ports: Some(ports),
                            ..Default::default()
                        }
                    }),
                    ..Default::default()
                };

                kube::api::Api::<Service>::namespaced(self.client.clone(), &self.options.namespace)
                    .create(&kube::api::PostParams::default(), &service)
                    .await
                    .map_err(super::core_driver::DriverError::KubernetesError)?;
            }

            // Create the autoscaler if needed
            if let Some(autoscaling) = &self.options.autoscaling {
                let hpa = HorizontalPodAutoscaler {
                    metadata: ObjectMeta {
                        name: Some(core_deployment_name.clone()),
                        namespace: Some(self.options.namespace.clone()),
                        labels: Some({
                            let mut labels = BTreeMap::new();
                            labels.insert(LABEL_MANAGED_BY.to_owned(), MANAGED_BY_VALUE.to_owned());
                            labels.insert(LABEL_CORE_ID.to_owned(), new_id.to_string());
                            labels.insert(LABEL_INFRA_ID.to_owned(), infra_id.to_string());
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
                                    name: core_deployment_name.clone(),
                                },
                            min_replicas: Some(autoscaling.min_replicas),
                            max_replicas: autoscaling.max_replicas,
                            target_cpu_utilization_percentage: Some(
                                autoscaling.target_cpu_utilization_percentage,
                            ),
                            ..Default::default()
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
                .map_err(super::core_driver::DriverError::KubernetesError)?;
            }

            // Create the deployment
            kube::api::Api::<Deployment>::namespaced(self.client.clone(), &self.options.namespace)
                .create(&kube::api::PostParams::default(), &deployment)
                .await
                .map_err(super::core_driver::DriverError::KubernetesError)?;

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
                    let core_deployment_name =
                        format!("{}-core-{}", self.options.deployment_prefix, core.infra_id);

                    // Delete the deployment
                    kube::api::Api::<Deployment>::namespaced(
                        self.client.clone(),
                        &self.options.namespace,
                    )
                    .delete(&core_deployment_name, &kube::api::DeleteParams::default())
                    .await
                    .map_err(super::core_driver::DriverError::KubernetesError)?;

                    // Delete the service
                    if self.options.deploy_service {
                        kube::api::Api::<Service>::namespaced(
                            self.client.clone(),
                            &self.options.namespace,
                        )
                        .delete(&core_deployment_name, &kube::api::DeleteParams::default())
                        .await
                        .map_err(super::core_driver::DriverError::KubernetesError)?;
                    }

                    // Delete the autoscaler
                    if let Some(_) = &self.options.autoscaling {
                        kube::api::Api::<HorizontalPodAutoscaler>::namespaced(
                            self.client.clone(),
                            &self.options.namespace,
                        )
                        .delete(&core_deployment_name, &kube::api::DeleteParams::default())
                        .await
                        .map_err(super::core_driver::DriverError::KubernetesError)?;
                    }

                    return Ok(());
                }
            }

            Ok(())
        })
    }

    fn list_core_pools(
        &self,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<CoreMetadata>, DriverError>> + Send + '_>> {
        Box::pin(async move {
            let deployments = kube::api::Api::<Deployment>::namespaced(
                self.client.clone(),
                &self.options.namespace,
            )
            .list(&kube::api::ListParams::default())
            .await
            .map_err(super::core_driver::DriverError::KubernetesError)?;

            let cores = deployments
                .iter()
                .filter_map(|deployment| {
                    deployment.metadata.labels.as_ref().and_then(|labels| {
                        if labels.get(LABEL_MANAGED_BY) == Some(&MANAGED_BY_VALUE.to_owned()) {
                            let core_id = labels.get(LABEL_CORE_ID).expect("core_id not found");
                            let infra_id = labels.get(LABEL_INFRA_ID).expect("infra_id not found");

                            Some(super::core_driver::CoreMetadata {
                                external_id: deployment.metadata.name.clone()?,
                                core_id: Uuid::parse_str(core_id)
                                    .expect("core_id not a valid UUID"),
                                infra_id: infra_id.parse().expect("infra_id not a valid number"),
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
