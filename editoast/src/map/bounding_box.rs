use editoast_derive::EditoastError;
use geos::geojson::{self, Geometry, Value::LineString};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use utoipa::ToSchema;

use crate::error::Result;

crate::schemas! {
    Zone,
    BoundingBox,
}

/// A bounding box
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct BoundingBox(pub (f64, f64), pub (f64, f64));

impl BoundingBox {
    pub fn union(&mut self, b: &Self) -> &mut Self {
        self.0 = (self.0 .0.min(b.0 .0), self.0 .1.min(b.0 .1));
        self.1 = (self.1 .0.max(b.1 .0), self.1 .1.max(b.1 .1));
        self
    }

    pub fn is_valid(&self) -> bool {
        self.0 .0 <= self.1 .0 && self.0 .1 <= self.1 .1
    }

    pub fn from_iter<I: Iterator<Item = (f64, f64)>>(iter: I) -> Self {
        let mut min: (f64, f64) = (f64::MAX, f64::MAX);
        let mut max: (f64, f64) = (f64::MIN, f64::MIN);
        for (x, y) in iter {
            min.0 = min.0.min(x);
            max.0 = max.0.max(x);
            min.1 = min.1.min(y);
            max.1 = max.1.max(y);
        }
        BoundingBox(min, max)
    }

    pub fn from_geojson(value: geojson::Value) -> Result<Self> {
        match value {
            LineString(segments) => Ok(Self::from_iter(segments.into_iter().map(|points| {
                (
                    *points.first().expect("invalid point"),
                    *points.get(1).expect("invalid point"),
                )
            }))),
            value => Err(GeometryError::UnexpectedGeometry {
                expected: "LineString".to_owned(),
                actual: value.to_string(),
            }
            .into()),
        }
    }

    pub fn from_geometry(value: Geometry) -> Result<Self> {
        Self::from_geojson(value.value)
    }

    /// Computes the length (in meters) of the diagonal
    /// It represents the longest distance as the crow flies between two points in the box
    pub fn diagonal_length(&self) -> f64 {
        let a = osm4routing::Coord {
            lon: self.0 .0,
            lat: self.0 .1,
        };
        let b = osm4routing::Coord {
            lon: self.1 .0,
            lat: self.1 .1,
        };
        a.distance_to(b)
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "geometry")]
pub enum GeometryError {
    #[error("expected geometry {expected} but got {actual}")]
    #[editoast_error(status = 404)]
    UnexpectedGeometry { expected: String, actual: String },
}

impl Default for BoundingBox {
    fn default() -> Self {
        Self(
            (f64::INFINITY, f64::INFINITY),
            (f64::NEG_INFINITY, f64::NEG_INFINITY),
        )
    }
}

/// Geographic and Schematic bounding box zone impacted by a list of operations.
/// Zones use the coordinate system [epsg:4326](https://epsg.io/4326).
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct Zone {
    pub geo: BoundingBox,
    pub sch: BoundingBox,
}

impl Zone {
    pub fn union(&mut self, other: &Self) {
        self.geo.union(&other.geo);
        self.sch.union(&other.sch);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bounding_box_union() {
        let mut a = BoundingBox((0., 0.), (1., 1.));
        let b = BoundingBox((2., 2.), (3., 3.));
        a.union(&b);
        assert_eq!(a, BoundingBox((0., 0.), (3., 3.)));
    }

    #[test]
    fn test_bounding_box_min() {
        let mut min = BoundingBox::default();
        let a = BoundingBox((0., 0.), (1., 1.));
        min.union(&a);
        assert_eq!(min, a);
    }

    #[test]
    fn test_validity() {
        assert!(BoundingBox((0., 0.), (1., 1.)).is_valid());
        assert!(!BoundingBox((1., 0.), (0., 1.)).is_valid());
        assert!(!BoundingBox((0., 1.), (1., 0.)).is_valid());
        assert!(!BoundingBox::default().is_valid());
    }
}
