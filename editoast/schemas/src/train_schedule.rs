mod margins;
pub use margins::MarginValue;
pub use margins::Margins;

mod schedule_item;
pub use schedule_item::ReceptionSignal;
pub use schedule_item::ScheduleItem;

mod path_item;
pub use path_item::OperationalPointPartReference;
pub use path_item::OperationalPointReference;
pub use path_item::PathItem;
pub use path_item::PathItemLocation;

mod train_schedule_options;
pub use train_schedule_options::TrainScheduleOptions;

mod power_restriction_item;
pub use power_restriction_item::PowerRestrictionItem;

mod distribution;
pub use distribution::Distribution;

mod comfort;
pub use comfort::Comfort;

mod allowance;
pub use allowance::Allowance;
pub use allowance::AllowanceDistribution;
pub use allowance::AllowanceValue;
pub use allowance::EngineeringAllowance;
pub use allowance::RangeAllowance;
pub use allowance::StandardAllowance;

mod rjs_power_restriction_range;
pub use rjs_power_restriction_range::RjsPowerRestrictionRange;

use std::collections::HashMap;
use std::collections::HashSet;

use common::units::quantities::Offset;
use serde::Deserialize;
use serde::Serialize;
use serde::de::Error as SerdeError;
use serde_with::DefaultOnNull;
use serde_with::serde_as;
use utoipa::ToSchema;

use crate::primitives::NonBlankString;
use crate::rolling_stock::TrainCategory;

#[serde_as]
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(default)]
#[serde(remote = "Self")]
pub struct TrainOccurrence {
    pub train_name: String,
    #[serde(default)]
    #[serde_as(as = "DefaultOnNull")]
    pub labels: Vec<String>,
    pub rolling_stock_name: String,
    /// For calendar timetables: elapsed ms since 1970-01-01T00:00:00Z.
    /// For hourly timetables: elapsed ms since the timetable start.
    #[serde(with = "common::units::millisecond::i64")]
    #[schema(value_type = i64)]
    #[schema(default = 0)]
    pub start_time: Offset,
    pub path: Vec<PathItem>,
    #[serde(default)]
    #[serde_as(as = "DefaultOnNull")]
    pub schedule: Vec<ScheduleItem>,
    #[serde(default)]
    #[serde_as(as = "DefaultOnNull")]
    pub margins: Margins,
    #[serde(default)]
    #[serde_as(as = "DefaultOnNull")]
    pub initial_speed: f64,
    #[serde(default)]
    #[serde_as(as = "DefaultOnNull")]
    pub comfort: Comfort,
    pub constraint_distribution: Distribution,
    #[serde(default)]
    pub speed_limit_tag: Option<NonBlankString>,
    #[schema(inline)]
    #[serde(default)]
    #[serde_as(as = "DefaultOnNull")]
    pub power_restrictions: Vec<PowerRestrictionItem>,
    #[serde(default)]
    #[serde_as(as = "DefaultOnNull")]
    pub options: TrainScheduleOptions,
    pub category: Option<TrainCategory>,
}

pub trait TrainScheduleLike: Clone + Send + Sync + 'static {
    fn rolling_stock_name(&self) -> &str;
    fn start_time(&self) -> Offset;
    fn path(&self) -> &[PathItem];
    fn schedule(&self) -> &[ScheduleItem];
    fn margins(&self) -> &Margins;
    fn initial_speed(&self) -> f64;
    fn comfort(&self) -> Comfort;
    fn constraint_distribution(&self) -> Distribution;
    fn speed_limit_tag(&self) -> Option<&String>;
    fn power_restrictions(&self) -> &[PowerRestrictionItem];
    fn options(&self) -> &TrainScheduleOptions;

    fn locations(&self) -> Vec<PathItemLocation> {
        self.path().iter().map(|pi| pi.location.clone()).collect()
    }
}

impl TrainScheduleLike for TrainOccurrence {
    fn rolling_stock_name(&self) -> &str {
        &self.rolling_stock_name
    }

    fn start_time(&self) -> Offset {
        self.start_time
    }

    fn path(&self) -> &[PathItem] {
        &self.path
    }

    fn schedule(&self) -> &[ScheduleItem] {
        &self.schedule
    }

    fn margins(&self) -> &Margins {
        &self.margins
    }

    fn initial_speed(&self) -> f64 {
        self.initial_speed
    }

    fn comfort(&self) -> Comfort {
        self.comfort
    }

    fn constraint_distribution(&self) -> Distribution {
        self.constraint_distribution
    }

    fn speed_limit_tag(&self) -> Option<&String> {
        self.speed_limit_tag.as_ref().map(|s| &s.0)
    }

    fn power_restrictions(&self) -> &[PowerRestrictionItem] {
        &self.power_restrictions
    }

    fn options(&self) -> &TrainScheduleOptions {
        &self.options
    }
}

impl<'de> Deserialize<'de> for TrainOccurrence {
    fn deserialize<D>(deserializer: D) -> Result<TrainOccurrence, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let train_schedule = TrainOccurrence::deserialize(deserializer)?;

        // Look for invalid path waypoint reference
        let path_ids: HashSet<_> = train_schedule.path.iter().map(|p| &p.id).collect();
        if path_ids.len() != train_schedule.path.len() {
            return Err(SerdeError::custom("Duplicate path waypoint ids"));
        }

        for schedule_item in &train_schedule.schedule {
            if !path_ids.contains(&schedule_item.at) {
                return Err(SerdeError::custom(format!(
                    "Invalid schedule, path waypoint '{}' not found",
                    schedule_item.at
                )));
            }
        }

        for boundary in &train_schedule.margins.boundaries {
            if !path_ids.contains(&boundary) {
                return Err(SerdeError::custom(format!(
                    "Invalid boundary, path waypoint '{boundary}' not found"
                )));
            }
        }

        for power_restriction in train_schedule.power_restrictions.iter() {
            if !path_ids.contains(&power_restriction.from) {
                return Err(SerdeError::custom(format!(
                    "Invalid power restriction, path waypoint '{}' not found",
                    power_restriction.from
                )));
            }
            if !path_ids.contains(&power_restriction.to) {
                return Err(SerdeError::custom(format!(
                    "Invalid power restriction, path waypoint '{}' not found",
                    power_restriction.to
                )));
            }
        }

        // Check scheduled points
        let schedules: HashMap<_, _> = train_schedule.schedule.iter().map(|s| (&s.at, s)).collect();
        if schedules.len() != train_schedule.schedule.len() {
            return Err(SerdeError::custom("Schedule points at the same location"));
        }
        let first_point_id = &train_schedule.path.first().unwrap().id;
        if schedules
            .get(first_point_id)
            .is_some_and(|s| s.arrival.is_some())
        {
            return Err(SerdeError::custom(
                "First path waypoint can't have an arrival time",
            ));
        }

        Ok(train_schedule)
    }
}

impl Serialize for TrainOccurrence {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        TrainOccurrence::serialize(self, serializer)
    }
}

#[cfg(any(test, feature = "testing"))]
impl TrainOccurrence {
    pub const FAKE_PATH_LEN: usize = 4;

    pub fn fake() -> Self {
        use crate::fixtures::ms_since_epoch;
        use crate::infra::TrackOffset;
        use crate::primitives::Identifier;

        let fake = Self {
            train_name: "ABC3615".to_string(),
            labels: vec!["choo-choo".to_string(), "tchou-tchou".to_string()],
            rolling_stock_name: "R2D2".to_string(),
            start_time: ms_since_epoch("2023-12-21T08:51:30Z"),
            path: vec![
                PathItem {
                    id: NonBlankString::from("a"),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: OperationalPointReference::Uic {
                                uic: 8711,
                                secondary_code: Some("BV".into()),
                            },
                            local_track_name: None,
                        },
                    ),
                },
                PathItem {
                    id: NonBlankString::from("b"),
                    location: PathItemLocation::TrackOffset(TrackOffset {
                        track: Identifier::from("TC0"),
                        offset: 340,
                    }),
                },
                PathItem {
                    id: NonBlankString::from("c"),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: OperationalPointReference::Domestic {
                                country_code: NonBlankString::from("FR"),
                                main_code: NonBlankString::from("MWS"),
                                secondary_code: Some("BV".into()),
                            },
                            local_track_name: None,
                        },
                    ),
                },
                PathItem {
                    id: NonBlankString::from("d"),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: OperationalPointReference::Id {
                                operational_point: Identifier::from("Mid_East_station"),
                            },
                            local_track_name: None,
                        },
                    ),
                },
            ],
            schedule: vec![
                ScheduleItem {
                    at: NonBlankString::from("a"),
                    arrival: None,
                    stop_for: Some(chrono::Duration::minutes(5).try_into().unwrap()),
                    reception_signal: ReceptionSignal::Open,
                    ..Default::default()
                },
                ScheduleItem {
                    at: NonBlankString::from("b"),
                    arrival: Some(chrono::Duration::minutes(10).try_into().unwrap()),
                    stop_for: Some(chrono::Duration::minutes(5).try_into().unwrap()),
                    reception_signal: ReceptionSignal::Open,
                    ..Default::default()
                },
                ScheduleItem {
                    at: NonBlankString::from("c"),
                    arrival: None,
                    stop_for: Some(chrono::Duration::minutes(5).try_into().unwrap()),
                    reception_signal: ReceptionSignal::Open,
                    ..Default::default()
                },
                ScheduleItem {
                    at: NonBlankString::from("d"),
                    arrival: Some(chrono::Duration::minutes(50).try_into().unwrap()),
                    stop_for: None,
                    reception_signal: ReceptionSignal::Open,
                    ..Default::default()
                },
            ],
            margins: Margins {
                boundaries: vec![NonBlankString::from("b"), NonBlankString::from("c")],
                values: vec![
                    MarginValue::Percentage(5.0),
                    MarginValue::MinPer100Km(3.0),
                    MarginValue::Percentage(0.0),
                ],
            },
            initial_speed: 2.5,
            comfort: Comfort::AirConditioning,
            constraint_distribution: Distribution::Mareco,
            speed_limit_tag: Some(NonBlankString("MA100".to_string())),
            power_restrictions: vec![PowerRestrictionItem {
                from: NonBlankString::from("b"),
                to: NonBlankString::from("c"),
                value: "M1C1".to_string(),
            }],
            options: TrainScheduleOptions {
                use_electrical_profiles: true,
                use_speed_limits_for_simulation: true,
                stops_at_end_of_block: false,
            },
            category: None,
        };

        assert_eq!(Self::FAKE_PATH_LEN, fake.path.len());

        fake
    }
}

#[cfg(test)]
mod tests {
    use chrono::Duration;
    use serde_json::from_str;
    use serde_json::to_string;

    use crate::train_schedule::Margins;
    use crate::train_schedule::PathItemLocation;
    use crate::train_schedule::ScheduleItem;
    use crate::train_schedule::TrainOccurrence;
    use crate::train_schedule::path_item::OperationalPointPartReference;
    use crate::train_schedule::path_item::OperationalPointReference::Id;
    use crate::train_schedule::schedule_item::ReceptionSignal;

    use super::PathItem;

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_duplicate_path_id_train_schedule() {
        let location =
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: Id {
                    operational_point: "op".into(),
                },
                local_track_name: None,
            });
        let path_item = PathItem {
            id: "a".into(),
            location,
        };
        let train_schedule = TrainOccurrence {
            path: vec![path_item.clone(), path_item.clone()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainOccurrence>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_schedule_point_not_found_train_schedule() {
        let train_schedule = TrainOccurrence {
            schedule: vec![Default::default()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainOccurrence>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_boundary_not_found_train_schedule() {
        let train_schedule = TrainOccurrence {
            margins: Margins {
                boundaries: vec![Default::default()],
                ..Default::default()
            },
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainOccurrence>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_power_restriction_train_schedule() {
        let train_schedule = TrainOccurrence {
            power_restrictions: vec![Default::default()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainOccurrence>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_duplicate_schedule_points_train_schedule() {
        let location =
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: Id {
                    operational_point: "op".into(),
                },
                local_track_name: None,
            });
        let path_item = PathItem {
            id: "a".into(),
            location,
        };
        let train_schedule = TrainOccurrence {
            path: vec![path_item.clone(), path_item.clone()],
            schedule: vec![
                ScheduleItem {
                    at: "a".into(),
                    arrival: None,
                    stop_for: None,
                    reception_signal: ReceptionSignal::Open,
                    ..Default::default()
                },
                ScheduleItem {
                    at: "a".into(),
                    arrival: None,
                    stop_for: None,
                    reception_signal: ReceptionSignal::Open,
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainOccurrence>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_arrival_time_first_waypoint_schedule_train_schedule() {
        let location =
            PathItemLocation::OperationalPointPartReference(OperationalPointPartReference {
                operational_point: Id {
                    operational_point: "op".into(),
                },
                local_track_name: None,
            });
        let path_item = PathItem {
            id: "a".into(),
            location,
        };
        let train_schedule = TrainOccurrence {
            path: vec![path_item.clone(), path_item.clone()],
            schedule: vec![ScheduleItem {
                at: "a".into(),
                arrival: Some(Duration::minutes(5).try_into().unwrap()),
                stop_for: None,
                reception_signal: ReceptionSignal::Open,
                ..Default::default()
            }],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainOccurrence>(&invalid_str).is_err());
    }
}
