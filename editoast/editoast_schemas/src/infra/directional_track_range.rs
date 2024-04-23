use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::Direction;
use crate::primitives::Identifier;

editoast_common::schemas! {
    DirectionalTrackRange,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct DirectionalTrackRange {
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    #[schema(inline)]
    pub track: Identifier,
    pub begin: f64,
    #[derivative(Default(value = "100."))]
    pub end: f64,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub direction: Direction,
}

impl DirectionalTrackRange {
    pub fn entry_bound(&self) -> f64 {
        match self.direction {
            Direction::StartToStop => self.begin,
            Direction::StopToStart => self.end,
        }
    }

    pub fn get_begin(&self) -> f64 {
        if self.direction == Direction::StartToStop {
            self.begin
        } else {
            self.end
        }
    }

    pub fn get_end(&self) -> f64 {
        if self.direction == Direction::StartToStop {
            self.end
        } else {
            self.begin
        }
    }

    pub fn new<T: AsRef<str>>(track: T, begin: f64, end: f64, direction: Direction) -> Self {
        Self {
            track: track.as_ref().into(),
            begin,
            end,
            direction,
        }
    }
}
