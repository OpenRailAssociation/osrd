use strum::EnumString;

#[derive(PartialEq, Eq, Hash, Clone, Debug, EnumString)]
#[strum(serialize_all = "camelCase")]
pub enum FeatureFlag {
    Linkings,
    HourlyTimetables,
    MultipleTimetables,
    UnrecognizedWaypoints,
}
