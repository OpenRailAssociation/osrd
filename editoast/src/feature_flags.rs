use strum::{Display, EnumCount, EnumIter, EnumString};

#[derive(PartialEq, Eq, Hash, Clone, Debug, EnumString, Display, EnumCount, EnumIter)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
pub enum FeatureFlag {}
