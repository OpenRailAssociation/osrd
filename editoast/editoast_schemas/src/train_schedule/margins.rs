use std::str::FromStr;

use derivative::Derivative;
use editoast_common::NonBlankString;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

editoast_common::schemas! {
    Margins,
    MarginValue,
}

#[derive(Debug, Clone, Serialize, Derivative, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Margins {
    #[schema(inline)]
    pub boundaries: Vec<NonBlankString>,
    #[derivative(Default(value = "vec![MarginValue::None]"))]
    /// The values of the margins. Must contains one more element than the boundaries
    /// Can be a percentage `X%`, a time in minutes per kilometer `Xmin/km` or `none`
    #[schema(value_type = Vec<String>, example = json!(["none", "5%", "2min/km"]))]
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
                "The number of boudaries and values must be the same",
            ));
        }
        Ok(Margins { boundaries, values })
    }
}

#[derive(Debug, Copy, Clone, Default, PartialEq, Derivative, ToSchema)]
#[derivative(Hash)]
pub enum MarginValue {
    #[default]
    None,
    Percentage(#[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))] f64),
    MinPerKm(#[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))] f64),
}

impl<'de> Deserialize<'de> for MarginValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        if value.to_lowercase() == "none" {
            return Ok(Self::None);
        }
        if value.ends_with('%') {
            let float_value = f64::from_str(value[0..value.len() - 1].trim()).map_err(|_| {
                serde::de::Error::invalid_value(
                    serde::de::Unexpected::Str(&value),
                    &"a valid float",
                )
            })?;
            if float_value <= 0.0 {
                return Err(serde::de::Error::invalid_value(
                    serde::de::Unexpected::Str(&value),
                    &"a strictly positive number",
                ));
            }
            return Ok(Self::Percentage(float_value));
        }
        if value.ends_with("min/km") {
            let float_value: f64 =
                f64::from_str(value[0..value.len() - 6].trim()).map_err(|_| {
                    serde::de::Error::invalid_value(
                        serde::de::Unexpected::Str(&value),
                        &"a valid float",
                    )
                })?;
            if float_value <= 0.0 {
                return Err(serde::de::Error::invalid_value(
                    serde::de::Unexpected::Str(&value),
                    &"a strictly positive float",
                ));
            }
            return Ok(Self::MinPerKm(float_value));
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
            MarginValue::None => serializer.serialize_str("none"),
            MarginValue::Percentage(value) => serializer.serialize_str(&format!("{}%", value)),
            MarginValue::MinPerKm(value) => serializer.serialize_str(&format!("{}min/km", value)),
        }
    }
}
