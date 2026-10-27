use strum::EnumString;

#[derive(PartialEq, Eq, Hash, Clone, Debug, EnumString)]
#[cfg_attr(test, derive(strum::EnumCount, strum::EnumIter, strum::Display))]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum FeatureFlag {}
