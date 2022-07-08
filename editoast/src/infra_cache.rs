use crate::models::BoundingBox;
use crate::railjson::operation::{OperationResult, RailjsonObject};
use crate::railjson::*;
use derivative::Derivative;
use diesel::sql_types::{Double, Integer, Json, Nullable, Text};
use diesel::PgConnection;
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

/// Contains infra cached data used to generate layers and errors
#[derive(Debug, Default)]
pub struct InfraCache {
    /// Map track section id to the list of objects that depend on it
    /// Contains all referenced track sections (not only existing ones)
    pub track_sections_refs: HashMap<String, HashSet<ObjectRef>>,

    /// List existing track sections
    pub track_sections: HashMap<String, TrackCache>,

    /// List existing signals
    pub signals: HashMap<String, SignalCache>,

    /// List existing speed sections
    pub speed_sections: HashMap<String, SpeedSection>,

    /// List existing track section links
    pub track_section_links: HashMap<String, TrackSectionLink>,

    /// List existing switches
    pub switches: HashMap<String, SwitchCache>,

    /// List existing detectors
    pub detectors: HashMap<String, DetectorCache>,

    /// List existing buffer stops
    pub buffer_stops: HashMap<String, BufferStopCache>,

    /// List existing routes
    pub routes: HashMap<String, Route>,

    /// List existing operational points
    pub operational_points: HashMap<String, OperationalPointCache>,

    /// List existing switch types
    pub switch_types: HashMap<String, SwitchType>,
}

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct TrackCache {
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub length: f64,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub bbox_geo: BoundingBox,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub bbox_sch: BoundingBox,
}

impl From<&TrackSection> for TrackCache {
    fn from(track: &TrackSection) -> Self {
        TrackCache {
            obj_id: track.id.clone(),
            length: track.length,
            bbox_geo: track.geo.get_bbox(),
            bbox_sch: track.sch.get_bbox(),
        }
    }
}

impl From<TrackQueryable> for TrackCache {
    fn from(track: TrackQueryable) -> Self {
        let geo: LineString = serde_json::from_value(track.geo).unwrap();
        let sch: LineString = serde_json::from_value(track.sch).unwrap();
        Self {
            obj_id: track.obj_id,
            length: track.length,
            bbox_geo: geo.get_bbox(),
            bbox_sch: sch.get_bbox(),
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct TrackQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Double"]
    pub length: f64,
    #[sql_type = "Json"]
    pub geo: Value,
    #[sql_type = "Json"]
    pub sch: Value,
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct SignalCache {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Text"]
    pub track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Double"]
    pub position: f64,
}

impl SignalCache {
    pub fn new(obj_id: String, track: String, position: f64) -> Self {
        Self {
            obj_id,
            track,
            position,
        }
    }
}

impl From<&Signal> for SignalCache {
    fn from(sig: &Signal) -> Self {
        Self::new(sig.id.clone(), sig.track.obj_id.clone(), sig.position)
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct SpeedSectionQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Json"]
    pub track_ranges: Value,
    #[sql_type = "Nullable<Double>"]
    pub speed_limit: Option<f64>,
    #[sql_type = "Json"]
    pub speed_limit_by_tag: Value,
}

impl From<SpeedSectionQueryable> for SpeedSection {
    fn from(speed: SpeedSectionQueryable) -> Self {
        let track_ranges: Vec<ApplicableDirectionsTrackRange> =
            serde_json::from_value(speed.track_ranges).unwrap();
        SpeedSection {
            id: speed.obj_id.clone(),
            speed_limit: speed.speed_limit,
            speed_limit_by_tag: serde_json::from_value(speed.speed_limit_by_tag).unwrap(),
            track_ranges,
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct RouteQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Json"]
    pub entry_point: Value,
    #[sql_type = "Json"]
    pub exit_point: Value,
    #[sql_type = "Json"]
    pub release_detectors: Value,
    #[sql_type = "Json"]
    pub path: Value,
}

impl From<RouteQueryable> for Route {
    fn from(route: RouteQueryable) -> Self {
        let entry_point: ObjectRef = serde_json::from_value(route.entry_point).unwrap();
        let exit_point: ObjectRef = serde_json::from_value(route.exit_point).unwrap();
        let release_detectors: Vec<ObjectRef> =
            serde_json::from_value(route.release_detectors).unwrap();
        let path: Vec<DirectionalTrackRange> = serde_json::from_value(route.path).unwrap();
        Route {
            id: route.obj_id,
            entry_point,
            exit_point,
            release_detectors,
            path,
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct TrackSectionLinkQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Json"]
    pub src: Value,
    #[sql_type = "Json"]
    pub dst: Value,
    #[sql_type = "Json"]
    pub navigability: Value,
}

impl From<TrackSectionLinkQueryable> for TrackSectionLink {
    fn from(link: TrackSectionLinkQueryable) -> Self {
        Self {
            id: link.obj_id.clone(),
            src: serde_json::from_value(link.src).unwrap(),
            dst: serde_json::from_value(link.dst).unwrap(),
            navigability: serde_json::from_value(link.navigability).unwrap(),
        }
    }
}

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct SwitchCache {
    pub obj_id: String,
    pub switch_type: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub ports: HashMap<String, TrackEndpoint>,
}

#[derive(QueryableByName, Debug, Clone)]
pub struct SwitchQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Text"]
    pub switch_type: String,
    #[sql_type = "Json"]
    pub ports: Value,
}

impl From<SwitchQueryable> for SwitchCache {
    fn from(switch: SwitchQueryable) -> Self {
        Self {
            obj_id: switch.obj_id,
            switch_type: switch.switch_type,
            ports: serde_json::from_value(switch.ports).unwrap(),
        }
    }
}

impl SwitchCache {
    pub fn new(obj_id: String, switch_type: String, ports: HashMap<String, TrackEndpoint>) -> Self {
        Self {
            obj_id,
            switch_type,
            ports,
        }
    }
}

impl From<&Switch> for SwitchCache {
    fn from(switch: &Switch) -> Self {
        Self::new(
            switch.id.clone(),
            switch.switch_type.obj_id.clone(),
            switch.ports.clone(),
        )
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct SwitchTypeQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Json"]
    pub ports: Value,
    #[sql_type = "Json"]
    pub groups: Value,
}

impl From<SwitchTypeQueryable> for SwitchType {
    fn from(switch_type: SwitchTypeQueryable) -> Self {
        let ports: Vec<String> = serde_json::from_value(switch_type.ports).unwrap();
        let groups: HashMap<String, Vec<SwitchPortConnection>> =
            serde_json::from_value(switch_type.groups).unwrap();
        SwitchType {
            id: switch_type.obj_id,
            ports,
            groups,
        }
    }
}

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct OperationalPointCache {
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub parts: Vec<OperationalPointPart>,
}

#[derive(QueryableByName, Debug, Clone)]
pub struct OperationalPointQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Json"]
    pub parts: Value,
}

impl From<OperationalPointQueryable> for OperationalPointCache {
    fn from(op: OperationalPointQueryable) -> Self {
        Self {
            obj_id: op.obj_id,
            parts: serde_json::from_value(op.parts).unwrap(),
        }
    }
}

impl OperationalPointCache {
    pub fn new(obj_id: String, parts: Vec<OperationalPointPart>) -> Self {
        Self { obj_id, parts }
    }
}

impl From<&OperationalPoint> for OperationalPointCache {
    fn from(op: &OperationalPoint) -> Self {
        Self::new(op.id.clone(), op.parts.clone())
    }
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct DetectorCache {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Text"]
    pub track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Double"]
    pub position: f64,
}

impl DetectorCache {
    pub fn new(obj_id: String, track: String, position: f64) -> Self {
        Self {
            obj_id,
            track,
            position,
        }
    }
}

impl From<&Detector> for DetectorCache {
    fn from(det: &Detector) -> Self {
        Self::new(det.id.clone(), det.track.obj_id.clone(), det.position)
    }
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct BufferStopCache {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Text"]
    pub track: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Double"]
    pub position: f64,
}

impl BufferStopCache {
    pub fn new(obj_id: String, track: String, position: f64) -> Self {
        Self {
            obj_id,
            track,
            position,
        }
    }
}

impl From<&BufferStop> for BufferStopCache {
    fn from(stop: &BufferStop) -> Self {
        Self::new(stop.id.clone(), stop.track.obj_id.clone(), stop.position)
    }
}

impl InfraCache {
    fn add_track_ref(&mut self, track_id: String, obj_ref: ObjectRef) {
        self.track_sections_refs
            .entry(track_id)
            .or_default()
            .insert(obj_ref);
    }

    fn load_track_section(&mut self, track: TrackCache) {
        self.track_sections.insert(track.obj_id.clone(), track);
    }

    fn load_signal(&mut self, signal: SignalCache) {
        self.add_track_ref(
            signal.track.clone(),
            ObjectRef::new(ObjectType::Signal, signal.obj_id.clone()),
        );
        assert!(self.signals.insert(signal.obj_id.clone(), signal).is_none());
    }

    fn load_speed_section(&mut self, speed: SpeedSection) {
        for track_range in speed.track_ranges.iter() {
            self.add_track_ref(
                track_range.track.obj_id.clone(),
                ObjectRef::new(ObjectType::SpeedSection, speed.id.clone()),
            );
        }
        assert!(self
            .speed_sections
            .insert(speed.id.clone(), speed)
            .is_none());
    }

    fn load_route(&mut self, route: Route) {
        for path in route.path.iter() {
            self.add_track_ref(
                path.track.obj_id.clone(),
                ObjectRef::new(ObjectType::Route, route.id.clone()),
            );
        }
        assert!(self.routes.insert(route.id.clone(), route).is_none());
    }

    fn load_operational_point(&mut self, op: OperationalPointCache) {
        for part in op.parts.iter() {
            self.add_track_ref(
                part.track.obj_id.clone(),
                ObjectRef::new(ObjectType::OperationalPoint, op.obj_id.clone()),
            );
        }
        assert!(self
            .operational_points
            .insert(op.obj_id.clone(), op)
            .is_none());
    }

    fn load_track_section_link(&mut self, link: TrackSectionLink) {
        for endpoint in [&link.src, &link.dst] {
            self.add_track_ref(
                endpoint.track.obj_id.clone(),
                ObjectRef::new(ObjectType::TrackSectionLink, link.id.clone()),
            );
        }
        assert!(self
            .track_section_links
            .insert(link.id.clone(), link)
            .is_none());
    }

    fn load_switch(&mut self, switch: SwitchCache) {
        for port in switch.ports.iter() {
            self.add_track_ref(
                port.1.track.obj_id.clone(),
                ObjectRef::new(ObjectType::Switch, switch.obj_id.clone()),
            );
        }
        assert!(self
            .switches
            .insert(switch.obj_id.clone(), switch)
            .is_none());
    }

    fn load_switch_type(&mut self, switch_type: SwitchType) {
        assert!(self
            .switch_types
            .insert(switch_type.id.clone(), switch_type)
            .is_none());
    }

    fn load_detector(&mut self, detector: DetectorCache) {
        self.add_track_ref(
            detector.track.clone(),
            ObjectRef::new(ObjectType::Detector, detector.obj_id.clone()),
        );
        assert!(self
            .detectors
            .insert(detector.obj_id.clone(), detector)
            .is_none());
    }

    fn load_buffer_stop(&mut self, buffer_stop: BufferStopCache) {
        self.add_track_ref(
            buffer_stop.track.clone(),
            ObjectRef::new(ObjectType::BufferStop, buffer_stop.obj_id.clone()),
        );
        assert!(self
            .buffer_stops
            .insert(buffer_stop.obj_id.clone(), buffer_stop)
            .is_none());
    }

    /// Given an infra id load infra cache from database
    pub fn load(conn: &PgConnection, infra_id: i32) -> InfraCache {
        let mut infra_cache = Self::default();

        // Load track sections list
        sql_query(
            "SELECT obj_id, (data->>'length')::float as length, data->>'geo' as geo, data->>'sch' as sch FROM osrd_infra_tracksectionmodel WHERE infra_id = $1",
        )
        .bind::<Integer, _>(infra_id)
        .load::<TrackQueryable>(conn)
        .expect("Error loading track sections").into_iter().for_each(|track| infra_cache.load_track_section(track.into()));

        // Load signal tracks references
        sql_query(
            "SELECT obj_id, data->'track'->>'id' AS track, (data->>'position')::float AS position FROM osrd_infra_signalmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SignalCache>(conn).expect("Error loading signal refs").into_iter().for_each(|signal| 
            infra_cache.load_signal(signal)
        );

        // Load speed sections tracks references
        sql_query(
            "SELECT obj_id, data->>'track_ranges' AS track_ranges, (data->>'speed_limit')::float AS speed_limit, data->>'speed_limit_by_tag' AS speed_limit_by_tag FROM osrd_infra_speedsectionmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SpeedSectionQueryable>(conn).expect("Error loading speed section refs").into_iter().for_each(|speed| 
            infra_cache.load_speed_section(speed.into())
        );

        // Load routes tracks references
        sql_query(
            "SELECT obj_id, data->>'entry_point' AS entry_point, data->>'exit_point' AS exit_point, data->>'release_detectors' AS release_detectors, data->>'path' AS path FROM osrd_infra_routemodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<RouteQueryable>(conn).expect("Error loading route refs").into_iter().for_each(|route| 
            infra_cache.load_route(route.into())
        );

        // Load operational points tracks references
        sql_query(
            "SELECT obj_id, data->>'parts' AS parts FROM osrd_infra_operationalpointmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<OperationalPointQueryable>(conn).expect("Error loading operational point refs").into_iter().for_each(|op| 
            infra_cache.load_operational_point(op.into())
        );

        // Load track section links tracks references
        sql_query(
            "SELECT obj_id, data->>'src' AS src, data->>'dst' AS dst, (data->'navigability')::text as navigability FROM osrd_infra_tracksectionlinkmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<TrackSectionLinkQueryable>(conn).expect("Error loading track section link refs").into_iter().for_each(|link| 
            infra_cache.load_track_section_link(link.into())
        );

        // Load switch tracks references
        sql_query(
            "SELECT obj_id, data->'switch_type'->>'id' AS switch_type, data->>'ports' AS ports FROM osrd_infra_switchmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SwitchQueryable>(conn).expect("Error loading switch refs").into_iter().for_each(|switch| {
            infra_cache.load_switch(switch.into());
        });

        // Load switch types references
        sql_query(
            "SELECT obj_id, data->>'ports' AS ports, data->>'groups' AS groups FROM osrd_infra_switchtypemodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SwitchTypeQueryable>(conn).expect("Error loading switch types refs").into_iter().for_each(|switch_type| 
            infra_cache.load_switch_type(switch_type.into())
        );

        // Load detector tracks references
        sql_query(
            "SELECT obj_id, data->'track'->>'id' AS track, (data->>'position')::float AS position FROM osrd_infra_detectormodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<DetectorCache>(conn).expect("Error loading detector refs").into_iter().for_each(|detector| 
            infra_cache.load_detector(detector)
        );

        // Load buffer stop tracks references
        sql_query(
            "SELECT obj_id, data->'track'->>'id' AS track, (data->>'position')::float AS position FROM osrd_infra_bufferstopmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<BufferStopCache>(conn).expect("Error loading buffer stop refs").into_iter().for_each(|buffer_stop| 
            infra_cache.load_buffer_stop(buffer_stop)
        );

        infra_cache
    }

    /// Get all track sections references of a given track and type
    pub fn get_track_refs_type(&self, track_id: &String, obj_type: ObjectType) -> Vec<&ObjectRef> {
        if let Some(refs) = self.track_sections_refs.get(track_id) {
            refs.iter()
                .filter(|obj_ref| obj_ref.obj_type == obj_type)
                .collect()
        } else {
            vec![]
        }
    }

    /// Apply delete operation to the infra cache
    fn apply_delete(&mut self, object_ref: &ObjectRef) {
        match object_ref {
            ObjectRef {
                obj_type: ObjectType::Signal,
                obj_id,
            } => {
                let signal = self.signals.remove(obj_id).unwrap();
                self.track_sections_refs
                    .get_mut(&signal.track)
                    .unwrap()
                    .remove(object_ref);
            }
            ObjectRef {
                obj_type: ObjectType::SpeedSection,
                obj_id,
            } => {
                let speed = self.speed_sections.remove(obj_id).unwrap();
                for track_range in speed.track_ranges {
                    self.track_sections_refs
                        .get_mut(&track_range.track.obj_id)
                        .unwrap()
                        .remove(object_ref);
                }
            }
            ObjectRef {
                obj_type: ObjectType::Route,
                obj_id,
            } => {
                let route = self.routes.remove(obj_id).unwrap();
                for path in route.path {
                    self.track_sections_refs
                        .get_mut(&path.track.obj_id)
                        .unwrap()
                        .remove(object_ref);
                }
            }
            ObjectRef {
                obj_type: ObjectType::OperationalPoint,
                obj_id,
            } => {
                let op = self.operational_points.remove(obj_id).unwrap();
                for part in op.parts {
                    self.track_sections_refs
                        .get_mut(&part.track.obj_id)
                        .unwrap()
                        .remove(object_ref);
                }
            }
            ObjectRef {
                obj_type: ObjectType::TrackSectionLink,
                obj_id,
            } => {
                let link = self.track_section_links.remove(obj_id).unwrap();
                self.track_sections_refs
                    .get_mut(&link.src.track.obj_id)
                    .unwrap()
                    .remove(object_ref);
                self.track_sections_refs
                    .get_mut(&link.dst.track.obj_id)
                    .unwrap()
                    .remove(object_ref);
            }
            ObjectRef {
                obj_type: ObjectType::Switch,
                obj_id,
            } => {
                let switch = self.switches.remove(obj_id).unwrap();
                for endpoint in switch.ports.values() {
                    self.track_sections_refs
                        .get_mut(&endpoint.track.obj_id)
                        .unwrap()
                        .remove(object_ref);
                }
            }
            ObjectRef {
                obj_type: ObjectType::SwitchType,
                obj_id,
            } => {
                self.switch_types.remove(obj_id).unwrap();
            }
            ObjectRef {
                obj_type: ObjectType::Detector,
                obj_id,
            } => {
                let detector = self.detectors.remove(obj_id).unwrap();
                self.track_sections_refs
                    .get_mut(&detector.track)
                    .unwrap()
                    .remove(object_ref);
            }
            ObjectRef {
                obj_type: ObjectType::BufferStop,
                obj_id,
            } => {
                let buffer_stop = self.buffer_stops.remove(obj_id).unwrap();
                self.track_sections_refs
                    .get_mut(&buffer_stop.track)
                    .unwrap()
                    .remove(object_ref);
            }
            ObjectRef {
                obj_type: ObjectType::TrackSection,
                obj_id,
            } => {
                self.track_sections.remove(obj_id);
            }
        }
    }

    /// Apply update operation to the infra cache
    fn apply_update(&mut self, railjson_obj: &RailjsonObject) {
        self.apply_delete(&railjson_obj.get_ref());
        self.apply_create(railjson_obj);
    }

    /// Apply create operation to the infra cache
    fn apply_create(&mut self, railjson_obj: &RailjsonObject) {
        match railjson_obj {
            RailjsonObject::TrackSection { railjson } => self.load_track_section(railjson.into()),
            RailjsonObject::Signal { railjson } => self.load_signal(railjson.into()),
            RailjsonObject::SpeedSection { railjson } => self.load_speed_section(railjson.clone()),
            RailjsonObject::Route { railjson } => self.load_route(railjson.clone()),
            RailjsonObject::TrackSectionLink { railjson } => {
                self.load_track_section_link(railjson.clone())
            }
            RailjsonObject::Switch { railjson } => self.load_switch(railjson.into()),
            RailjsonObject::SwitchType { railjson } => self.load_switch_type(railjson.clone()),
            RailjsonObject::Detector { railjson } => self.load_detector(railjson.into()),
            RailjsonObject::BufferStop { railjson } => self.load_buffer_stop(railjson.into()),
            RailjsonObject::OperationalPoint { railjson } => {
                self.load_operational_point(railjson.into())
            }
        }
    }

    /// Apply an operation to the infra cache
    pub fn apply_operations(&mut self, operations: &Vec<OperationResult>) {
        for op_res in operations {
            match op_res {
                OperationResult::Delete(obj_ref) => self.apply_delete(obj_ref),
                OperationResult::Update(railjson_obj) => self.apply_update(railjson_obj),
                OperationResult::Create(railjson_obj) => self.apply_create(railjson_obj),
            }
        }
    }
}

#[cfg(test)]
pub mod tests {
    use std::collections::HashMap;

    use crate::infra_cache::{InfraCache, SwitchCache};
    use crate::models::infra::tests::test_transaction;
    use crate::railjson::operation::create::tests::{
        create_buffer_stop, create_detector, create_link, create_op, create_route, create_signal,
        create_speed, create_switch, create_switch_type, create_track,
    };
    use crate::railjson::{
        ApplicableDirections, Endpoint, ObjectRef, ObjectType, OperationalPoint, Route,
        SpeedSection, Switch, SwitchPortConnection, SwitchType, TrackEndpoint, TrackSectionLink,
    };

    #[test]
    fn load_track_section() {
        test_transaction(|conn, infra| {
            let track = create_track(conn, infra.id, Default::default());
            let infra_cache = InfraCache::load(conn, infra.id);
            assert_eq!(infra_cache.track_sections.len(), 1);
            assert!(infra_cache.track_sections.contains_key(&track.get_obj_id()));
        });
    }

    #[test]
    fn load_signal() {
        test_transaction(|conn, infra| {
            let signal = create_signal(conn, infra.id, Default::default());

            let infra_cache = InfraCache::load(conn, infra.id);

            assert!(infra_cache.signals.contains_key(&signal.get_obj_id()));
            let refs = infra_cache.track_sections_refs;
            assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
        })
    }

    #[test]
    fn load_speed_section() {
        test_transaction(|conn, infra| {
            let speed = create_speed(
                conn,
                infra.id,
                SpeedSection {
                    track_ranges: vec![Default::default()],
                    ..Default::default()
                },
            );

            let infra_cache = InfraCache::load(conn, infra.id);

            assert!(infra_cache.speed_sections.contains_key(&speed.get_obj_id()));
            let refs = infra_cache.track_sections_refs;
            assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
        })
    }

    #[test]
    fn load_route() {
        test_transaction(|conn, infra| {
            let route = create_route(
                conn,
                infra.id,
                Route {
                    path: vec![Default::default()],
                    ..Default::default()
                },
            );

            let infra_cache = InfraCache::load(conn, infra.id);

            assert!(infra_cache.routes.contains_key(&route.get_obj_id()));
            let refs = infra_cache.track_sections_refs;
            assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
        })
    }

    #[test]
    fn load_operational_point() {
        test_transaction(|conn, infra| {
            let op = create_op(
                conn,
                infra.id,
                OperationalPoint {
                    parts: vec![Default::default()],
                    ..Default::default()
                },
            );

            let infra_cache = InfraCache::load(conn, infra.id);

            assert!(infra_cache
                .operational_points
                .contains_key(&op.get_obj_id()));
            let refs = infra_cache.track_sections_refs;
            assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
        })
    }

    #[test]
    fn load_track_section_link() {
        test_transaction(|conn, infra| {
            let link = create_link(conn, infra.id, Default::default());
            let infra_cache = InfraCache::load(conn, infra.id);
            assert!(infra_cache
                .track_section_links
                .contains_key(&link.get_obj_id()));
        })
    }

    #[test]
    fn load_switch() {
        test_transaction(|conn, infra| {
            let switch = create_switch(
                conn,
                infra.id,
                Switch {
                    ports: HashMap::from([("port".into(), Default::default())]),
                    ..Default::default()
                },
            );
            let infra_cache = InfraCache::load(conn, infra.id);
            assert!(infra_cache.switches.contains_key(&switch.get_obj_id()));
        })
    }

    #[test]
    fn load_switch_type() {
        test_transaction(|conn, infra| {
            let s_type = create_switch_type(conn, infra.id, Default::default());
            let infra_cache = InfraCache::load(conn, infra.id);
            assert!(infra_cache.switch_types.contains_key(&s_type.get_obj_id()));
        })
    }

    #[test]
    fn load_detector() {
        test_transaction(|conn, infra| {
            let detector = create_detector(conn, infra.id, Default::default());

            let infra_cache = InfraCache::load(conn, infra.id);

            assert!(infra_cache.detectors.contains_key(&detector.get_obj_id()));
            let refs = infra_cache.track_sections_refs;
            assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
        })
    }

    #[test]
    fn load_buffer_stop() {
        test_transaction(|conn, infra| {
            let bs = create_buffer_stop(conn, infra.id, Default::default());

            let infra_cache = InfraCache::load(conn, infra.id);

            assert!(infra_cache.buffer_stops.contains_key(&bs.get_obj_id()));
            let refs = infra_cache.track_sections_refs;
            assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
        })
    }

    pub fn create_track_endpoint<T: AsRef<str>>(endpoint: Endpoint, obj_id: T) -> TrackEndpoint {
        TrackEndpoint {
            endpoint,
            track: ObjectRef {
                obj_type: ObjectType::TrackSection,
                obj_id: obj_id.as_ref().into(),
            },
        }
    }

    pub fn create_track_link_cache(
        id: String,
        src: TrackEndpoint,
        dst: TrackEndpoint,
    ) -> TrackSectionLink {
        TrackSectionLink {
            id,
            src,
            dst,
            navigability: ApplicableDirections::Both,
        }
    }

    pub fn create_switch_connection(src: String, dst: String) -> SwitchPortConnection {
        SwitchPortConnection {
            src,
            dst,
            bidirectional: true,
        }
    }

    pub fn create_switch_type_point() -> SwitchType {
        SwitchType {
            id: "point".into(),
            ports: vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            groups: HashMap::from([
                (
                    "LEFT".into(),
                    vec![create_switch_connection("BASE".into(), "LEFT".into())],
                ),
                (
                    "RIGHT".into(),
                    vec![create_switch_connection("BASE".into(), "RIGHT".into())],
                ),
            ]),
        }
    }

    pub fn create_switch_cache_point(
        obj_id: String,
        base: TrackEndpoint,
        left: TrackEndpoint,
        right: TrackEndpoint,
    ) -> SwitchCache {
        let ports_list = [("BASE", base), ("LEFT", left), ("RIGHT", right)];
        let ports: HashMap<String, TrackEndpoint> =
            ports_list.into_iter().map(|(s, t)| (s.into(), t)).collect();
        SwitchCache {
            obj_id,
            switch_type: "point".into(),
            ports,
        }
    }

    ///                    --------  C
    ///                   /
    ///  --------_--------
    ///     A        B    \
    ///                    --------  D
    ///
    pub fn create_small_infra_cache() -> InfraCache {
        let mut infra_cache = InfraCache::default();

        let link = create_track_link_cache(
            "tracklink".into(),
            create_track_endpoint(Endpoint::End, "A"),
            create_track_endpoint(Endpoint::Begin, "B"),
        );

        infra_cache
            .track_section_links
            .insert(link.id.clone(), link);

        infra_cache
            .switch_types
            .insert("point".into(), create_switch_type_point());

        let switch = create_switch_cache_point(
            "switch".into(),
            create_track_endpoint(Endpoint::End, "B"),
            create_track_endpoint(Endpoint::Begin, "C"),
            create_track_endpoint(Endpoint::Begin, "D"),
        );

        infra_cache.switches.insert(switch.obj_id.clone(), switch);

        infra_cache
    }
}
