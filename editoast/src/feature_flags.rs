use strum::{Display, EnumCount, EnumIter, EnumString};

#[derive(PartialEq, Eq, Hash, Clone, Debug, EnumString, Display, EnumCount, EnumIter)]
#[strum(serialize_all = "camelCase")]
pub enum FeatureFlag {
    // Linkings,
    // HourlyTimetables,
    // MultipleTimetables,
    // UnrecognizedWaypoints,
}
