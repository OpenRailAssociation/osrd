use educe::Educe;
use geos::geojson::Geometry;
use geos::geojson::Value::LineString;
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
use common::geometry::GeoJsonLineString;

#[derive(Debug, Educe, Clone, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(deny_unknown_fields)]
#[educe(Default)]
pub struct TrackSection {
    #[schema(inline)]
    pub id: Identifier,
    #[educe(Default = 100.)]
    pub length: f64,
    pub slopes: Vec<Slope>,
    pub curves: Vec<Curve>,
    #[serde(default)]
    pub loading_gauge_limits: Vec<LoadingGaugeLimit>,
    #[educe(Default = Geometry::new(LineString(vec![])))]
    #[schema(value_type = GeoJsonLineString)]
    pub geo: Geometry,
    #[serde(default)]
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
mod tests {
    use geos::geojson;
    use serde_json::from_str;

    use super::TrackSectionExtensions;
    use crate::infra::TrackSectionSncfExtension;
    use crate::primitives::BoundingBox;

    /// Test bounding box from linestring
    #[test]
    fn line_string_bbox() {
        let line_string = geojson::Value::LineString(vec![
            vec![2.4, 49.3],
            vec![2.6, 49.1],
            vec![2.8, 49.2],
            vec![3.0, 49.1],
            vec![2.6, 49.0],
        ]);

        assert_eq!(
            BoundingBox::from_geojson(line_string).unwrap(),
            BoundingBox {
                min_lon: 2.4,
                min_lat: 49.0,
                max_lon: 3.0,
                max_lat: 49.3,
            }
        );
    }

    #[test]
    fn track_extensions_deserialization() {
        from_str::<TrackSectionExtensions>(r#"{}"#).unwrap();
    }

    #[test]
    fn track_extensions_of_any_infrastructure_manager() {
        let json = serde_json::json!({
            "sncf": null,
            "source": null,
            "oebb": {"line_code": 101, "line_name": "Westbahn", "track_number": 1, "track_name": "1"}
        });
        let extensions = serde_json::from_value::<TrackSectionExtensions>(json.clone()).unwrap();
        assert_eq!(extensions.line().unwrap().line_code, 101);
        assert_eq!(serde_json::to_value(&extensions).unwrap(), json);
        assert!(from_str::<TrackSectionExtensions>(r#"{"oebb": {"line_code": 101}}"#).is_err());
    }

    #[test]
    fn track_extensions_line_prefers_sncf() {
        let line = |line_code| TrackSectionSncfExtension {
            line_code,
            ..Default::default()
        };
        let extensions = TrackSectionExtensions {
            sncf: Some(line(1)),
            infrastructure_managers: [("db".to_owned(), line(2))].into(),
            ..Default::default()
        };
        assert_eq!(extensions.line().unwrap().line_code, 1);
    }
}
