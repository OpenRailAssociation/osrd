mod margins;
pub use margins::MarginValue;
pub use margins::Margins;

// 'pub' to remove when schemas/train_schedule.rs is deleted
pub mod schedule_item;
pub use schedule_item::ReceptionSignal;
pub use schedule_item::ScheduleItem;

// 'pub' to remove when schemas/train_schedule.rs is deleted
pub mod path_item;
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

use chrono::DateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde::de::Error as SerdeError;
use serde_with::DefaultOnNull;
use serde_with::serde_as;
use serde_with::skip_serializing_none;
use utoipa::ToSchema;
use utoipa::openapi::ObjectBuilder;
use utoipa::openapi::RefOr;
use utoipa::openapi::schema::Schema;

use crate::primitives::NonBlankString;
use crate::primitives::PositiveDuration;
use crate::rolling_stock::TrainCategory;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct Paced {
    /// Duration of the paced train, an ISO 8601 format is expected
    pub time_window: PositiveDuration,
    /// Time between two occurrences, an ISO 8601 format is expected
    pub interval: PositiveDuration,
    #[serde(default)]
    #[schema(required)]
    pub exceptions: Vec<PacedTrainException>,
}

#[serde_as]
#[derive(Debug, Clone, Serialize, PartialEq, ToSchema, Deserialize, Default)]
#[serde(remote = "Self")]
pub struct PacedTrain {
    pub train_name: String,
    #[serde(default)]
    #[serde_as(as = "DefaultOnNull")]
    pub labels: Vec<String>,
    pub rolling_stock_name: String,
    pub start_time: DateTime<Utc>,
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
    #[schema(inline)]
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
    #[schema(inline)]
    pub paced: Option<Paced>,
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

impl TrainScheduleLike for PacedTrain {
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

impl<'de> Deserialize<'de> for PacedTrain {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let paced_train = PacedTrain::deserialize(deserializer)?;

        // Look for invalid path waypoint reference
        let path_ids: HashSet<_> = paced_train.path.iter().map(|p| &p.id).collect();
        if path_ids.len() != paced_train.path.len() {
            return Err(SerdeError::custom("Duplicate path waypoint ids"));
        }

        for schedule_item in &paced_train.schedule {
            if !path_ids.contains(&schedule_item.at) {
                return Err(SerdeError::custom(format!(
                    "Invalid schedule, path waypoint '{}' not found",
                    schedule_item.at
                )));
            }
        }

        for boundary in &paced_train.margins.boundaries {
            if !path_ids.contains(&boundary) {
                return Err(SerdeError::custom(format!(
                    "Invalid boundary, path waypoint '{boundary}' not found"
                )));
            }
        }

        for power_restriction in paced_train.power_restrictions.iter() {
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
        let schedules: HashMap<_, _> = paced_train.schedule.iter().map(|s| (&s.at, s)).collect();
        if schedules.len() != paced_train.schedule.len() {
            return Err(SerdeError::custom("Schedule points at the same location"));
        }
        let first_point_id = &paced_train.path.first().unwrap().id;
        if schedules
            .get(first_point_id)
            .is_some_and(|s| s.arrival.is_some())
        {
            return Err(SerdeError::custom(
                "First path waypoint can't have an arrival time",
            ));
        }

        if let Some(ref paced) = paced_train.paced {
            let mut seen_keys = HashSet::with_capacity(paced.exceptions.len());
            for e in &paced.exceptions {
                if !seen_keys.insert(&e.key) {
                    return Err(serde::de::Error::custom(format!(
                        "Duplicate exception key: '{}'",
                        e.key
                    )));
                }
            }

            let time_window_secs = paced.time_window.num_seconds();
            let interval_secs = paced.interval.num_seconds();
            let num_occurrences = (time_window_secs / interval_secs) as usize;

            for ex in &paced.exceptions {
                if let ExceptionType::Modified { occurrence_index } = ex.exception_type
                    && occurrence_index > num_occurrences
                {
                    return Err(serde::de::Error::custom(format!(
                        "Modified exception '{}' references invalid occurrence index {}",
                        ex.key, occurrence_index,
                    )));
                }
            }
        }
        Ok(paced_train)
    }
}

impl Serialize for PacedTrain {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        PacedTrain::serialize(self, serializer)
    }
}
/// Represents an exception for a paced train occurrence.
/// Occurrences are normally generated from a base paced train.
/// An exception occurs when an occurrence is added or modified
/// compared to the base model. Each field corresponds to a "ChangeGroup" of attributes
/// that may deviate from the paced train.
/// - Created: A new occurrence manually added by the user, not originally present in the automatically generated occurrences based on the paced train.
/// - Modified: An existing occurrence that has been changed
#[skip_serializing_none]
#[serde_as]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[cfg_attr(feature = "testing", derive(Default))]
pub struct PacedTrainException {
    /// Unique key for the exception within the paced train, required and generated by the frontend.
    pub key: String,
    #[serde(flatten)]
    #[schema(inline)]
    pub exception_type: ExceptionType,
    #[serde[default]]
    #[serde_as(as = "DefaultOnNull")]
    pub disabled: bool,
    #[schema(nullable = false)]
    pub train_name: Option<TrainNameChangeGroup>,
    #[schema(nullable = false)]
    pub rolling_stock: Option<RollingStockChangeGroup>,
    #[schema(nullable = false)]
    pub rolling_stock_category: Option<RollingStockCategoryChangeGroup>,
    #[schema(nullable = false)]
    pub labels: Option<LabelsChangeGroup>,
    #[schema(nullable = false)]
    pub speed_limit_tag: Option<SpeedLimitTagChangeGroup>,
    #[schema(nullable = false)]
    pub start_time: Option<StartTimeChangeGroup>,
    #[schema(nullable = false)]
    pub constraint_distribution: Option<ConstraintDistributionChangeGroup>,
    #[schema(nullable = false)]
    pub initial_speed: Option<InitialSpeedChangeGroup>,
    #[schema(nullable = false)]
    pub options: Option<OptionsChangeGroup>,
    #[schema(nullable = false)]
    pub path_and_schedule: Option<PathAndScheduleChangeGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum ExceptionType {
    Modified { occurrence_index: usize },
    // Created is a struct variant (not unit) to allow proper deserialization with #[serde(untagged)].
    // This avoids ambiguity with an empty object `{}`.
    // Must be declared after more specific variants, as order matters for untagged enums.
    Created {},
}

#[cfg(feature = "testing")]
impl Default for ExceptionType {
    fn default() -> Self {
        ExceptionType::Created {}
    }
}

impl utoipa::PartialSchema for ExceptionType {
    fn schema() -> RefOr<Schema> {
        let modified_schema = ObjectBuilder::new()
            .property(
                "occurrence_index",
                ObjectBuilder::new().schema_type(utoipa::openapi::schema::SchemaType::Type(
                    utoipa::openapi::schema::Type::Integer,
                )),
            )
            .build();
        modified_schema.into()
    }
}

impl ToSchema for ExceptionType {}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct TrainNameChangeGroup {
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct RollingStockChangeGroup {
    pub rolling_stock_name: String,
    pub comfort: Comfort,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct RollingStockCategoryChangeGroup {
    pub value: Option<TrainCategory>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct LabelsChangeGroup {
    pub value: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct SpeedLimitTagChangeGroup {
    #[schema(inline)]
    pub value: Option<NonBlankString>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct StartTimeChangeGroup {
    pub value: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct ConstraintDistributionChangeGroup {
    pub value: Distribution,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct InitialSpeedChangeGroup {
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct OptionsChangeGroup {
    pub value: TrainScheduleOptions,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct PathAndScheduleChangeGroup {
    pub path: Vec<PathItem>,
    pub schedule: Vec<ScheduleItem>,
    pub margins: Margins,
    pub power_restrictions: Vec<PowerRestrictionItem>,
}

#[cfg(any(test, feature = "testing"))]
impl PacedTrain {
    pub fn fake(paced: Option<Paced>) -> Self {
        use crate::infra::TrackOffset;
        use crate::primitives::Identifier;

        Self {
            train_name: "ABC3615".to_string(),
            labels: vec!["choo-choo".to_string(), "tchou-tchou".to_string()],
            rolling_stock_name: "R2D2".to_string(),
            start_time: chrono::DateTime::parse_from_rfc3339("2023-12-21T08:51:30+00:00")
                .unwrap()
                .with_timezone(&Utc),
            path: vec![
                PathItem {
                    id: NonBlankString::from("a"),
                    location: PathItemLocation::OperationalPointPartReference(
                        OperationalPointPartReference {
                            operational_point: OperationalPointReference::Uic {
                                uic: 8711,
                                secondary_code: Some("BV".to_string()),
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
                            operational_point: OperationalPointReference::Trigram {
                                trigram: NonBlankString::from("MWS"),
                                secondary_code: Some("BV".to_string()),
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
                },
                ScheduleItem {
                    at: NonBlankString::from("b"),
                    arrival: Some(chrono::Duration::minutes(10).try_into().unwrap()),
                    stop_for: Some(chrono::Duration::minutes(5).try_into().unwrap()),
                    reception_signal: ReceptionSignal::Open,
                },
                ScheduleItem {
                    at: NonBlankString::from("c"),
                    arrival: None,
                    stop_for: Some(chrono::Duration::minutes(5).try_into().unwrap()),
                    reception_signal: ReceptionSignal::Open,
                },
                ScheduleItem {
                    at: NonBlankString::from("d"),
                    arrival: Some(chrono::Duration::minutes(50).try_into().unwrap()),
                    stop_for: None,
                    reception_signal: ReceptionSignal::Open,
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
            paced,
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::Duration;
    use serde_json::from_str;
    use serde_json::to_string;

    use crate::paced_train::Margins;
    use crate::paced_train::PacedTrain;
    use crate::paced_train::PathItemLocation;
    use crate::paced_train::ScheduleItem;
    use crate::paced_train::path_item::OperationalPointPartReference;
    use crate::paced_train::path_item::OperationalPointReference::Id;
    use crate::paced_train::schedule_item::ReceptionSignal;

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
        let train_schedule = PacedTrain {
            path: vec![path_item.clone(), path_item.clone()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<PacedTrain>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_schedule_point_not_found_train_schedule() {
        let train_schedule = PacedTrain {
            schedule: vec![Default::default()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<PacedTrain>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_boundary_not_found_train_schedule() {
        let train_schedule = PacedTrain {
            margins: Margins {
                boundaries: vec![Default::default()],
                ..Default::default()
            },
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<PacedTrain>(&invalid_str).is_err());
    }

    /// Test deserialize an invalid train schedule
    #[test]
    fn deserialize_power_restriction_train_schedule() {
        let train_schedule = PacedTrain {
            power_restrictions: vec![Default::default()],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<PacedTrain>(&invalid_str).is_err());
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
        let train_schedule = PacedTrain {
            path: vec![path_item.clone(), path_item.clone()],
            schedule: vec![
                ScheduleItem {
                    at: "a".into(),
                    arrival: None,
                    stop_for: None,
                    reception_signal: ReceptionSignal::Open,
                },
                ScheduleItem {
                    at: "a".into(),
                    arrival: None,
                    stop_for: None,
                    reception_signal: ReceptionSignal::Open,
                },
            ],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<PacedTrain>(&invalid_str).is_err());
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
        let train_schedule = PacedTrain {
            path: vec![path_item.clone(), path_item.clone()],
            schedule: vec![ScheduleItem {
                at: "a".into(),
                arrival: Some(Duration::minutes(5).try_into().unwrap()),
                stop_for: None,
                reception_signal: ReceptionSignal::Open,
            }],
            ..Default::default()
        };
        let invalid_str = to_string(&train_schedule).unwrap();
        assert!(from_str::<PacedTrain>(&invalid_str).is_err());
    }
}
