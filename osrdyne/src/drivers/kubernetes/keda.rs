use std::collections::HashMap;

use kube::CustomResource;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(CustomResource, Clone, Debug, Deserialize, Serialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[kube(
    group = "keda.sh",
    version = "v1alpha1",
    kind = "ScaledObject",
    namespaced
)]
pub struct ScaledObjectSpec {
    pub scale_target_ref: ScaleTargetRef,
    pub polling_interval: Option<i32>,
    pub cooldown_period: Option<i32>,
    pub initial_cooldown_period: Option<i32>,
    pub idle_replica_count: Option<i32>,
    pub min_replica_count: Option<i32>,
    pub max_replica_count: Option<i32>,
    pub triggers: Vec<Trigger>,
}

#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScaleTargetRef {
    pub api_version: String,
    pub kind: String,
    pub name: String,
    pub env_source_container_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
pub enum MetricType {
    AverageValue,
    Value,
    Utilization,
}

#[derive(Debug, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct Trigger {
    pub type_: String,
    pub metadata: HashMap<String, String>,
    pub use_cached_metrics: bool,
    pub metric_type: MetricType,
}
