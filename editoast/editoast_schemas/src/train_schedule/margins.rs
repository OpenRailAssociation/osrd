use std::str::FromStr;

use crate::primitives::NonBlankString;
use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    Margins,
}

#[derive(Debug, Clone, Serialize, Derivative, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Margins {
    #[schema(inline)]
    pub boundaries: Vec<NonBlankString>,
    #[derivative(Default(value = "vec![MarginValue::default()]"))]
    /// The values of the margins. Must contains one more element than the boundaries
    /// Can be a percentage `X%` or a time in minutes per 100 kilometer `Xmin/100km`
    #[schema(value_type = Vec<String>, example = json!(["5%", "2min/100km"]))]
    pub values: Vec<MarginValue>,
}

impl<'de> Deserialize<'de> for Margins {
    fn deserialize<D>(deserializer: D) -> Result<Margins, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct InternalMargins {
            boundaries: Vec<NonBlankString>,
            values: Vec<MarginValue>,
        }

        let InternalMargins { boundaries, values } = InternalMargins::deserialize(deserializer)?;
        if boundaries.len() + 1 != values.len() {
            return Err(serde::de::Error::custom(
                "It's expected to have one more value than boundaries",
            ));
        }
        Ok(Margins { boundaries, values })
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Derivative)]
#[derivative(Hash, Default)]
pub enum MarginValue {
    #[derivative(Default)]
    Percentage(#[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))] f64),
    MinPer100Km(#[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))] f64),
}

impl<'de> Deserialize<'de> for MarginValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        if value.ends_with('%') {
            let float_value = f64::from_str(value[0..value.len() - 1].trim()).map_err(|_| {
                serde::de::Error::invalid_value(
                    serde::de::Unexpected::Str(&value),
                    &"a valid float",
                )
            })?;
            if float_value < 0.0 {
                return Err(serde::de::Error::invalid_value(
                    serde::de::Unexpected::Str(&value),
                    &"a positive number",
                ));
            }
            return Ok(Self::Percentage(float_value));
        }
        if value.ends_with("min/100km") {
            let float_value: f64 =
                f64::from_str(value[0..value.len() - 9].trim()).map_err(|_| {
                    serde::de::Error::invalid_value(
                        serde::de::Unexpected::Str(&value),
                        &"a valid float",
                    )
                })?;
            if float_value < 0.0 {
                return Err(serde::de::Error::invalid_value(
                    serde::de::Unexpected::Str(&value),
                    &"a positive number",
                ));
            }
            return Ok(Self::MinPer100Km(float_value));
        }
        Err(serde::de::Error::custom("Margin type not recognized"))
    }
}

impl Serialize for MarginValue {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            MarginValue::Percentage(value) => serializer.serialize_str(&format!("{}%", value)),
            MarginValue::MinPer100Km(value) => {
                serializer.serialize_str(&format!("{}min/100km", value))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::from_str;
    use serde_json::to_string;

    use crate::train_schedule::MarginValue;
    use crate::train_schedule::Margins;

    /// Test that the `MarginValue` enum can be deserialized from a string
    #[test]
    fn deserialize_margin_value() {
        let percentage: MarginValue = from_str(r#""10%""#).unwrap();
        assert_eq!(percentage, MarginValue::Percentage(10.0));

        let min_per_km: MarginValue = from_str(r#""5.3min/100km""#).unwrap();
        assert_eq!(min_per_km, MarginValue::MinPer100Km(5.3));
    }

    /// Test invalid `MarginValue` deserialization
    #[test]
    fn deserialize_invalid_margin_value() {
        assert!(from_str::<MarginValue>(r#""3.5""#).is_err());
        assert!(from_str::<MarginValue>(r#""-5%""#).is_err());
        assert!(from_str::<MarginValue>(r#""-0.4min/100km""#).is_err());
    }

    /// Test that the `MarginValue` enum can be serialized to a string
    #[test]
    fn serialize_margin_value() {
        let percentage = to_string(&MarginValue::Percentage(10.0)).unwrap();
        assert_eq!(percentage, r#""10%""#);

        let min_per_km = to_string(&MarginValue::MinPer100Km(5.3)).unwrap();
        assert_eq!(min_per_km, r#""5.3min/100km""#);
    }

    /// Test that Margins deserialization checks works
    #[test]
    fn deserialize_margins() {
        let valid_margins = r#"{"boundaries":["a", "b"],"values":["0%","10%","20min/100km"]}"#;
        assert!(from_str::<Margins>(valid_margins).is_ok());
        let invalid_margins = r#"{"boundaries":["a"],"values":["0min/100km","10%","20min/100km"]}"#;
        assert!(from_str::<Margins>(invalid_margins).is_err());
        let invalid_margins = r#"{"boundaries":["a", "b"],"values":["0%","10%"]}"#;
        assert!(from_str::<Margins>(invalid_margins).is_err());
    }
}
