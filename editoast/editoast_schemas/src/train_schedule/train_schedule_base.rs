use std::collections::HashMap;
use std::collections::HashSet;

use crate::primitives::NonBlankString;
use chrono::DateTime;
use chrono::Utc;
use serde::de::Error as SerdeError;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::Comfort;
use super::Distribution;
use super::Margins;
use super::PathItem;
use super::PowerRestrictionItem;
use super::ScheduleItem;
use super::TrainScheduleOptions;

editoast_common::schemas! {
    TrainScheduleBase,
}

#[derive(Debug, Default, Clone, Serialize, ToSchema)]
pub struct TrainScheduleBase {
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
}

impl<'de> Deserialize<'de> for TrainScheduleBase {
    fn deserialize<D>(deserializer: D) -> Result<TrainScheduleBase, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Internal {
            train_name: String,
            #[serde(default)]
            labels: Vec<String>,
            rolling_stock_name: String,
            start_time: DateTime<Utc>,
            path: Vec<PathItem>,
            #[serde(default)]
            schedule: Vec<ScheduleItem>,
            #[serde(default)]
            margins: Margins,
            #[serde(default)]
            initial_speed: f64,
            #[serde(default)]
            comfort: Comfort,
            constraint_distribution: Distribution,
            #[serde(default)]
            speed_limit_tag: Option<NonBlankString>,
            #[serde(default)]
            power_restrictions: Vec<PowerRestrictionItem>,
            #[serde(default)]
            options: TrainScheduleOptions,
        }
        let internal = Internal::deserialize(deserializer)?;

        // Look for invalid path waypoint reference
        let path_ids: HashSet<_> = internal.path.iter().map(|p| &p.id).collect();
        if path_ids.len() != internal.path.len() {
            return Err(SerdeError::custom("Duplicate path waypoint ids"));
        }

        for schedule_item in &internal.schedule {
            if !path_ids.contains(&schedule_item.at) {
                return Err(SerdeError::custom(format!(
                    "Invalid schedule, path waypoint '{}' not found",
                    schedule_item.at
                )));
            }
        }

        for boundary in &internal.margins.boundaries {
            if !path_ids.contains(&boundary) {
                return Err(SerdeError::custom(format!(
                    "Invalid boundary, path waypoint '{}' not found",
                    boundary
                )));
            }
        }

        for power_restriction in internal.power_restrictions.iter() {
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
        let schedules: HashMap<_, _> = internal.schedule.iter().map(|s| (&s.at, s)).collect();
        if schedules.len() != internal.schedule.len() {
            return Err(SerdeError::custom("Schedule points at the same location"));
        }
        let first_point_id = &internal.path.first().unwrap().id;
        if schedules
            .get(first_point_id)
            .map_or(false, |s| s.arrival.is_some())
        {
            return Err(SerdeError::custom(
                "First path waypoint can't have an arrival time",
            ));
        }

        Ok(TrainScheduleBase {
            train_name: internal.train_name,
            labels: internal.labels,
            rolling_stock_name: internal.rolling_stock_name,
            start_time: internal.start_time,
            path: internal.path,
            schedule: internal.schedule,
            margins: internal.margins,
            initial_speed: internal.initial_speed,
            comfort: internal.comfort,
            constraint_distribution: internal.constraint_distribution,
            speed_limit_tag: internal.speed_limit_tag,
            power_restrictions: internal.power_restrictions,
            options: internal.options,
        })
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
    use crate::train_schedule::TrainScheduleBase;

    use super::PathItem;

    /// Test deserialize a valid train schedule example
    #[test]
    fn deserialize_train_schedule() {
        let train_schedule = include_str!("../tests/train_schedule_simple.json");
        assert!(from_str::<TrainScheduleBase>(train_schedule).is_ok());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_duplicate_path_id_train_schedule() {
        let location = PathItemLocation::OperationalPointId {
            operational_point: "op".into(),
        };
        let path_item = PathItem {
            id: "a".into(),
            location,
            deleted: false,
        };
        let train_schedule = TrainScheduleBase {
            path: vec![path_item.clone(), path_item.clone()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainScheduleBase>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_schedule_point_not_found_train_schedule() {
        let train_schedule = TrainScheduleBase {
            schedule: vec![Default::default()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainScheduleBase>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_boundary_not_found_train_schedule() {
        let train_schedule = TrainScheduleBase {
            margins: Margins {
                boundaries: vec![Default::default()],
                ..Default::default()
            },
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainScheduleBase>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_power_restriction_train_schedule() {
        let train_schedule = TrainScheduleBase {
            power_restrictions: vec![Default::default()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainScheduleBase>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_duplicate_schedule_points_train_schedule() {
        let location = PathItemLocation::OperationalPointId {
            operational_point: "op".into(),
        };
        let path_item = PathItem {
            id: "a".into(),
            location,
            deleted: false,
        };
        let train_schedule = TrainScheduleBase {
            path: vec![path_item.clone(), path_item.clone()],
            schedule: vec![
                ScheduleItem {
                    at: "a".into(),
                    arrival: None,
                    stop_for: None,
                    locked: false,
                    on_stop_signal: false,
                },
                ScheduleItem {
                    at: "a".into(),
                    arrival: None,
                    stop_for: None,
                    locked: false,
                    on_stop_signal: false,
                },
            ],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainScheduleBase>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_arrival_time_first_waypoint_schedule_train_schedule() {
        let location = PathItemLocation::OperationalPointId {
            operational_point: "op".into(),
        };
        let path_item = PathItem {
            id: "a".into(),
            location,
            deleted: false,
        };
        let train_schedule = TrainScheduleBase {
            path: vec![path_item.clone(), path_item.clone()],
            schedule: vec![ScheduleItem {
                at: "a".into(),
                arrival: Some(Duration::minutes(5).try_into().unwrap()),
                stop_for: None,
                locked: false,
                on_stop_signal: false,
            }],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainScheduleBase>(&invalid_str).is_err());
    }
}
