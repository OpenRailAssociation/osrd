mod margins;
pub use margins::MarginValue;
pub use margins::Margins;

mod schedule_item;
pub use schedule_item::ReceptionSignal;
pub use schedule_item::ScheduleItem;

mod path_item;
pub use path_item::OperationalPointIdentifier;
pub use path_item::OperationalPointReference;
pub use path_item::PathItem;
pub use path_item::PathItemLocation;
pub use path_item::TrackReference;

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

use chrono::DateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use serde::de::Error as SerdeError;
use utoipa::ToSchema;

use crate::primitives::NonBlankString;
use crate::rolling_stock::TrainCategory;

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(remote = "Self")]
pub struct TrainSchedule {
    pub train_name: String,
    #[serde(default)]
    pub labels: Vec<String>,
    pub rolling_stock_name: String,
    pub start_time: DateTime<Utc>,
    #[schema(inline)]
    pub path: Vec<PathItem>,
    #[schema(inline)]
    #[serde(default)]
    pub schedule: Vec<ScheduleItem>,
    #[schema(inline)]
    #[serde(default)]
    pub margins: Margins,
    #[serde(default)]
    pub initial_speed: f64,
    #[serde(default)]
    pub comfort: Comfort,
    pub constraint_distribution: Distribution,
    #[schema(inline)]
    #[serde(default)]
    pub speed_limit_tag: Option<NonBlankString>,
    #[schema(inline)]
    #[serde(default)]
    pub power_restrictions: Vec<PowerRestrictionItem>,
    #[schema(inline)]
    #[serde(default)]
    pub options: TrainScheduleOptions,
    pub category: Option<TrainCategory>,
}

pub trait TrainScheduleLike: Clone + Send + Sync + 'static {
    fn rolling_stock_name(&self) -> &str;
    fn start_time(&self) -> DateTime<Utc>;
    fn path(&self) -> &[PathItem];
    fn schedule(&self) -> &[ScheduleItem];
    fn margins(&self) -> &Margins;
    fn initial_speed(&self) -> f64;
    fn comfort(&self) -> Comfort;
    fn constraint_distribution(&self) -> Distribution;
    fn speed_limit_tag(&self) -> Option<&String>;
    fn power_restrictions(&self) -> &[PowerRestrictionItem];
    fn options(&self) -> &TrainScheduleOptions;
}

impl TrainScheduleLike for TrainSchedule {
    fn rolling_stock_name(&self) -> &str {
        &self.rolling_stock_name
    }

    fn start_time(&self) -> DateTime<Utc> {
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

impl<'de> Deserialize<'de> for TrainSchedule {
    fn deserialize<D>(deserializer: D) -> Result<TrainSchedule, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let train_schedule = TrainSchedule::deserialize(deserializer)?;

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

impl Serialize for TrainSchedule {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        TrainSchedule::serialize(self, serializer)
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
    use crate::train_schedule::TrainSchedule;
    use crate::train_schedule::path_item::OperationalPointIdentifier::OperationalPointId;
    use crate::train_schedule::path_item::OperationalPointReference;
    use crate::train_schedule::schedule_item::ReceptionSignal;

    use super::PathItem;

    /// Test deserialize a valid train schedule example
    #[test]
    fn deserialize_train_schedule() {
        let train_schedule = include_str!("./tests/train_schedule_simple.json");
        assert!(from_str::<TrainSchedule>(train_schedule).is_ok());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_duplicate_path_id_train_schedule() {
        let location = PathItemLocation::OperationalPointReference(OperationalPointReference {
            reference: OperationalPointId {
                operational_point: "op".into(),
            },
            track_reference: None,
        });
        let path_item = PathItem {
            id: "a".into(),
            location,
            deleted: false,
        };
        let train_schedule = TrainSchedule {
            path: vec![path_item.clone(), path_item.clone()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainSchedule>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_schedule_point_not_found_train_schedule() {
        let train_schedule = TrainSchedule {
            schedule: vec![Default::default()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainSchedule>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_boundary_not_found_train_schedule() {
        let train_schedule = TrainSchedule {
            margins: Margins {
                boundaries: vec![Default::default()],
                ..Default::default()
            },
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainSchedule>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_power_restriction_train_schedule() {
        let train_schedule = TrainSchedule {
            power_restrictions: vec![Default::default()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainSchedule>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_duplicate_schedule_points_train_schedule() {
        let location = PathItemLocation::OperationalPointReference(OperationalPointReference {
            reference: OperationalPointId {
                operational_point: "op".into(),
            },
            track_reference: None,
        });
        let path_item = PathItem {
            id: "a".into(),
            location,
            deleted: false,
        };
        let train_schedule = TrainSchedule {
            path: vec![path_item.clone(), path_item.clone()],
            schedule: vec![
                ScheduleItem {
                    at: "a".into(),
                    arrival: None,
                    stop_for: None,
                    locked: false,
                    reception_signal: ReceptionSignal::Open,
                },
                ScheduleItem {
                    at: "a".into(),
                    arrival: None,
                    stop_for: None,
                    locked: false,
                    reception_signal: ReceptionSignal::Open,
                },
            ],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainSchedule>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_arrival_time_first_waypoint_schedule_train_schedule() {
        let location = PathItemLocation::OperationalPointReference(OperationalPointReference {
            reference: OperationalPointId {
                operational_point: "op".into(),
            },
            track_reference: None,
        });
        let path_item = PathItem {
            id: "a".into(),
            location,
            deleted: false,
        };
        let train_schedule = TrainSchedule {
            path: vec![path_item.clone(), path_item.clone()],
            schedule: vec![ScheduleItem {
                at: "a".into(),
                arrival: Some(Duration::minutes(5).try_into().unwrap()),
                stop_for: None,
                locked: false,
                reception_signal: ReceptionSignal::Open,
            }],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainSchedule>(&invalid_str).is_err());
    }
}
