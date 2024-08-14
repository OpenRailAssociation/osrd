use derivative::Derivative;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use std::collections::BTreeMap;

use utoipa::ToSchema;

use crate::train_schedule::Comfort;

editoast_common::schemas! {
    ConditionalEffortCurve,
    EffortCurve,
    EffortCurves,
    EffortCurveConditions,
    ModeEffortCurves,
    Comfort,
}

#[derive(Clone, Debug, Default, PartialEq, Deserialize, Serialize, ToSchema, Hash)]
#[serde(deny_unknown_fields)]
pub struct EffortCurves {
    pub modes: BTreeMap<String, ModeEffortCurves>,
    default_mode: String,
}

impl EffortCurves {
    fn has_electric_curves(&self) -> bool {
        self.modes.values().any(|mode| mode.is_electric)
    }

    pub fn is_electric(&self) -> bool {
        self.has_electric_curves()
    }
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema, Hash)]
#[serde(deny_unknown_fields)]
pub struct ModeEffortCurves {
    curves: Vec<ConditionalEffortCurve>,
    default_curve: EffortCurve,
    pub is_electric: bool,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema, Hash)]
#[serde(deny_unknown_fields)]
pub struct ConditionalEffortCurve {
    cond: EffortCurveConditions,
    curve: EffortCurve,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema, Hash)]
#[serde(deny_unknown_fields)]
pub struct EffortCurveConditions {
    #[schema(required)]
    comfort: Option<Comfort>,
    #[schema(required)]
    electrical_profile_level: Option<String>,
    #[schema(required)]
    power_restriction_code: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, ToSchema, Derivative)]
#[derivative(Hash)]
#[serde(deny_unknown_fields)]
pub struct EffortCurve {
    #[derivative(Hash(hash_with = "editoast_common::hash_float_slice::<3,_>"))]
    #[schema(min_items = 2, example = json!([0.0, 2.958, 46.719]))]
    speeds: Vec<f64>,
    #[derivative(Hash(hash_with = "editoast_common::hash_float_slice::<3,_>"))]
    #[schema(min_items = 2, example = json!([23500.0, 23200.0, 21200.0]))]
    max_efforts: Vec<f64>,
}

impl<'de> Deserialize<'de> for EffortCurve {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct InnerParams {
            speeds: Vec<f64>,
            max_efforts: Vec<f64>,
        }

        let inner = InnerParams::deserialize(deserializer)?;

        // Validate the curve
        if inner.max_efforts.len() != inner.speeds.len() {
            return Err(serde::de::Error::custom(
                "effort curve invalid, max_efforts and speeds arrays should have the same length",
            ));
        }

        if inner.max_efforts.len() < 2 {
            return Err(serde::de::Error::custom(
                "effort curve should have at least 2 points.",
            ));
        }

        if inner.max_efforts.iter().any(|&x| x < 0.0) {
            return Err(serde::de::Error::custom(
                "max_efforts values must be equal or greater than 0.",
            ));
        };

        if inner.speeds.iter().any(|&x| x < 0.0) {
            return Err(serde::de::Error::custom(
                "speeds values must be equal or greater than 0.",
            ));
        };

        if inner.speeds.windows(2).any(|window| window[0] >= window[1]) {
            return Err(serde::de::Error::custom(
                "speeds values must be strictly increasing.",
            ));
        }

        Ok(EffortCurve {
            speeds: inner.speeds,
            max_efforts: inner.max_efforts,
        })
    }
}

#[cfg(test)]
mod tests {
    use serde_json::from_value;
    use serde_json::json;

    use crate::rolling_stock::EffortCurve;

    #[test]
    fn test_de_effort_curve_valid() {
        let curve = json!({ "speeds": [0, 1], "max_efforts": [0, 2] });
        assert!(from_value::<EffortCurve>(curve).is_ok());
    }

    #[test]
    fn test_effort_curve_invalid_due_to_single_point() {
        let curve = json!({ "speeds": [0], "max_efforts": [0] });
        assert!(from_value::<EffortCurve>(curve).is_err());
    }

    #[test]
    fn test_de_effort_curve_invalid_due_to_mismatched_lengths() {
        let curve = json!({ "speeds": [0, 1], "max_efforts": [] });
        assert!(from_value::<EffortCurve>(curve).is_err());
    }

    #[test]
    fn test_de_effort_curve_invalid_due_to_negative_max_efforts() {
        let curve = json!({ "speeds": [0, 1, 2], "max_efforts": [5, 4, -3] });
        assert!(from_value::<EffortCurve>(curve).is_err());
    }

    #[test]
    fn test_de_effort_curve_invalid_due_to_negative_speeds() {
        let curve = json!({ "speeds": [-1, 0, 1], "max_efforts": [5, 4, 3] });
        assert!(from_value::<EffortCurve>(curve).is_err());
    }

    #[test]
    fn test_de_effort_curve_invalid_due_to_unordered_speeds() {
        let curve = json!({ "speeds": [0, 2, 1], "max_efforts": [5, 4, 3] });
        assert!(from_value::<EffortCurve>(curve).is_err());
    }
}
