use serde::Serialize;
use utoipa::ToSchema;

use super::BoundingBox;

editoast_common::schemas! {
    Zone,
}

/// Geographic and Schematic bounding box zone impacted by a list of operations.
/// Zones use the coordinate system [epsg:4326](https://epsg.io/4326).
#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct Zone {
    pub geo: BoundingBox,
    pub sch: BoundingBox,
}

impl Zone {
    pub fn union(&mut self, other: &Self) {
        self.geo.union(&other.geo);
        self.sch.union(&other.sch);
    }
}
