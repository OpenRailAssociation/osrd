use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    TrainScheduleOptions,
}

#[derive(Debug, Educe, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema, Hash)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct TrainScheduleOptions {
    #[educe(Default = true)]
    #[serde(default = "default_use_electrical_profiles")]
    use_electrical_profiles: bool,
    #[educe(Default = true)]
    #[serde(default = "default_use_speed_limits_for_simulation")]
    use_speed_limits_for_simulation: bool,
}

fn default_use_electrical_profiles() -> bool {
    true
}

fn default_use_speed_limits_for_simulation() -> bool {
    true
}
