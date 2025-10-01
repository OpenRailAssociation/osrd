use crate::primitives::NonBlankString;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::primitives::PositiveDuration;

/// State of the signal where the train is received for its stop.
/// For (important) details, see <https://osrd.fr/en/docs/reference/design-docs/timetable/#modifiable-fields>.
#[derive(Default, Debug, Hash, Copy, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReceptionSignal {
    #[default]
    Open,
    Stop,
    ShortSlipStop,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
#[serde(remote = "Self")]
pub struct ScheduleItem {
    /// Position on the path of the schedule item.
    #[schema(inline)]
    pub at: NonBlankString,
    /// The expected arrival time at the stop.
    /// This will be used to compute the final simulation time.
    pub arrival: Option<PositiveDuration>,
    /// Duration of the stop.
    /// Can be `None` if the train does not stop.
    /// If `None`, `reception_signal` must be `Open`.
    /// `Some("PT0S")` means the train stops for 0 seconds.
    pub stop_for: Option<PositiveDuration>,
    #[serde(default)]
    pub reception_signal: ReceptionSignal,
    /// Whether the schedule item is locked (only for display purposes)
    #[serde(default)]
    pub locked: bool,
}

#[cfg(feature = "testing")]
impl ScheduleItem {
    pub fn new_with_stop(at: &str, duration: chrono::Duration) -> Self {
        Self {
            at: at.into(),
            arrival: None,
            stop_for: Some(PositiveDuration::new(duration)),
            reception_signal: ReceptionSignal::Open,
            locked: false,
        }
    }
}

impl<'de> Deserialize<'de> for ScheduleItem {
    fn deserialize<D>(deserializer: D) -> Result<ScheduleItem, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let schedule_item = ScheduleItem::deserialize(deserializer)?;
        // Check that the reception_signal is Open if stop_for duration is None
        if schedule_item.reception_signal != ReceptionSignal::Open
            && schedule_item.stop_for.is_none()
        {
            return Err(serde::de::Error::custom(
                "Field reception_signal must be `Open` if stop_for is None",
            ));
        }
        Ok(schedule_item)
    }
}

impl Serialize for ScheduleItem {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        ScheduleItem::serialize(self, serializer)
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
