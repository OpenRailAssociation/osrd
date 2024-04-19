use derivative::Derivative;
use editoast_common::Identifier;
use editoast_common::NonBlankString;
use editoast_schemas::infra::Curve;
use editoast_schemas::infra::LoadingGaugeLimit;
use editoast_schemas::infra::Slope;
use editoast_schemas::primitives::BoundingBox;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDTyped;
use editoast_schemas::primitives::ObjectType;
use geos::geojson::Geometry;
use geos::geojson::Value::LineString;
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSection {
    pub id: Identifier,
    #[derivative(Default(value = "100."))]
    pub length: f64,
    pub slopes: Vec<Slope>,
    pub curves: Vec<Curve>,
    #[serde(default)]
    pub loading_gauge_limits: Vec<LoadingGaugeLimit>,
    #[derivative(Default(value = "Geometry::new(LineString(vec![]))"))]
    pub geo: Geometry,
    #[derivative(Default(value = "Geometry::new(LineString(vec![]))"))]
    pub sch: Geometry,
    #[serde(default)]
    pub extensions: TrackSectionExtensions,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct TrackSectionExtensions {
    pub sncf: Option<TrackSectionSncfExtension>,
    pub source: Option<TrackSectionSourceExtension>,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSectionSncfExtension {
    pub line_code: i32,
    #[derivative(Default(value = r#""line_test".into()"#))]
    pub line_name: NonBlankString,
    pub track_number: i32,
    #[derivative(Default(value = r#""track_test".into()"#))]
    pub track_name: NonBlankString,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct TrackSectionSourceExtension {
    pub name: NonBlankString,
    pub id: NonBlankString,
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

    pub fn sch_bbox(&self) -> BoundingBox {
        Self::bbox(&self.sch)
    }
}

#[cfg(test)]
mod test {
    use geos::geojson;
    use serde_json::from_str;

    use super::TrackSectionExtensions;
    use editoast_schemas::primitives::BoundingBox;

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
