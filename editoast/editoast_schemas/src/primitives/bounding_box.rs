use geojson;
use geojson::Geometry;
use geojson::Value::LineString;
use serde::Deserialize;
use serde::Serialize;
use std::iter::FromIterator;
use utoipa::ToSchema;

use crate::errors::GeometryError;

editoast_common::schemas! {
    BoundingBox,
}

/// A bounding box
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct BoundingBox(pub (f64, f64), pub (f64, f64));

impl FromIterator<(f64, f64)> for BoundingBox {
    fn from_iter<I: IntoIterator<Item = (f64, f64)>>(iter: I) -> Self {
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
}

impl BoundingBox {
    pub fn union(&mut self, b: &Self) -> &mut Self {
        self.0 = (self.0 .0.min(b.0 .0), self.0 .1.min(b.0 .1));
        self.1 = (self.1 .0.max(b.1 .0), self.1 .1.max(b.1 .1));
        self
    }

    pub fn is_valid(&self) -> bool {
        self.0 .0 <= self.1 .0 && self.0 .1 <= self.1 .1
    }

    pub fn from_geojson(value: geojson::Value) -> Result<Self, GeometryError> {
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
            }),
        }
    }

    pub fn from_geometry(value: Geometry) -> Result<Self, GeometryError> {
        Self::from_geojson(value.value)
    }

    /// Calculates the diagonal length of the bounding box using the Haversine formula.
    ///
    /// # Returns
    ///
    /// * `f64` - The diagonal length of the bounding box in meters.
    ///
    /// # Examples
    ///
    /// ```
    /// use editoast_schemas::primitives::BoundingBox;
    ///
    /// let bbox = BoundingBox((40.0, -75.0), (42.0, -73.0));
    /// let diagonal_length = bbox.diagonal_length();
    /// assert_eq!(diagonal_length, 230908.62753622115);
    /// ```
    pub fn diagonal_length(&self) -> f64 {
        // Earth's mean radius in meters
        let r: f64 = 6_378_100.0;

        let a_lon = self.0 .0;
        let a_lat = self.0 .1;
        let b_lon = self.1 .0;
        let b_lat = self.1 .1;

        // Calculate differences in longitude and latitude in radians
        let d_lon: f64 = (b_lon - a_lon).to_radians();
        let d_lat: f64 = (b_lat - a_lat).to_radians();

        // Convert latitude to radians
        let lat1: f64 = a_lat.to_radians();
        let lat2: f64 = b_lat.to_radians();

        // Haversine formula
        let a: f64 = ((d_lat / 2.0).sin()) * ((d_lat / 2.0).sin())
            + ((d_lon / 2.0).sin()) * ((d_lon / 2.0).sin()) * (lat1.cos()) * (lat2.cos());
        let c: f64 = 2.0 * ((a.sqrt()).atan2((1.0 - a).sqrt()));

        // Calculate diagonal length
        r * c
    }
}

impl Default for BoundingBox {
    fn default() -> Self {
        Self(
            (f64::INFINITY, f64::INFINITY),
            (f64::NEG_INFINITY, f64::NEG_INFINITY),
        )
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
