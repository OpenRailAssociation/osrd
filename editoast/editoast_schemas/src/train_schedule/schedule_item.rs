use crate::primitives::NonBlankString;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::PositiveDuration;

editoast_common::schemas! {
    ScheduleItem,
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
    /// `Some("PT0S")` means the train stops for 0 seconds.
    #[schema(value_type = Option<chrono::Duration>)]
    pub stop_for: Option<PositiveDuration>,
    /// Whether the next signal is expected to be blocking while stopping
    /// Can be true only if `stop_for` is `Some`
    #[serde(default)]
    pub on_stop_signal: bool,
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
            pub on_stop_signal: bool,
            #[serde(default)]
            pub locked: bool,
        }
        let internal = Internal::deserialize(deserializer)?;

        // Check that the stop_for duration is not None if on_stop_signal is true
        if internal.on_stop_signal && internal.stop_for.is_none() {
            return Err(serde::de::Error::custom(
                "Field on_stop_signal can be true only if stop_for is Some",
            ));
        }

        Ok(Self {
            at: internal.at,
            arrival: internal.arrival,
            stop_for: internal.stop_for,
            on_stop_signal: internal.on_stop_signal,
            locked: internal.locked,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::ScheduleItem;

    use serde_json::from_str;
    use serde_json::to_string;

    #[test]
    fn desserialize_schedule_item_error() {
        let schedule_item = ScheduleItem {
            at: "a".into(),
            arrival: None,
            stop_for: None,
            on_stop_signal: true,
            locked: false,
        };
        let invalid_str = to_string(&schedule_item).unwrap();
        assert!(from_str::<ScheduleItem>(&invalid_str).is_err());
    }
}
