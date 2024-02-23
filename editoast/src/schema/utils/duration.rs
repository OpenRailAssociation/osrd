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

use chrono::Duration as ChronoDuration;
use iso8601::Duration as IsoDuration;
use serde::{Deserialize, Serialize};
use std::{ops::Deref, str::FromStr};

/// Wrapper for `chrono::Duration` to use with Serde.
/// This is useful to serialize `chrono::Duration` using the ISO 8601 duration format.
///
/// ```
/// use serde::{Serialize, Deserialize};
/// use crate::schema::utils::duration::Duration;
///
/// #[derive(Serialize, Deserialize)]
/// struct MyStruct {
///     duration: Duration
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
pub struct Duration(ChronoDuration);

impl From<ChronoDuration> for Duration {
    fn from(duration: ChronoDuration) -> Self {
        Duration(duration)
    }
}

impl From<Duration> for ChronoDuration {
    fn from(duration: Duration) -> Self {
        duration.0
    }
}

impl Deref for Duration {
    type Target = ChronoDuration;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Serialize for Duration {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serialize(&self.0, serializer)
    }
}

impl<'de> Deserialize<'de> for Duration {
    fn deserialize<D>(deserializer: D) -> Result<Duration, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        deserialize(deserializer).map(Duration)
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
            ChronoDuration::days(day as i64)
                + ChronoDuration::hours(hour as i64)
                + ChronoDuration::minutes(minute as i64)
                + ChronoDuration::seconds(second as i64)
                + ChronoDuration::milliseconds(millisecond as i64)
        }
        IsoDuration::Weeks(weeks) => ChronoDuration::weeks(weeks as i64),
    })
}

#[cfg(test)]
mod tests {
    use super::Duration;
    use serde::{Deserialize, Serialize};
    use serde_json::{from_str, to_string};

    #[derive(Serialize, Deserialize)]
    struct MyStruct {
        duration: Duration,
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
            duration: Duration::from(chrono::Duration::hours(1)),
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
