use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    TrainScheduleOptions,
}

#[derive(Debug, Derivative, Clone, Serialize, Deserialize, ToSchema, Hash)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrainScheduleOptions {
    #[derivative(Default(value = "true"))]
    #[serde(default = "default_use_electrical_profiles")]
    use_electrical_profiles: bool,
}

fn default_use_electrical_profiles() -> bool {
    true
}
