use crate::models::BoundingBox;

use super::generate_id;
use super::ApplicableDirections;
use super::OSRDObject;
use super::ObjectType;
use derivative::Derivative;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSection {
    #[derivative(Default(value = r#"generate_id("track_section")"#))]
    pub id: String,
    #[derivative(Default(value = "0."))]
    pub length: f64,
    pub line_code: i32,
    #[derivative(Default(value = r#""line_test".to_string()"#))]
    pub line_name: String,
    pub track_number: i32,
    #[derivative(Default(value = r#""track_test".to_string()"#))]
    pub track_name: String,
    pub navigability: ApplicableDirections,
    pub slopes: Vec<Slope>,
    pub curves: Vec<Curve>,
    pub loading_gauge_limits: Vec<LoadingGaugeLimit>,
    pub geo: LineString,
    pub sch: LineString,
}

impl OSRDObject for TrackSection {
    fn get_id(&self) -> String {
        self.id.clone()
    }

    fn get_type(&self) -> ObjectType {
        ObjectType::TrackSection
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Curve {
    pub radius: f64,
    pub begin: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Slope {
    pub gradient: f64,
    pub begin: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum LoadingGaugeType {
    G1,
    G2,
    GA,
    GB,
    GB1,
    GC,
    #[serde(rename = "FR3.3")]
    Fr3_3,
    #[serde(rename = "FR3.3/GB/G2")]
    Fr3_3GbG2,
    #[serde(rename = "GLOTT")]
    Glott,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub enum ApplicableTrainType {
    #[serde(rename = "FREIGHT")]
    Freight,
    #[serde(rename = "PASSENGER")]
    Passenger,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct LoadingGaugeLimit {
    pub category: LoadingGaugeType,
    pub applicable_train_type: ApplicableTrainType,
    pub begin: f64,
    pub end: f64,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(tag = "type", deny_unknown_fields)]
#[derivative(Default)]
pub enum LineString {
    #[derivative(Default)]
    LineString {
        #[derivative(Default(value = "vec![[0., 0.], [1., 1.]]"))]
        coordinates: Vec<[f64; 2]>,
    },
}

impl LineString {
    pub fn get_bbox(&self) -> BoundingBox {
        let coords = match self {
            Self::LineString { coordinates } => coordinates,
        };

        let mut min: (f64, f64) = (f64::MAX, f64::MAX);
        let mut max: (f64, f64) = (f64::MIN, f64::MIN);
        for p in coords {
            min.0 = min.0.min(p[0]);
            max.0 = max.0.max(p[0]);
            min.1 = min.1.min(p[1]);
            max.1 = max.1.max(p[1]);
        }
        BoundingBox(min, max)
    }
}

#[cfg(test)]
mod tests {
    use crate::models::BoundingBox;

    use super::LineString::LineString;

    /// Test bounding box from linestring
    #[test]
    fn test_line_string_bbox() {
        let line_string = LineString {
            coordinates: vec![
                [2.4, 49.3],
                [2.6, 49.1],
                [2.8, 49.2],
                [3.0, 49.1],
                [2.6, 49.0],
            ],
        };

        assert_eq!(
            line_string.get_bbox(),
            BoundingBox((2.4, 49.0), (3.0, 49.3))
        );
    }
}
