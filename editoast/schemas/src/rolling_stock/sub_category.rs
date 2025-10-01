use std::str::FromStr;
use std::sync::OnceLock;

use regex::Regex;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use utoipa::ToSchema;

use crate::rolling_stock::TrainMainCategory;

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct SubCategory {
    pub name: String,
    pub code: String,
    pub main_category: TrainMainCategory,
    pub color: SubCategoryColor,
    pub background_color: SubCategoryColor,
    pub hovered_color: SubCategoryColor,
}

/// Represents a color for a sub-category in hexadecimal format #RRGGBB.
#[derive(Clone, Debug, PartialEq, Serialize, ToSchema)]
pub struct SubCategoryColor(String);

impl From<String> for SubCategoryColor {
    fn from(color: String) -> Self {
        SubCategoryColor(color)
    }
}

impl From<SubCategoryColor> for String {
    fn from(color: SubCategoryColor) -> Self {
        color.0
    }
}

static COLOR_REGEX: OnceLock<Regex> = OnceLock::new();
impl FromStr for SubCategoryColor {
    type Err = String;

    fn from_str(color: &str) -> Result<Self, Self::Err> {
        let regex =
            COLOR_REGEX.get_or_init(|| Regex::new(r"^#[0-9a-fA-F]{6}$").expect("Invalid regex"));
        if regex.is_match(color.trim()) {
            Ok(Self(color.to_string()))
        } else {
            Err(format!(
                "Invalid color format: '{color}'. Expected format: #RRGGBB"
            ))
        }
    }
}

impl<'de> Deserialize<'de> for SubCategoryColor {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = String::deserialize(deserializer)?;
        match raw.parse::<Self>() {
            Ok(color) => Ok(color),
            Err(err) => Err(serde::de::Error::custom(err)),
        }
    }
}

#[cfg(test)]
mod tests {
    use rstest::rstest;

    use crate::rolling_stock::sub_category::SubCategoryColor;

    #[rstest]
    #[case("#000000")]
    #[case("#FFFFFF")]
    #[case("#ffffff")]
    fn deserialize_sub_category_color_success(#[case] color: &str) {
        let sub_category_color = color.parse::<SubCategoryColor>();
        assert!(sub_category_color.is_ok());
    }

    #[rstest]
    #[case("000000")]
    #[case("#0000000")]
    #[case("#0000")]
    #[case("#000")]
    #[case("#")]
    #[case("ffFFff")]
    #[case("#FF00ZZ")]
    fn deserialize_sub_category_color_failure(#[case] color: &str) {
        let sub_category_color = color.parse::<SubCategoryColor>();
        assert!(sub_category_color.is_err());
    }
}
