use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use uom::si::length::meter;
use utoipa::ToSchema;

use super::Direction;
use crate::primitives::Identifier;
use editoast_common::units;
use editoast_common::units::quantities::Length;

editoast_common::schemas! {
    DirectionalTrackRange,
}

#[editoast_derive::annotate_units]
#[derive(Debug, Educe, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct DirectionalTrackRange {
    #[educe(Default = "InvalidRef".into())]
    #[schema(inline)]
    pub track: Identifier,
    #[serde(with = "units::meter")]
    pub begin: Length,
    #[serde(with = "units::meter")]
    #[educe(Default = Length::new::<meter>(100.))]
    pub end: Length,
    #[educe(Default = Direction::StartToStop)]
    pub direction: Direction,
}

impl DirectionalTrackRange {
    pub fn entry_bound(&self) -> Length {
        match self.direction {
            Direction::StartToStop => self.begin,
            Direction::StopToStart => self.end,
        }
    }

    pub fn get_begin(&self) -> Length {
        if self.direction == Direction::StartToStop {
            self.begin
        } else {
            self.end
        }
    }

    pub fn get_end(&self) -> Length {
        if self.direction == Direction::StartToStop {
            self.end
        } else {
            self.begin
        }
    }

    pub fn new<T: AsRef<str>>(track: T, begin: Length, end: Length, direction: Direction) -> Self {
        Self {
            track: track.as_ref().into(),
            begin,
            end,
            direction,
        }
    }
}

#[cfg(feature = "testing")]
impl std::str::FromStr for DirectionalTrackRange {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let Some((name, offsets)) = s.split_once('+') else {
            return Err(String::from(
                "track range must contain at least a '+' and be of the form \"A+12-25\"",
            ));
        };
        let track = Identifier::from(name);
        let Some((begin, end)) = offsets.split_once('-') else {
            return Err(String::from(
                "track range must contain '-' to separate the offsets and be of the form \"A+12-25\"",
            ));
        };
        let Ok(begin) = begin.parse() else {
            return Err(format!("{begin} in track range should be an integer"));
        };
        let Ok(end) = end.parse() else {
            return Err(format!("{end} in track range should be an integer"));
        };
        let (begin, end, direction) = if begin < end {
            (begin, end, Direction::StartToStop)
        } else {
            (end, begin, Direction::StopToStart)
        };
        Ok(Self {
            track,
            begin,
            end,
            direction,
        })
    }
}
