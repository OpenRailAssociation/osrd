//! Serde support for `jiff::SignedDuration` using the ISO 8601 duration format.
//!
//! **Note**: Years and months are not supported.
//!
//! ```
//! use serde::{Serialize, Deserialize};
//! use schemas::primitives::duration;
//! use schemas::primitives::PositiveDuration;
//!
//! #[derive(Serialize, Deserialize)]
//! struct MyStruct {
//!     #[serde(with = "schemas::primitives::duration")] // <- Add this line
//!     duration: PositiveDuration
//! }
//!
//! let my_struct = MyStruct {
//!     duration: jiff::SignedDuration::from_hours(1).try_into().unwrap(),
//! };
//! let s = serde_json::to_string(&my_struct).unwrap();
//! let my_struct: MyStruct = serde_json::from_str(&s).unwrap();
//! assert_eq!(my_struct.duration.as_secs(), 3600);
//!
//! let err_s = r#"{"duration":"P1M"}"#; // 1 month
//! assert!(serde_json::from_str::<MyStruct>(err_s).is_err());
//! ```

use std::ops::Deref;
use std::str::FromStr as _;

use diesel::pg::data_types::PgInterval;
use iso8601::Duration as IsoDuration;
use jiff::SignedDuration as JiffDuration;
use jiff::Span;
use jiff::SpanRelativeTo;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::ToSchema;
use utoipa::openapi::ObjectBuilder;
use utoipa::openapi::RefOr;
use utoipa::openapi::Schema;

#[derive(Debug, Error)]
pub enum PositiveDurationError {
    #[error("Negative duration provided")]
    NegativeDuration,
    #[error("Duration with years or months privided")]
    MonthsUnsupported,
}

/// Wrapper for `jiff::SignedDuration` to use with Serde.
/// This is useful to serialize `jiff::SignedDuration` using the ISO 8601 duration format.
///
/// ```
/// use serde::{Serialize, Deserialize};
/// use schemas::primitives::PositiveDuration;
///
/// #[derive(Serialize, Deserialize)]
/// struct MyStruct {
///     duration: PositiveDuration
/// }
///
/// let my_struct = MyStruct {
///     duration: jiff::SignedDuration::from_hours(1).try_into().unwrap(),
/// };
/// let s = serde_json::to_string(&my_struct).unwrap();
/// let my_struct: MyStruct = serde_json::from_str(&s).unwrap();
/// assert_eq!(my_struct.duration.as_secs(), 3600);
///
/// let err_s = r#"{"duration":"P1M"}"#; // 1 month
/// assert!(serde_json::from_str::<MyStruct>(err_s).is_err());
/// ```
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PositiveDuration(JiffDuration);

#[cfg(feature = "testing")]
impl PositiveDuration {
    pub fn new(duration: JiffDuration) -> Self {
        assert!(!duration.is_negative(), "Duration must be non-negative");
        Self(duration)
    }
}

impl Default for PositiveDuration {
    fn default() -> Self {
        PositiveDuration(JiffDuration::ZERO)
    }
}

/// Custom implementation of `ToSchema` for `PositiveDuration`
/// is required because the current version of `utoipa`
/// does not support adding a `description` attribute
/// directly via `#[derive(ToSchema)]`.
///
/// TODO: Upgrade `utoipa` to version 5.3.1 or later to
impl utoipa::PartialSchema for PositiveDuration {
    fn schema() -> RefOr<Schema> {
        ObjectBuilder::new()
            .schema_type(utoipa::openapi::schema::SchemaType::Type(
                utoipa::openapi::schema::Type::String,
            ))
            .format(Some(utoipa::openapi::SchemaFormat::KnownFormat(
                utoipa::openapi::KnownFormat::Duration,
            )))
            .description(Some("Duration in ISO 8601 format (e.g. PT2H for 2 hours)"))
            .examples([serde_json::Value::String("PT2H".to_string())])
            .build()
            .into()
    }
}

impl ToSchema for PositiveDuration {}

impl TryFrom<JiffDuration> for PositiveDuration {
    type Error = PositiveDurationError;
    /// Create PositiveDuration from `jiff::SignedDuration`
    /// This function errors when the given duration is negative
    fn try_from(duration: JiffDuration) -> Result<Self, PositiveDurationError> {
        if duration.is_negative() {
            return Err(PositiveDurationError::NegativeDuration);
        }
        Ok(PositiveDuration(duration))
    }
}

impl TryFrom<PgInterval> for PositiveDuration {
    type Error = PositiveDurationError;
    /// Create PositiveDuration from `diesel::pg::data_types::PgInterval`
    /// This function errors when the given duration is negative or when
    /// PgInterval has a months component.
    fn try_from(interval: PgInterval) -> Result<Self, PositiveDurationError> {
        let duration = pg_interval_to_jiff_duration(interval)?;
        if duration.is_negative() {
            return Err(PositiveDurationError::NegativeDuration);
        }
        Ok(PositiveDuration(duration))
    }
}

impl From<PositiveDuration> for JiffDuration {
    fn from(duration: PositiveDuration) -> Self {
        duration.0
    }
}

impl Deref for PositiveDuration {
    type Target = JiffDuration;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Serialize for PositiveDuration {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serialize(&self.0, serializer)
    }
}

impl<'de> Deserialize<'de> for PositiveDuration {
    fn deserialize<D>(deserializer: D) -> Result<PositiveDuration, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserialize(deserializer)
    }
}

/// Serialize a `jiff::SignedDuration` using the ISO 8601 duration format.
pub fn serialize<S>(duration: &JiffDuration, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&duration.to_string())
}

/// Deserialize a `jiff::SignedDuration` from an ISO 8601 duration string.
pub fn deserialize<'de, D>(deserializer: D) -> Result<PositiveDuration, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    let iso_dur = IsoDuration::from_str(&s).map_err(serde::de::Error::custom)?;
    Ok(PositiveDuration(match iso_dur {
        IsoDuration::YMDHMS {
            year,
            month,
            day,
            hour,
            minute,
            second,
            millisecond,
        } => {
            if year != 0 || month != 0 {
                return Err(serde::de::Error::custom(
                    "years and months are not supported",
                ));
            }
            JiffDuration::try_from_hours(day as i64 * 24)
                .ok_or_else(|| serde::de::Error::custom("value for days is not valid"))?
                + JiffDuration::try_from_hours(hour as i64)
                    .ok_or_else(|| serde::de::Error::custom("value for hours is not valid"))?
                + JiffDuration::try_from_mins(minute as i64)
                    .ok_or_else(|| serde::de::Error::custom("value for minutes is not valid"))?
                + JiffDuration::from_secs(second as i64)
                + JiffDuration::from_millis(millisecond as i64)
        }
        IsoDuration::Weeks(weeks) => Span::new()
            .try_weeks(weeks as i64)
            .and_then(|span| span.to_duration(SpanRelativeTo::days_are_24_hours()))
            .map_err(|_e| serde::de::Error::custom("value for weeks is not valid"))?,
    }))
}

/// Variant of [`PositiveDuration`] that also requires the duration to be at least 1 millisecond.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StrictlyPositiveDuration(JiffDuration);

impl utoipa::PartialSchema for StrictlyPositiveDuration {
    fn schema() -> RefOr<Schema> {
        PositiveDuration::schema()
    }
}

impl ToSchema for StrictlyPositiveDuration {}

impl Serialize for StrictlyPositiveDuration {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serialize(&self.0, serializer)
    }
}

impl<'de> Deserialize<'de> for StrictlyPositiveDuration {
    fn deserialize<D>(deserializer: D) -> Result<StrictlyPositiveDuration, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let duration = deserialize(deserializer)?;
        if duration.as_millis() == 0 {
            return Err(serde::de::Error::custom("duration cannot be zero"));
        }
        Ok(StrictlyPositiveDuration(duration.0))
    }
}

impl TryFrom<JiffDuration> for StrictlyPositiveDuration {
    type Error = PositiveDurationError;
    /// Create StrictlyPositiveDuration from `jiff::SignedDuration`
    /// This function errors when the given duration is negative or null.
    fn try_from(duration: JiffDuration) -> Result<Self, PositiveDurationError> {
        if duration.as_millis() <= 0 {
            return Err(PositiveDurationError::NegativeDuration);
        }
        Ok(StrictlyPositiveDuration(duration))
    }
}

impl TryFrom<PgInterval> for StrictlyPositiveDuration {
    type Error = PositiveDurationError;
    /// Create PositiveDuration from `diesel::pg::data_types::PgInterval`
    ///
    /// This function errors when the given duration is negative or when
    /// PgInterval has a months component.
    fn try_from(interval: PgInterval) -> Result<Self, PositiveDurationError> {
        let duration = pg_interval_to_jiff_duration(interval)?;
        if duration.as_millis() <= 0 {
            return Err(PositiveDurationError::NegativeDuration);
        }
        Ok(StrictlyPositiveDuration(duration))
    }
}

impl From<StrictlyPositiveDuration> for JiffDuration {
    fn from(duration: StrictlyPositiveDuration) -> Self {
        duration.0
    }
}

impl From<StrictlyPositiveDuration> for PgInterval {
    fn from(duration: StrictlyPositiveDuration) -> Self {
        jiff_duration_to_pg_interval(duration.into())
    }
}

pub fn pg_interval_to_jiff_duration(
    interval: PgInterval,
) -> Result<JiffDuration, PositiveDurationError> {
    if interval.months != 0 {
        return Err(PositiveDurationError::MonthsUnsupported);
    }
    let hours = (interval.days as i64) * 24;
    Ok(JiffDuration::from_hours(hours) + JiffDuration::from_micros(interval.microseconds))
}

pub fn jiff_duration_to_pg_interval(duration: JiffDuration) -> PgInterval {
    let days = duration.as_hours() / 24;
    let microsecs = (duration - JiffDuration::from_hours(days * 24)).as_micros();
    PgInterval::new(microsecs as i64, days as i32, 0)
}

#[cfg(test)]
mod tests {
    use serde::Deserialize;
    use serde::Serialize;
    use serde_json::from_str;
    use serde_json::to_string;

    use super::PositiveDuration;

    #[derive(Serialize, Deserialize)]
    struct MyStruct {
        duration: PositiveDuration,
    }

    /// Test the serialization and deserialization
    #[test]
    fn serialize_deserialize_works() {
        let my_struct = MyStruct {
            duration: jiff::SignedDuration::from_hours(1).try_into().unwrap(),
        };
        let s = to_string(&my_struct).unwrap();
        let my_struct: MyStruct = from_str(&s).unwrap();
        assert_eq!(my_struct.duration.as_secs(), 3600);
    }

    /// Test invalid deserialization
    #[test]
    fn invalid_deserialize() {
        let s = r#"{"duration":"P1M"}"#; // 1 month
        assert!(from_str::<MyStruct>(s).is_err());
    }
}
