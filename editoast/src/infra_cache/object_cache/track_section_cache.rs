use derivative::Derivative;
use editoast_schemas::infra::Curve;
use editoast_schemas::infra::Endpoint;
use editoast_schemas::infra::Slope;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDTyped;
use editoast_schemas::primitives::ObjectType;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::schema::TrackSection;
use editoast_schemas::primitives::BoundingBox;

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
