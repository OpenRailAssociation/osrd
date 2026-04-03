use std::collections::HashSet;

use chrono::DateTime;
use chrono::Duration;
use chrono::Utc;
use serde::Deserialize;
use serde::Deserializer;
use serde::Serialize;
use serde_with::DefaultOnNull;
use serde_with::serde_as;
use serde_with::skip_serializing_none;
use utoipa::ToSchema;
use utoipa::openapi::ObjectBuilder;
use utoipa::openapi::RefOr;
use utoipa::openapi::schema::Schema;

use crate::TrainScheduleExceptionChangeGroups;
use crate::primitives::NonBlankString;
use crate::primitives::PositiveDuration;
use crate::rolling_stock::TrainCategory;
use crate::train_schedule::Comfort;
use crate::train_schedule::Distribution;
use crate::train_schedule::Margins;
use crate::train_schedule::PathItem;
use crate::train_schedule::PowerRestrictionItem;
use crate::train_schedule::ScheduleItem;
use crate::train_schedule::TrainOccurrence;
use crate::train_schedule::TrainScheduleOptions;

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

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(remote = "Self")]
pub struct TrainSchedule {
    #[serde(flatten)]
    #[schema(inline)]
    pub train_occurrence: TrainOccurrence,
    #[schema(inline)]
    pub paced: Option<Paced>,
}

impl<'de> Deserialize<'de> for TrainSchedule {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let train_schedule = TrainSchedule::deserialize(deserializer)?;

        // Schedule item, if on the first path item, shouldn’t have an arrival
        // time different of zero (the start time of the train occurrence)
        let arrival_time_on_first_path_item = train_schedule
            .train_occurrence
            .schedule
            .iter()
            .find(|schedule_item| {
                train_schedule
                    .train_occurrence
                    .path
                    .first()
                    .is_some_and(|path_item| schedule_item.at == path_item.id)
            })
            .and_then(|ScheduleItem { arrival, .. }| arrival.as_deref().copied());
        if let Some(arrival) = arrival_time_on_first_path_item
            && arrival != Duration::seconds(0)
        {
            return Err(serde::de::Error::custom(format!(
                "Scheduled arrival time on the origin of the path is necessary 0 seconds, but is: '{}'",
                arrival.num_seconds()
            )));
        }
        // Check integrity of the pace in the train schedule
        if let Some(ref paced) = train_schedule.paced {
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
            // Ideally, we’d use `div_ceil` which is nightly-only at the time of writing
            // https://doc.rust-lang.org/std/primitive.i64.html#method.div_ceil
            let num_occurrences = (time_window_secs / interval_secs) as usize
                + if time_window_secs.rem_euclid(interval_secs) != 0 {
                    1
                } else {
                    0
                };

            for ex in &paced.exceptions {
                if let ExceptionType::Modified { occurrence_index } = ex.exception_type
                    && occurrence_index >= num_occurrences
                {
                    return Err(serde::de::Error::custom(format!(
                        "Modified exception '{}' references invalid occurrence index {}",
                        ex.key, occurrence_index,
                    )));
                }
            }
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
    #[serde(flatten)]
    #[schema(inline)]
    pub change_groups: TrainScheduleExceptionChangeGroups,
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
