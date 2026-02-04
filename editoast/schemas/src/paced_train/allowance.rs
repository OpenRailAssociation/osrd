use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(tag = "allowance_type", rename_all = "lowercase")]
pub enum Allowance {
    Engineering(EngineeringAllowance),
    Standard(StandardAllowance),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]

pub struct EngineeringAllowance {
    #[serde(flatten)]
    range: RangeAllowance,
    distribution: AllowanceDistribution,
    #[serde(default = "default_capacity_speed_limit")]
    #[schema(default = default_capacity_speed_limit)]
    capacity_speed_limit: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct StandardAllowance {
    default_value: AllowanceValue,
    ranges: Vec<RangeAllowance>,
    distribution: AllowanceDistribution,
    #[serde(default = "default_capacity_speed_limit")]
    capacity_speed_limit: f64,
}

const fn default_capacity_speed_limit() -> f64 {
    -1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(tag = "value_type")]
pub enum AllowanceValue {
    #[serde(rename = "time_per_distance")]
    TimePerDistance { minutes: f64 },
    #[serde(rename = "time")]
    Time { seconds: f64 },
    #[serde(rename = "percentage")]
    Percent { percentage: f64 },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct RangeAllowance {
    begin_position: f64,
    end_position: f64,
    value: AllowanceValue,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "UPPERCASE")]
pub enum AllowanceDistribution {
    Mareco,
    Linear,
}
