use std::collections::HashSet;
use std::str::FromStr;

#[derive(PartialEq, Eq, Hash, Clone, Debug)]
pub enum FeatureFlag {
    Linkings,
    HourlyTimetables,
    MultipleTimetables,
    UnrecognizedWaypoints,
}

impl FromStr for FeatureFlag {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "linkings" => Ok(FeatureFlag::Linkings),
            "hourlyTimetables" => Ok(FeatureFlag::HourlyTimetables),
            "multipleTimetables" => Ok(FeatureFlag::MultipleTimetables),
            "UnrecognizedWaypoints" => Ok(FeatureFlag::UnrecognizedWaypoints),
            _ => Err("Unrecognized feature flag"),
        }
    }
}

pub fn extract_feature_flags(header: &str, feature_flags: &mut HashSet<FeatureFlag>) {
    let vec = header.split(',').map(|s| s.trim());
    for value in vec {
        if let Ok(flag) = FeatureFlag::from_str(value) {
            feature_flags.insert(flag);
        }
    }
}
