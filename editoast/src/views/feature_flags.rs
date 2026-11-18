use strum::Display;
use strum::EnumString;

#[derive(PartialEq, Eq, Hash, Clone, Debug, EnumString, Display)]
#[cfg_attr(test, derive(strum::EnumCount, strum::EnumIter))]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub(in crate::views) enum FeatureFlag {}
