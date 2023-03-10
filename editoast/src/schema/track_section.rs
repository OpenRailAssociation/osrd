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
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Model)]
#[serde(deny_unknown_fields)]
#[model(table = "crate::tables::osrd_infra_tracksectionmodel")]
#[derivative(Default)]
pub struct TrackSection {
    pub id: Identifier,
    #[derivative(Default(value = "100."))]
    pub length: f64,
    pub slopes: Vec<Slope>,
    pub curves: Vec<Curve>,
    #[serde(default)]
    pub loading_gauge_limits: Vec<LoadingGaugeLimit>,
    pub geo: LineString,
    pub sch: LineString,
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

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
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

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq)]
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

#[derive(Debug, Default, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct TrackSectionCache {
    pub obj_id: String,
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
            obj_id: track.id.0,
            length: track.length,
            curves: track.curves,
            slopes: track.slopes,
            bbox_geo: track.geo.get_bbox(),
            bbox_sch: track.sch.get_bbox(),
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
    use super::TrackSection;
    use super::{LineString::LineString, TrackSectionExtensions};
    use crate::infra::tests::test_infra_transaction;
    use crate::map::BoundingBox;
    use serde_json::from_str;

    #[test]
    fn test_persist() {
        test_infra_transaction(|conn, infra| {
            let data = (0..10)
                .map(|_| TrackSection::default())
                .collect::<Vec<TrackSection>>();

            assert!(TrackSection::persist_batch(&data, infra.id, conn).is_ok());
        });
    }

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

    #[test]
    fn test_track_extensions_deserialization() {
        from_str::<TrackSectionExtensions>(r#"{}"#).unwrap();
    }
}
