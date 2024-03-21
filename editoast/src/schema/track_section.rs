use super::utils::Identifier;
use super::utils::NonBlankString;
use super::Endpoint;
use super::OSRDIdentified;
use super::OSRDTyped;
use super::ObjectType;
use super::TrackEndpoint;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::map::BoundingBox;

use derivative::Derivative;
use geos::geojson::{Geometry, Value::LineString};
use serde::{Deserialize, Serialize};
use strum_macros::FromRepr;
use utoipa::ToSchema;

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

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Curve {
    pub radius: f64,
    pub begin: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Slope {
    pub gradient: f64,
    pub begin: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq, ToSchema, Hash, FromRepr)]
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

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct LoadingGaugeLimit {
    pub category: LoadingGaugeType,
    pub begin: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq, Default)]
pub struct TrackSectionCache {
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub line_code: Option<i32>,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub length: f64,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub slopes: Vec<Slope>,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub curves: Vec<Curve>,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub bbox_geo: BoundingBox,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub bbox_sch: BoundingBox,
}

impl OSRDTyped for TrackSectionCache {
    fn get_type() -> ObjectType {
        ObjectType::TrackSection
    }
}

impl OSRDIdentified for TrackSectionCache {
    fn get_id(&self) -> &String {
        &self.obj_id
    }
}

impl TrackSectionCache {
    pub fn get_begin(&self) -> TrackEndpoint {
        TrackEndpoint {
            endpoint: Endpoint::Begin,
            track: self.obj_id.clone().into(),
        }
    }

    pub fn get_end(&self) -> TrackEndpoint {
        TrackEndpoint {
            endpoint: Endpoint::End,
            track: self.obj_id.clone().into(),
        }
    }
}

impl From<TrackSection> for TrackSectionCache {
    fn from(track: TrackSection) -> Self {
        TrackSectionCache {
            bbox_geo: track.geo_bbox(),
            bbox_sch: track.sch_bbox(),
            obj_id: track.id.0,
            length: track.length,
            curves: track.curves,
            slopes: track.slopes,
            line_code: track.extensions.sncf.map(|sncf| sncf.line_code),
        }
    }
}

impl Cache for TrackSectionCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        vec![]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::TrackSection(self.clone())
    }
}

#[cfg(test)]
mod test {
    use super::TrackSectionExtensions;
    use crate::map::BoundingBox;
    use geos::geojson;
    use serde_json::from_str;

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
