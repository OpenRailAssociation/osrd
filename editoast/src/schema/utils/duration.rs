//! Serde support for `chrono::Duration` using the ISO 8601 duration format.
//!
//! **Note**: Years and months are not supported.
//!
//! ```
//! use chrono::Duration;
//! use serde::{Serialize, Deserialize};
//!
//! #[derive(Serialize, Deserialize)]
//! struct MyStruct {
//!     #[serde(with = "crate::schema::utils::duration")] // <- Add this line
//!     duration: Duration
//! }
//!
//! let s = r#"{"duration":"PT1H"}"#; // 1 hour
//! let my_struct: MyStruct = serde_json::from_str(s).unwrap();
//! assert_eq!(my_struct.duration.num_seconds(), 3600);
//! assert_eq!(r#"{"duration":"PT3600S"}"#, serde_json::to_string(&my_struct).unwrap());
//!
//! let err_s = r#"{"duration":"P1M"}"#; // 1 month
//! assert!(serde_json::from_str::<MyStruct>(err_s).is_err());
//! ```

use std::ops::Deref;
use std::str::FromStr;

use chrono::Duration as ChronoDuration;
use iso8601::Duration as IsoDuration;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PositiveDurationError {
    #[error("Negative duration provided")]
    NegativeDuration,
}

/// Wrapper for `chrono::Duration` to use with Serde.
/// This is useful to serialize `chrono::Duration` using the ISO 8601 duration format.
///
/// ```
/// use serde::{Serialize, Deserialize};
/// use crate::schema::utils::duration::PositiveDuration;
///
/// #[derive(Serialize, Deserialize)]
/// struct MyStruct {
///     duration: PositiveDuration
/// }
///
/// let s = r#"{"duration":"PT1H"}"#; // 1 hour
/// let my_struct: MyStruct = serde_json::from_str(s).unwrap();
/// assert_eq!(my_struct.duration.num_seconds(), 3600);
/// assert_eq!(r#"{"duration":"PT3600S"}"#, serde_json::to_string(&my_struct).unwrap());
///
/// let err_s = r#"{"duration":"P1M"}"#; // 1 month
/// assert!(serde_json::from_str::<MyStruct>(err_s).is_err());
/// ```
#[derive(Debug, Clone)]
pub struct PositiveDuration(ChronoDuration);

impl TryFrom<ChronoDuration> for PositiveDuration {
    type Error = PositiveDurationError;
    /// Create PositiveDuration from `chrono::Duration``
    /// This function errors when the given duration is negative
    /// The created PositiveDuration is limited to 1 millisecond
    fn try_from(duration: ChronoDuration) -> Result<Self, PositiveDurationError> {
        let milli_sec = duration.num_milliseconds();
        if milli_sec < 0 {
            return Err(PositiveDurationError::NegativeDuration);
        }
        Ok(PositiveDuration(ChronoDuration::milliseconds(milli_sec)))
    }
}

impl From<PositiveDuration> for ChronoDuration {
    fn from(duration: PositiveDuration) -> Self {
        duration.0
    }
}

impl Deref for PositiveDuration {
    type Target = ChronoDuration;

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
        deserialize(deserializer).map(PositiveDuration)
    }
}

/// Serialize a `chrono::Duration` using the ISO 8601 duration format.
pub fn serialize<S>(duration: &ChronoDuration, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&duration.to_string())
}

/// Deserialize a `chrono::Duration` from an ISO 8601 duration string.
pub fn deserialize<'de, D>(deserializer: D) -> Result<ChronoDuration, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    let iso_dur = IsoDuration::from_str(&s).map_err(serde::de::Error::custom)?;
    Ok(match iso_dur {
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
            ChronoDuration::try_days(day as i64)
                .ok_or_else(|| serde::de::Error::custom("value for days is not valid"))?
                + ChronoDuration::try_hours(hour as i64)
                    .ok_or_else(|| serde::de::Error::custom("value for hours is not valid"))?
                + ChronoDuration::try_minutes(minute as i64)
                    .ok_or_else(|| serde::de::Error::custom("value for minutes is not valid"))?
                + ChronoDuration::try_seconds(second as i64)
                    .ok_or_else(|| serde::de::Error::custom("value for seconds is not valid"))?
                + ChronoDuration::try_milliseconds(millisecond as i64)
                    .ok_or_else(|| serde::de::Error::custom("value for millisecond is not valid"))?
        }
        IsoDuration::Weeks(weeks) => ChronoDuration::try_weeks(weeks as i64)
            .ok_or_else(|| serde::de::Error::custom("value for weeks is not valid"))?,
    })
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

    /// Test the deserialization
    #[test]
    fn test_deserialize() {
        let s = r#"{"duration":"PT1H"}"#; // 1 hour
        let my_struct: MyStruct = from_str(s).unwrap();
        assert_eq!(my_struct.duration.num_seconds(), 3600);
    }

    /// Test the serialization
    #[test]
    fn test_serialize() {
        let s = r#"{"duration":"PT3600S"}"#; // 1 hour
        let my_struct = MyStruct {
            duration: chrono::Duration::hours(1).try_into().unwrap(),
        };
        assert_eq!(s, to_string(&my_struct).unwrap());
    }

    /// Test invalid deserialization
    #[test]
    fn test_invalid_deserialize() {
        let s = r#"{"duration":"P1M"}"#; // 1 month
        assert!(from_str::<MyStruct>(s).is_err());
    }
}
