use serde::{Deserialize, Serialize};

use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::operation::{OperationResult, RailjsonObject};
use crate::schema::{ObjectRef, ObjectType};

// impl Iter trait
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct BoundingBox(pub (f64, f64), pub (f64, f64));

impl BoundingBox {
    pub fn union(&mut self, b: &Self) -> &mut Self {
        self.0 = (self.0 .0.min(b.0 .0), self.0 .1.min(b.0 .1));
        self.1 = (self.1 .0.max(b.1 .0), self.1 .1.max(b.1 .1));
        self
    }

    pub fn is_valid(&self) -> bool {
        self.0 .0 <= self.1 .0 && self.0 .1 <= self.1 .1
    }
}
impl Default for BoundingBox {
    fn default() -> Self {
        Self(
            (f64::INFINITY, f64::INFINITY),
            (f64::NEG_INFINITY, f64::NEG_INFINITY),
        )
    }
}

/// Geographic and Schematic bounding box zone impacted by a list of operations
#[derive(Debug, Clone, Default)]
pub struct InvalidationZone {
    pub geo: BoundingBox,
    pub sch: BoundingBox,
}

impl InvalidationZone {
    /// Whether zones are valid
    pub fn is_valid(&self) -> bool {
        self.geo.is_valid()
    }
}

impl InvalidationZone {
    fn merge_bbox(
        geo: &mut BoundingBox,
        sch: &mut BoundingBox,
        infra_cache: &InfraCache,
        track_id: &String,
    ) {
        if let Some(ObjectCache::TrackSection(track)) = infra_cache.track_sections().get(track_id) {
            geo.union(&track.bbox_geo);
            sch.union(&track.bbox_sch);
        }
    }

    /// Given a list of operations, compute the geographic and schematic bounding box of their impact
    pub fn compute(infra_cache: &InfraCache, operations: &Vec<OperationResult>) -> Self {
        let mut geo = BoundingBox::default();
        let mut sch = BoundingBox::default();
        for op in operations {
            match op {
                OperationResult::Create(RailjsonObject::TrackSection { railjson }) => {
                    geo.union(&railjson.geo.get_bbox());
                    sch.union(&railjson.sch.get_bbox());
                }
                OperationResult::Update(RailjsonObject::TrackSection { railjson }) => {
                    geo.union(&railjson.geo.get_bbox());
                    sch.union(&railjson.sch.get_bbox());
                    Self::merge_bbox(&mut geo, &mut sch, infra_cache, &railjson.id);
                }
                OperationResult::Update(RailjsonObject::Signal { railjson })
                | OperationResult::Create(RailjsonObject::Signal { railjson }) => {
                    if let Some(ObjectCache::Signal(signal)) =
                        infra_cache.signals().get::<String>(&railjson.id)
                    {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, &signal.track);
                    };
                    Self::merge_bbox(&mut geo, &mut sch, infra_cache, &railjson.track);
                }
                OperationResult::Update(RailjsonObject::SpeedSection { railjson })
                | OperationResult::Create(RailjsonObject::SpeedSection { railjson }) => {
                    if let Some(ObjectCache::SpeedSection(speed_section)) =
                        infra_cache.speed_sections().get::<String>(&railjson.id)
                    {
                        for track_id in speed_section.track_ranges.iter().map(|r| &r.track) {
                            Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                        }
                    }
                    for track_id in railjson.track_ranges.iter().map(|r| &r.track) {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                    }
                }
                OperationResult::Update(RailjsonObject::OperationalPoint { railjson })
                | OperationResult::Create(RailjsonObject::OperationalPoint { railjson }) => {
                    if let Some(ObjectCache::OperationalPoint(op)) =
                        infra_cache.operational_points().get::<String>(&railjson.id)
                    {
                        for track_id in op.parts.iter().map(|r| &r.track) {
                            Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                        }
                    }
                    for track_id in railjson.parts.iter().map(|r| &r.track) {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                    }
                }
                OperationResult::Update(RailjsonObject::TrackSectionLink { railjson })
                | OperationResult::Create(RailjsonObject::TrackSectionLink { railjson }) => {
                    if let Some(ObjectCache::TrackSectionLink(link)) = infra_cache
                        .track_section_links()
                        .get::<String>(&railjson.id)
                    {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, &link.src.track);
                    };
                    let track_id = &railjson.src.track;
                    Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                }
                OperationResult::Update(RailjsonObject::Switch { railjson })
                | OperationResult::Create(RailjsonObject::Switch { railjson }) => {
                    if let Some(ObjectCache::Switch(switch)) =
                        infra_cache.switches().get::<String>(&railjson.id)
                    {
                        for endpoint in switch.ports.values() {
                            let track_id = &endpoint.track;
                            Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                        }
                    };
                    for endpoint in railjson.ports.values() {
                        let track_id = &endpoint.track;
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                    }
                }
                OperationResult::Update(RailjsonObject::SwitchType { railjson: _ })
                | OperationResult::Create(RailjsonObject::SwitchType { railjson: _ }) => {}
                OperationResult::Update(RailjsonObject::Detector { railjson })
                | OperationResult::Create(RailjsonObject::Detector { railjson }) => {
                    if let Some(ObjectCache::Detector(detector)) =
                        infra_cache.detectors().get::<String>(&railjson.id)
                    {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, &detector.track);
                    };
                    Self::merge_bbox(&mut geo, &mut sch, infra_cache, &railjson.track);
                }
                OperationResult::Update(RailjsonObject::BufferStop { railjson })
                | OperationResult::Create(RailjsonObject::BufferStop { railjson }) => {
                    if let Some(ObjectCache::BufferStop(buffer_stop)) =
                        infra_cache.buffer_stops().get::<String>(&railjson.id)
                    {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, &buffer_stop.track);
                    };
                    Self::merge_bbox(&mut geo, &mut sch, infra_cache, &railjson.track);
                }
                OperationResult::Update(RailjsonObject::Catenary { railjson })
                | OperationResult::Create(RailjsonObject::Catenary { railjson }) => {
                    if let Some(ObjectCache::Catenary(catenary)) =
                        infra_cache.catenaries().get::<String>(&railjson.id)
                    {
                        for track_id in catenary.track_ranges.iter().map(|r| &r.track) {
                            Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                        }
                    }
                    for track_id in railjson.track_ranges.iter().map(|r| &r.track) {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                    }
                }
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::TrackSection,
                    obj_id,
                }) => Self::merge_bbox(&mut geo, &mut sch, infra_cache, obj_id),
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::Signal,
                    obj_id,
                }) => {
                    if let Some(ObjectCache::Signal(signal)) = infra_cache.signals().get(obj_id) {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, &signal.track);
                    }
                }
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::SpeedSection,
                    obj_id,
                }) => {
                    if let Some(ObjectCache::SpeedSection(speed)) =
                        infra_cache.speed_sections().get(obj_id)
                    {
                        for track_id in speed.track_ranges.iter().map(|r| &r.track) {
                            Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                        }
                    }
                }
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::OperationalPoint,
                    obj_id,
                }) => {
                    if let Some(ObjectCache::OperationalPoint(op)) =
                        infra_cache.operational_points().get(obj_id)
                    {
                        for track_id in op.parts.iter().map(|r| &r.track) {
                            Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                        }
                    }
                }
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::TrackSectionLink,
                    obj_id,
                }) => {
                    if let Some(ObjectCache::TrackSectionLink(link)) =
                        infra_cache.track_section_links().get(obj_id)
                    {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, &link.src.track);
                    }
                }
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::Switch,
                    obj_id,
                }) => {
                    if let Some(ObjectCache::Switch(switch)) = infra_cache.switches().get(obj_id) {
                        for endpoint in switch.ports.values() {
                            Self::merge_bbox(&mut geo, &mut sch, infra_cache, &endpoint.track);
                        }
                    }
                }
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::Detector,
                    obj_id,
                }) => {
                    if let Some(ObjectCache::Detector(detector)) =
                        infra_cache.detectors().get(obj_id)
                    {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, &detector.track);
                    }
                }
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::BufferStop,
                    obj_id,
                }) => {
                    if let Some(ObjectCache::BufferStop(buffer_stop)) =
                        infra_cache.buffer_stops().get(obj_id)
                    {
                        Self::merge_bbox(&mut geo, &mut sch, infra_cache, &buffer_stop.track);
                    }
                }
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::SwitchType,
                    obj_id: _,
                }) => {}
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::Catenary,
                    obj_id,
                }) => {
                    if let Some(ObjectCache::Catenary(catenary)) =
                        infra_cache.catenaries().get(obj_id)
                    {
                        for track_id in catenary.track_ranges.iter().map(|r| &r.track) {
                            Self::merge_bbox(&mut geo, &mut sch, infra_cache, track_id);
                        }
                    }
                }
                // Route doesn't have a geometry layer. So we don't need to comute their bbox
                OperationResult::Update(RailjsonObject::Route { .. })
                | OperationResult::Create(RailjsonObject::Route { .. }) => {}
                OperationResult::Delete(ObjectRef {
                    obj_type: ObjectType::Route,
                    ..
                }) => {}
            }
        }
        assert_eq!(geo.is_valid(), sch.is_valid());
        Self { geo, sch }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bounding_box_union() {
        let mut a = BoundingBox((0., 0.), (1., 1.));
        let b = BoundingBox((2., 2.), (3., 3.));
        a.union(&b);
        assert_eq!(a, BoundingBox((0., 0.), (3., 3.)));
    }

    #[test]
    fn test_bounding_box_min() {
        let mut min = BoundingBox::default();
        let a = BoundingBox((0., 0.), (1., 1.));
        min.union(&a);
        assert_eq!(min, a);
    }

    #[test]
    fn test_validity() {
        assert!(BoundingBox((0., 0.), (1., 1.)).is_valid());
        assert!(!BoundingBox((1., 0.), (0., 1.)).is_valid());
        assert!(!BoundingBox((0., 1.), (1., 0.)).is_valid());
        assert!(!BoundingBox::default().is_valid());
    }
}
