use editoast_schemas::infra::Curve;
use editoast_schemas::infra::Endpoint;
use editoast_schemas::infra::Slope;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDTyped;
use editoast_schemas::primitives::ObjectType;
use educe::Educe;
use serde::Deserialize;
use serde::Serialize;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use editoast_schemas::infra::TrackSection;
use editoast_schemas::primitives::BoundingBox;

#[derive(Debug, Clone, Educe, Deserialize, Serialize)]
#[educe(Hash, PartialEq, Default)]
pub struct TrackSectionCache {
    pub obj_id: String,
    #[educe(Hash(ignore), PartialEq(ignore))]
    pub line_code: Option<i32>,
    #[educe(Hash(ignore), PartialEq(ignore))]
    pub length: f64,
    #[educe(Hash(ignore), PartialEq(ignore))]
    pub slopes: Vec<Slope>,
    #[educe(Hash(ignore), PartialEq(ignore))]
    pub curves: Vec<Curve>,
    #[educe(Hash(ignore), PartialEq(ignore))]
    pub bbox_geo: BoundingBox,
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
