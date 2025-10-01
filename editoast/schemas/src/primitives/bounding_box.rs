use geojson;
use geojson::Geometry;
use geojson::Value::LineString;
use serde::Deserialize;
use serde::Serialize;
use std::iter::FromIterator;
use utoipa::ToSchema;

use crate::errors::GeometryError;

/// A bounding box
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
pub struct BoundingBox {
    pub min_lon: f64,
    pub min_lat: f64,
    pub max_lon: f64,
    pub max_lat: f64,
}

impl FromIterator<(f64, f64)> for BoundingBox {
    fn from_iter<I: IntoIterator<Item = (f64, f64)>>(iter: I) -> Self {
        let mut min_lon = f64::MAX;
        let mut min_lat = f64::MAX;
        let mut max_lon = f64::MIN;
        let mut max_lat = f64::MIN;

        for (x, y) in iter {
            min_lon = min_lon.min(x);
            max_lon = max_lon.max(x);
            min_lat = min_lat.min(y);
            max_lat = max_lat.max(y);
        }

        BoundingBox {
            min_lon,
            min_lat,
            max_lon,
            max_lat,
        }
    }
}

impl BoundingBox {
    pub fn union(&mut self, b: &Self) -> &mut Self {
        self.min_lon = self.min_lon.min(b.min_lon);
        self.min_lat = self.min_lat.min(b.min_lat);
        self.max_lon = self.max_lon.max(b.max_lon);
        self.max_lat = self.max_lat.max(b.max_lat);
        self
    }

    pub fn is_valid(&self) -> bool {
        self.min_lon <= self.max_lon && self.min_lat <= self.max_lat
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
    /// use schemas::primitives::BoundingBox;
    ///
    /// let bbox = BoundingBox {
    ///     min_lon: 40.0,
    ///     min_lat: -75.0,
    ///     max_lon: 42.0,
    ///     max_lat: -73.0,
    /// };
    /// let diagonal_length = bbox.diagonal_length();
    /// assert_eq!(diagonal_length, 230908.62753622115);
    /// ```
    pub fn diagonal_length(&self) -> f64 {
        // Earth's mean radius in meters
        let r: f64 = 6_378_100.0;

        let a_lon = self.min_lon;
        let a_lat = self.min_lat;
        let b_lon = self.max_lon;
        let b_lat = self.max_lat;

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
        Self {
            min_lon: f64::INFINITY,
            min_lat: f64::INFINITY,
            max_lon: f64::NEG_INFINITY,
            max_lat: f64::NEG_INFINITY,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bounding_box_union() {
        let mut a = BoundingBox {
            min_lon: 0.,
            min_lat: 0.,
            max_lon: 1.,
            max_lat: 1.,
        };
        let b = BoundingBox {
            min_lon: 2.,
            min_lat: 2.,
            max_lon: 3.,
            max_lat: 3.,
        };
        a.union(&b);
        assert_eq!(
            a,
            BoundingBox {
                min_lon: 0.,
                min_lat: 0.,
                max_lon: 3.,
                max_lat: 3.,
            }
        );
    }

    #[test]
    fn test_bounding_box_min() {
        let mut min = BoundingBox::default();
        let a = BoundingBox {
            min_lon: 0.,
            min_lat: 0.,
            max_lon: 1.,
            max_lat: 1.,
        };
        min.union(&a);
        assert_eq!(min, a);
    }

    #[test]
    fn test_validity() {
        assert!(
            BoundingBox {
                min_lon: 0.,
                min_lat: 0.,
                max_lon: 1.,
                max_lat: 1.,
            }
            .is_valid()
        );
        assert!(
            !BoundingBox {
                min_lon: 1.,
                min_lat: 0.,
                max_lon: 0.,
                max_lat: 1.,
            }
            .is_valid()
        );
        assert!(
            !BoundingBox {
                min_lon: 0.,
                min_lat: 1.,
                max_lon: 1.,
                max_lat: 0.,
            }
            .is_valid()
        );
        assert!(!BoundingBox::default().is_valid());
    }
}
