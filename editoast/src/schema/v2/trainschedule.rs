use std::collections::HashMap;
use std::collections::HashSet;
use std::hash::Hash;
use std::str::FromStr;

use chrono::DateTime;
use chrono::Utc;
use derivative::Derivative;
use serde::de::Error as SerdeError;
use serde::Deserialize;
use serde::Serialize;
use strum::FromRepr;
use utoipa::ToSchema;

use crate::schema::utils::Identifier;
use crate::schema::utils::NonBlankString;
use crate::schema::TrackOffset;
use editoast_common::PositiveDuration;

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
    #[schema(inline)]
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

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct PowerRestrictionItem {
    #[schema(inline)]
    pub from: NonBlankString,
    #[schema(inline)]
    pub to: NonBlankString,
    pub value: String,
}

#[derive(Debug, Derivative, Clone, Serialize, Deserialize, ToSchema, Hash)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrainScheduleOptions {
    #[derivative(Default(value = "true"))]
    #[serde(default = "default_use_electrical_profiles")]
    use_electrical_profiles: bool,
}

fn default_use_electrical_profiles() -> bool {
    true
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ScheduleItem {
    #[schema(inline)]
    pub at: NonBlankString,
    #[schema(value_type = Option<chrono::Duration>)]
    pub arrival: Option<PositiveDuration>,
    #[schema(value_type = Option<chrono::Duration>)]
    pub stop_for: Option<PositiveDuration>,
    #[serde(default)]
    pub locked: bool,
}

/// The location of a path waypoint
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Hash)]
#[serde(untagged, deny_unknown_fields)]
pub enum PathItemLocation {
    TrackOffset(#[schema(inline)] TrackOffset),
    OperationalPointId {
        /// The object id of an operational point
        #[schema(inline)]
        operational_point: Identifier,
    },
    OperationalPointDescription {
        /// The operational point trigram
        #[schema(inline)]
        trigram: NonBlankString,
        /// An optional secondary code to identify a more specific location
        secondary_code: Option<String>,
    },
    OperationalPointUic {
        /// The [UIC](https://en.wikipedia.org/wiki/List_of_UIC_country_codes) code of an operational point
        uic: u32,
        /// An optional secondary code to identify a more specific location
        secondary_code: Option<String>,
    },
}

/// A location on the path of a train
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PathItem {
    /// The unique identifier of the path item.
    /// This is used to reference path items in the train schedule.
    #[schema(inline)]
    pub id: NonBlankString,
    /// Metadata given to mark a point as wishing to be deleted by the user.
    /// It's useful for soft deleting the point (waiting to fix / remove all references)
    /// If true, the train schedule is consider as invalid and must be edited
    #[serde(default)]
    pub deleted: bool,
    #[serde(flatten)]
    #[schema(inline)]
    pub location: PathItemLocation,
}

#[derive(Debug, Clone, Serialize, Derivative, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Margins {
    #[schema(inline)]
    pub boundaries: Vec<NonBlankString>,
    #[derivative(Default(value = "vec![MarginValue::None]"))]
    /// The values of the margins. Must contains one more element than the boundaries
    /// Can be a percentage `X%`, a time in minutes per kilometer `Xmin/km` or `none`
    #[schema(value_type = Vec<String>, example = json!(["none", "5%", "2min/km"]))]
    pub values: Vec<MarginValue>,
}

impl<'de> Deserialize<'de> for Margins {
    fn deserialize<D>(deserializer: D) -> Result<Margins, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct InternalMargins {
            boundaries: Vec<NonBlankString>,
            values: Vec<MarginValue>,
        }

        let InternalMargins { boundaries, values } = InternalMargins::deserialize(deserializer)?;
        if boundaries.len() + 1 != values.len() {
            return Err(serde::de::Error::custom(
                "The number of boudaries and values must be the same",
            ));
        }
        Ok(Margins { boundaries, values })
    }
}

#[derive(Debug, Copy, Clone, Default, PartialEq, Derivative)]
#[derivative(Hash)]
pub enum MarginValue {
    #[default]
    None,
    Percentage(#[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))] f64),
    MinPerKm(#[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))] f64),
}

impl<'de> Deserialize<'de> for MarginValue {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        if value.to_lowercase() == "none" {
            return Ok(Self::None);
        }
        if value.ends_with('%') {
            let float_value = f64::from_str(value[0..value.len() - 1].trim()).map_err(|_| {
                serde::de::Error::invalid_value(
                    serde::de::Unexpected::Str(&value),
                    &"a valid float",
                )
            })?;
            if float_value <= 0.0 {
                return Err(serde::de::Error::invalid_value(
                    serde::de::Unexpected::Str(&value),
                    &"a strictly positive number",
                ));
            }
            return Ok(Self::Percentage(float_value));
        }
        if value.ends_with("min/km") {
            let float_value: f64 =
                f64::from_str(value[0..value.len() - 6].trim()).map_err(|_| {
                    serde::de::Error::invalid_value(
                        serde::de::Unexpected::Str(&value),
                        &"a valid float",
                    )
                })?;
            if float_value <= 0.0 {
                return Err(serde::de::Error::invalid_value(
                    serde::de::Unexpected::Str(&value),
                    &"a strictly positive float",
                ));
            }
            return Ok(Self::MinPerKm(float_value));
        }
        Err(serde::de::Error::custom("Margin type not recognized"))
    }
}

impl Serialize for MarginValue {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        match self {
            MarginValue::None => serializer.serialize_str("none"),
            MarginValue::Percentage(value) => serializer.serialize_str(&format!("{}%", value)),
            MarginValue::MinPerKm(value) => serializer.serialize_str(&format!("{}min/km", value)),
        }
    }
}

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, FromRepr, ToSchema, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Comfort {
    #[default]
    Standard,
    AirConditioning,
    Heating,
}

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, FromRepr, ToSchema, Hash)]
#[serde(rename_all = "UPPERCASE")]
pub enum Distribution {
    #[default]
    Standard,
    Mareco,
}

#[cfg(test)]
mod tests {
    use chrono::Duration;
    use serde_json::from_str;
    use serde_json::to_string;

    use super::MarginValue;
    use super::Margins;
    use super::PathItem;
    use super::PathItemLocation;
    use crate::schema::v2::trainschedule::ScheduleItem;
    use crate::schema::v2::trainschedule::TrainScheduleBase;

    /// Test that the `MarginValue` enum can be deserialized from a string
    #[test]
    fn deserialize_margin_value() {
        let none: MarginValue = from_str(r#""none""#).unwrap();
        assert_eq!(none, MarginValue::None);

        let percentage: MarginValue = from_str(r#""10%""#).unwrap();
        assert_eq!(percentage, MarginValue::Percentage(10.0));

        let min_per_km: MarginValue = from_str(r#""5.3min/km""#).unwrap();
        assert_eq!(min_per_km, MarginValue::MinPerKm(5.3));
    }

    /// Test invalid `MarginValue` deserialization
    #[test]
    fn deserialize_invalid_margin_value() {
        assert!(from_str::<MarginValue>(r#""3.5""#).is_err());
        assert!(from_str::<MarginValue>(r#""-5%""#).is_err());
        assert!(from_str::<MarginValue>(r#""-0.4min/km""#).is_err());
    }

    /// Test that the `MarginValue` enum can be serialized to a string
    #[test]
    fn serialize_margin_value() {
        let none = to_string(&MarginValue::None).unwrap();
        assert_eq!(none, r#""none""#);

        let percentage = to_string(&MarginValue::Percentage(10.0)).unwrap();
        assert_eq!(percentage, r#""10%""#);

        let min_per_km = to_string(&MarginValue::MinPerKm(5.3)).unwrap();
        assert_eq!(min_per_km, r#""5.3min/km""#);
    }

    /// Test that Margins deserialization checks works
    #[test]
    fn deserialize_margins() {
        let valid_margins = r#"{"boundaries":["a", "b"],"values":["none","10%","20min/km"]}"#;
        assert!(from_str::<Margins>(valid_margins).is_ok());
        let invalid_margins = r#"{"boundaries":["a"],"values":["none","10%","20min/km"]}"#;
        assert!(from_str::<Margins>(invalid_margins).is_err());
        let invalid_margins = r#"{"boundaries":["a", "b"],"values":["none","10%"]}"#;
        assert!(from_str::<Margins>(invalid_margins).is_err());
    }

    /// Test deserialize a valid train schedule example
    #[test]
    fn deserialize_train_schedule() {
        let train_schedule = include_str!("../../tests/train_schedules/simple.json");
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
                },
                ScheduleItem {
                    at: "a".into(),
                    arrival: None,
                    stop_for: None,
                    locked: false,
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
            }],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<TrainScheduleBase>(&invalid_str).is_err());
    }
}
