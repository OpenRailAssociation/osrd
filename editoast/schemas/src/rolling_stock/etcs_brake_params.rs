use educe::Educe;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde::Serializer;
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema, Educe)]
#[educe(Hash)]
#[serde(deny_unknown_fields)]
/// Braking parameters for ERTMS ETCS Level 2
/// Commented with their names in ETCS specification document `SUBSET-026-3 v400.pdf` from the
/// file at <https://www.era.europa.eu/system/files/2023-09/index004_-_SUBSET-026_v400.zip>
pub struct EtcsBrakeParams {
    /// A_brake_emergency: the emergency deceleration curve (values > 0 m/s²)
    pub gamma_emergency: SpeedIntervalValueCurve,
    /// A_brake_service: the full service deceleration curve (values > 0 m/s²)
    pub gamma_service: SpeedIntervalValueCurve,
    /// A_brake_normal_service: the normal service deceleration curve used to compute guidance curve (values > 0 m/s²)
    pub gamma_normal_service: SpeedIntervalValueCurve,
    /// Kdry_rst: the rolling stock deceleration correction factors for dry rails
    /// Boundaries should be the same as gammaEmergency
    /// Values (no unit) should be contained in [0, 1]
    pub k_dry: SpeedIntervalValueCurve,
    /// Kwet_rst: the rolling stock deceleration correction factors for wet rails
    /// Boundaries should be the same as gammaEmergency
    /// Values (no unit) should be contained in [0, 1]
    pub k_wet: SpeedIntervalValueCurve,
    /// Kn+: the correction acceleration factor on normal service deceleration in positive gradients
    /// Values (in m/s²) should be contained in [0, 10]
    pub k_n_pos: SpeedIntervalValueCurve,
    /// Kn-: the correction acceleration factor on normal service deceleration in negative gradients
    /// Values (in m/s²) should be contained in [0, 10]
    pub k_n_neg: SpeedIntervalValueCurve,
    /// T_traction_cut_off: time delay in s from the traction cut-off command to the moment the acceleration due to traction is zero
    #[educe(Hash(method(common::hash_float::<5,_>)))]
    pub t_traction_cut_off: f64,
    /// T_bs1: time service break in s used for SBI1 computation
    #[educe(Hash(method(common::hash_float::<5,_>)))]
    pub t_bs1: f64,
    /// T_bs2: time service break in s used for SBI2 computation
    #[educe(Hash(method(common::hash_float::<5,_>)))]
    pub t_bs2: f64,
    /// T_be: safe brake build up time in s
    #[educe(Hash(method(common::hash_float::<5,_>)))]
    pub t_be: f64,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema, Educe)]
#[educe(Hash)]
#[serde(deny_unknown_fields, remote = "Self")]
pub struct SpeedIntervalValueCurve {
    #[educe(Hash(method(common::hash_float_slice::<3,_>)))]
    #[schema(example = json!([8.333333, 19.444444]))]
    /// Speed in m/s (sorted ascending)
    /// External bounds are implicit to [0, rolling_stock.max_speed]
    boundaries: Vec<f64>,
    #[educe(Hash(method(common::hash_float_slice::<3,_>)))]
    #[schema(min_items = 1, minimum = 0, example = json!([0.5, 0.6, 0.5]))]
    /// Interval values, must be >= 0 (unit to be made explicit at use)
    /// There must be one more value than boundaries
    values: Vec<f64>,
}

impl<'de> Deserialize<'de> for SpeedIntervalValueCurve {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let curve = SpeedIntervalValueCurve::deserialize(deserializer)?;

        if curve.boundaries.len() != curve.values.len() - 1 {
            return Err(serde::de::Error::custom(
                "curve invalid, expected one more value than boundaries.",
            ));
        }
        if curve.values.is_empty() {
            return Err(serde::de::Error::custom(
                "curve should have at least 1 value.",
            ));
        }
        if curve.values.iter().any(|&x| x < 0.0) {
            return Err(serde::de::Error::custom(
                "curve values must be equal or greater than 0.",
            ));
        };
        if curve.boundaries.iter().any(|&x| x < 0.0) {
            return Err(serde::de::Error::custom(
                "speed boundaries must be equal or greater than 0.",
            ));
        };
        if curve
            .boundaries
            .windows(2)
            .any(|window| window[0] >= window[1])
        {
            return Err(serde::de::Error::custom(
                "speed boundaries must be strictly increasing.",
            ));
        }

        Ok(curve)
    }
}

impl Serialize for SpeedIntervalValueCurve {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        SpeedIntervalValueCurve::serialize(self, serializer)
    }
}
