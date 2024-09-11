use crate::primitives::NonBlankString;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::PositiveDuration;

editoast_common::schemas! {
    ScheduleItem,
    ReceptionSignal,
}

/// State of the signal where the train is received for its stop.
/// For (important) details, see https://osrd.fr/en/docs/reference/design-docs/timetable/#modifiable-fields.
#[derive(Default, Debug, Hash, Copy, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReceptionSignal {
    #[default]
    Open,
    Stop,
    ShortSlipStop,
}

#[derive(Debug, Default, Clone, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ScheduleItem {
    /// Position on the path of the schedule item.
    #[schema(inline)]
    pub at: NonBlankString,
    /// The expected arrival time at the stop.
    /// This will be used to compute the final simulation time.
    #[schema(value_type = Option<chrono::Duration>)]
    pub arrival: Option<PositiveDuration>,
    /// Duration of the stop.
    /// Can be `None` if the train does not stop.
    /// If `None`, `reception_signal` must be `Open`.
    /// `Some("PT0S")` means the train stops for 0 seconds.
    #[schema(value_type = Option<chrono::Duration>)]
    pub stop_for: Option<PositiveDuration>,
    #[serde(default)]
    pub reception_signal: ReceptionSignal,
    /// Whether the schedule item is locked (only for display purposes)
    #[serde(default)]
    pub locked: bool,
}

impl<'de> Deserialize<'de> for ScheduleItem {
    fn deserialize<D>(deserializer: D) -> Result<ScheduleItem, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Internal {
            pub at: NonBlankString,
            pub arrival: Option<PositiveDuration>,
            pub stop_for: Option<PositiveDuration>,
            #[serde(default)]
            pub reception_signal: ReceptionSignal,
            #[serde(default)]
            pub locked: bool,
        }
        let internal = Internal::deserialize(deserializer)?;

        // Check that the reception_signal is Open if stop_for duration is None
        if internal.reception_signal != ReceptionSignal::Open && internal.stop_for.is_none() {
            return Err(serde::de::Error::custom(
                "Field reception_signal must be `Open` if stop_for is None",
            ));
        }

        Ok(Self {
            at: internal.at,
            arrival: internal.arrival,
            stop_for: internal.stop_for,
            reception_signal: internal.reception_signal,
            locked: internal.locked,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::ReceptionSignal;
    use super::ScheduleItem;

    use serde_json::from_str;
    use serde_json::to_string;

    #[test]
    fn desserialize_schedule_item_error() {
        let schedule_item = ScheduleItem {
            at: "a".into(),
            arrival: None,
            stop_for: None,
            reception_signal: ReceptionSignal::Stop,
            locked: false,
        };
        let invalid_str = to_string(&schedule_item).unwrap();
        assert!(from_str::<ScheduleItem>(&invalid_str).is_err());
    }
}
