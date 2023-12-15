use mvt::GeomType;

use serde::{Deserialize, Serialize};

/// GeoJson representation
#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
#[serde(tag = "type")]
pub enum GeoJson {
    Point { coordinates: (f64, f64) },
    MultiPoint { coordinates: Vec<(f64, f64)> },
    LineString { coordinates: Vec<(f64, f64)> },
    MultiLineString { coordinates: Vec<Vec<(f64, f64)>> },
}

impl GeoJson {
    /// Gets MVT geom type corresponding to the GeoJson type
    pub fn get_geom_type(&self) -> GeomType {
        match self {
            GeoJson::Point { .. } => GeomType::Point,
            GeoJson::MultiPoint { .. } => GeomType::Point,
            GeoJson::LineString { .. } => GeomType::Linestring,
            GeoJson::MultiLineString { .. } => GeomType::Linestring,
        }
    }
}
