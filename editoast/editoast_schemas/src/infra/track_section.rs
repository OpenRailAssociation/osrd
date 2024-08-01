use derivative::Derivative;
use geojson::Geometry;
use geojson::Value::LineString;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::Curve;
use super::LoadingGaugeLimit;
use super::Slope;
use super::TrackSectionExtensions;
use crate::primitives::BoundingBox;
use crate::primitives::Identifier;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDTyped;
use crate::primitives::ObjectType;

editoast_common::schemas! {
    TrackSection,
    Slope,
    Curve,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSection {
    #[schema(inline)]
    pub id: Identifier,
    #[derivative(Default(value = "100."))]
    pub length: f64,
    pub slopes: Vec<Slope>,
    pub curves: Vec<Curve>,
    #[serde(default)]
    pub loading_gauge_limits: Vec<LoadingGaugeLimit>,
    #[derivative(Default(value = "Geometry::new(LineString(vec![]))"))]
    #[schema(value_type = GeoJsonLineString)]
    pub geo: Geometry,
    #[serde(default)]
    #[schema(inline)]
    pub extensions: TrackSectionExtensions,
}

impl OSRDTyped for TrackSection {
    fn get_type() -> ObjectType {
        ObjectType::TrackSection
    }
}

impl OSRDIdentified for TrackSection {
    fn get_id(&self) -> &String {
        &self.id
    }
}

impl TrackSection {
    fn bbox(geom: &Geometry) -> BoundingBox {
        BoundingBox::from_geometry(geom.clone())
            .expect("track sections can only be represented by LineStrings")
    }

    pub fn geo_bbox(&self) -> BoundingBox {
        Self::bbox(&self.geo)
    }
}

#[cfg(test)]
mod test {
    use geojson;
    use serde_json::from_str;

    use super::TrackSectionExtensions;
    use crate::primitives::BoundingBox;

    /// Test bounding box from linestring
    #[test]
    fn test_line_string_bbox() {
        let line_string = geojson::Value::LineString(vec![
            vec![2.4, 49.3],
            vec![2.6, 49.1],
            vec![2.8, 49.2],
            vec![3.0, 49.1],
            vec![2.6, 49.0],
        ]);

        assert_eq!(
            BoundingBox::from_geojson(line_string).unwrap(),
            BoundingBox((2.4, 49.0), (3.0, 49.3))
        );
    }

    #[test]
    fn test_track_extensions_deserialization() {
        from_str::<TrackSectionExtensions>(r#"{}"#).unwrap();
    }
}
