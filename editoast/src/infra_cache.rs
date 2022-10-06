use crate::schema::operation::{OperationResult, RailjsonObject};
use crate::schema::*;
use diesel::sql_types::{Double, Integer, Nullable, Text};
use diesel::PgConnection;
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use enum_map::EnumMap;
use std::collections::{HashMap, HashSet};

/// Contains infra cached data used to generate layers and errors
#[derive(Debug, Default)]
pub struct InfraCache {
    /// Map track section id to the list of objects that depend on it
    /// Contains all referenced track sections (not only existing ones)
    pub track_sections_refs: HashMap<String, HashSet<ObjectRef>>,

    /// Map reference to their cache object
    objects: EnumMap<ObjectType, HashMap<String, ObjectCache>>,
}

pub trait Cache: OSRDObject {
    /// Return the list of track section ids referenced by the object
    fn get_track_referenced_id(&self) -> Vec<&String>;

    /// Build and return the cache object
    fn get_object_cache(&self) -> ObjectCache;
}

#[derive(Debug, Clone)]
pub enum ObjectCache {
    TrackSection(TrackSectionCache),
    Signal(SignalCache),
    SpeedSection(SpeedSection),
    TrackSectionLink(TrackSectionLink),
    Switch(SwitchCache),
    Detector(DetectorCache),
    BufferStop(BufferStopCache),
    Route(Route),
    OperationalPoint(OperationalPointCache),
    SwitchType(SwitchType),
    Catenary(Catenary),
}

impl OSRDObject for ObjectCache {
    fn get_id(&self) -> &String {
        match self {
            ObjectCache::TrackSection(obj) => obj.get_id(),
            ObjectCache::Signal(obj) => obj.get_id(),
            ObjectCache::SpeedSection(obj) => obj.get_id(),
            ObjectCache::TrackSectionLink(obj) => obj.get_id(),
            ObjectCache::Switch(obj) => obj.get_id(),
            ObjectCache::Detector(obj) => obj.get_id(),
            ObjectCache::BufferStop(obj) => obj.get_id(),
            ObjectCache::Route(obj) => obj.get_id(),
            ObjectCache::OperationalPoint(obj) => obj.get_id(),
            ObjectCache::SwitchType(obj) => obj.get_id(),
            ObjectCache::Catenary(obj) => obj.get_id(),
        }
    }

    fn get_type(&self) -> ObjectType {
        match self {
            ObjectCache::TrackSection(_) => ObjectType::TrackSection,
            ObjectCache::Signal(_) => ObjectType::Signal,
            ObjectCache::SpeedSection(_) => ObjectType::SpeedSection,
            ObjectCache::TrackSectionLink(_) => ObjectType::TrackSectionLink,
            ObjectCache::Switch(_) => ObjectType::Switch,
            ObjectCache::Detector(_) => ObjectType::Detector,
            ObjectCache::BufferStop(_) => ObjectType::BufferStop,
            ObjectCache::Route(_) => ObjectType::Route,
            ObjectCache::OperationalPoint(_) => ObjectType::OperationalPoint,
            ObjectCache::SwitchType(_) => ObjectType::SwitchType,
            ObjectCache::Catenary(_) => ObjectType::Catenary,
        }
    }
}

impl Cache for ObjectCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        match self {
            ObjectCache::TrackSection(track) => track.get_track_referenced_id(),
            ObjectCache::Signal(signal) => signal.get_track_referenced_id(),
            ObjectCache::SpeedSection(speed) => speed.get_track_referenced_id(),
            ObjectCache::TrackSectionLink(link) => link.get_track_referenced_id(),
            ObjectCache::Switch(switch) => switch.get_track_referenced_id(),
            ObjectCache::Detector(detector) => detector.get_track_referenced_id(),
            ObjectCache::BufferStop(buffer_stop) => buffer_stop.get_track_referenced_id(),
            ObjectCache::Route(route) => route.get_track_referenced_id(),
            ObjectCache::OperationalPoint(op) => op.get_track_referenced_id(),
            ObjectCache::SwitchType(switch_type) => switch_type.get_track_referenced_id(),
            ObjectCache::Catenary(catenary) => catenary.get_track_referenced_id(),
        }
    }

    fn get_object_cache(&self) -> ObjectCache {
        self.clone()
    }
}

impl ObjectCache {
    /// Unwrap a track section from the object cache
    pub fn unwrap_track_section(&self) -> &TrackSectionCache {
        match self {
            ObjectCache::TrackSection(track) => track,
            _ => panic!("ObjectCache is not a TrackSection"),
        }
    }

    /// Unwrap a signal from the object cache
    pub fn unwrap_signal(&self) -> &SignalCache {
        match self {
            ObjectCache::Signal(signal) => signal,
            _ => panic!("ObjectCache is not a Signal"),
        }
    }

    /// Unwrap a speed section from the object cache
    pub fn unwrap_speed_section(&self) -> &SpeedSection {
        match self {
            ObjectCache::SpeedSection(speed) => speed,
            _ => panic!("ObjectCache is not a SpeedSection"),
        }
    }

    /// Unwrap a track section link from the object cache
    pub fn unwrap_track_section_link(&self) -> &TrackSectionLink {
        match self {
            ObjectCache::TrackSectionLink(link) => link,
            _ => panic!("ObjectCache is not a TrackSectionLink"),
        }
    }

    /// Unwrap a switch from the object cache
    pub fn unwrap_switch(&self) -> &SwitchCache {
        match self {
            ObjectCache::Switch(switch) => switch,
            _ => panic!("ObjectCache is not a Switch"),
        }
    }

    /// Unwrap a detector from the object cache
    pub fn unwrap_detector(&self) -> &DetectorCache {
        match self {
            ObjectCache::Detector(detector) => detector,
            _ => panic!("ObjectCache is not a Detector"),
        }
    }

    /// Unwrap a buffer stop from the object cache
    pub fn unwrap_buffer_stop(&self) -> &BufferStopCache {
        match self {
            ObjectCache::BufferStop(buffer_stop) => buffer_stop,
            _ => panic!("ObjectCache is not a BufferStop"),
        }
    }

    /// Unwrap a route from the object cache
    pub fn unwrap_route(&self) -> &Route {
        match self {
            ObjectCache::Route(route) => route,
            _ => panic!("ObjectCache is not a Route"),
        }
    }

    /// Unwrap an operational point from the object cache
    pub fn unwrap_operational_point(&self) -> &OperationalPointCache {
        match self {
            ObjectCache::OperationalPoint(op) => op,
            _ => panic!("ObjectCache is not a OperationalPoint"),
        }
    }

    /// Unwrap a switch type from the object cache
    pub fn unwrap_switch_type(&self) -> &SwitchType {
        match self {
            ObjectCache::SwitchType(switch_type) => switch_type,
            _ => panic!("ObjectCache is not a SwitchType"),
        }
    }

    /// Unwrap a catenary from the object cache
    pub fn unwrap_catenary(&self) -> &Catenary {
        match self {
            ObjectCache::Catenary(catenary) => catenary,
            _ => panic!("ObjectCache is not a Catenary"),
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct TrackQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Double"]
    pub length: f64,
    #[sql_type = "Text"]
    pub geo: String,
    #[sql_type = "Text"]
    pub sch: String,
}

impl From<TrackQueryable> for TrackSectionCache {
    fn from(track: TrackQueryable) -> Self {
        let geo: LineString = serde_json::from_str(&track.geo).unwrap();
        let sch: LineString = serde_json::from_str(&track.sch).unwrap();
        Self {
            obj_id: track.obj_id,
            length: track.length,
            bbox_geo: geo.get_bbox(),
            bbox_sch: sch.get_bbox(),
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct SpeedSectionQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Text"]
    pub track_ranges: String,
    #[sql_type = "Nullable<Double>"]
    pub speed_limit: Option<f64>,
    #[sql_type = "Text"]
    pub speed_limit_by_tag: String,
}

impl From<SpeedSectionQueryable> for SpeedSection {
    fn from(speed: SpeedSectionQueryable) -> Self {
        let track_ranges: Vec<ApplicableDirectionsTrackRange> =
            serde_json::from_str(&speed.track_ranges).unwrap();
        SpeedSection {
            id: speed.obj_id.clone(),
            speed_limit: speed.speed_limit,
            speed_limit_by_tag: serde_json::from_str(&speed.speed_limit_by_tag).unwrap(),
            track_ranges,
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct RouteQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Text"]
    pub entry_point: String,
    #[sql_type = "Text"]
    pub exit_point: String,
    #[sql_type = "Text"]
    pub release_detectors: String,
    #[sql_type = "Text"]
    pub path: String,
}

impl From<RouteQueryable> for Route {
    fn from(route: RouteQueryable) -> Self {
        let entry_point: Waypoint = serde_json::from_str(&route.entry_point).unwrap();
        let exit_point: Waypoint = serde_json::from_str(&route.exit_point).unwrap();
        let release_detectors: Vec<String> =
            serde_json::from_str(&route.release_detectors).unwrap();
        let path: Vec<DirectionalTrackRange> = serde_json::from_str(&route.path).unwrap();
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
    #[sql_type = "Text"]
    pub src: String,
    #[sql_type = "Text"]
    pub dst: String,
}

impl From<TrackSectionLinkQueryable> for TrackSectionLink {
    fn from(link: TrackSectionLinkQueryable) -> Self {
        Self {
            id: link.obj_id.clone(),
            src: serde_json::from_str(&link.src).unwrap(),
            dst: serde_json::from_str(&link.dst).unwrap(),
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct SwitchQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Text"]
    pub switch_type: String,
    #[sql_type = "Text"]
    pub ports: String,
}

impl From<SwitchQueryable> for SwitchCache {
    fn from(switch: SwitchQueryable) -> Self {
        Self {
            obj_id: switch.obj_id,
            switch_type: switch.switch_type,
            ports: serde_json::from_str(&switch.ports).unwrap(),
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct SwitchTypeQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Text"]
    pub ports: String,
    #[sql_type = "Text"]
    pub groups: String,
}

impl From<SwitchTypeQueryable> for SwitchType {
    fn from(switch_type: SwitchTypeQueryable) -> Self {
        SwitchType {
            id: switch_type.obj_id,
            ports: serde_json::from_str(&switch_type.ports).unwrap(),
            groups: serde_json::from_str(&switch_type.groups).unwrap(),
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct OperationalPointQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Text"]
    pub parts: String,
}

impl From<OperationalPointQueryable> for OperationalPointCache {
    fn from(op: OperationalPointQueryable) -> Self {
        Self {
            obj_id: op.obj_id,
            parts: serde_json::from_str(&op.parts).unwrap(),
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct CatenaryQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Double"]
    pub voltage: f64,
    #[sql_type = "Text"]
    pub track_ranges: String,
}

impl From<CatenaryQueryable> for Catenary {
    fn from(catenary: CatenaryQueryable) -> Self {
        Self {
            id: catenary.obj_id,
            voltage: catenary.voltage,
            track_ranges: serde_json::from_str(&catenary.track_ranges).unwrap(),
        }
    }
}

impl InfraCache {
    /// Add an object to the cache.
    /// If the object already exists, it will fails.
    pub fn add<T: Cache>(&mut self, obj: T) {
        for track_id in obj.get_track_referenced_id() {
            self.track_sections_refs
                .entry(track_id.clone())
                .or_default()
                .insert(obj.get_ref());
        }

        assert!(self.objects[obj.get_type()]
            .insert(obj.get_id().clone(), obj.get_object_cache())
            .is_none());
    }

    /// Retrieve the cache of track sections
    pub fn track_sections(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::TrackSection]
    }

    /// Retrieve the cache of detectors
    pub fn detectors(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::Detector]
    }

    /// Retrieve the cache of buffer stops
    pub fn buffer_stops(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::BufferStop]
    }

    /// Retrieve the cache of signals
    pub fn signals(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::Signal]
    }

    /// Retrieve the cache of speed sections
    pub fn speed_sections(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::SpeedSection]
    }

    /// Retrieve the cache of routes
    pub fn routes(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::Route]
    }

    /// Retrieve the cache of track section links
    pub fn track_section_links(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::TrackSectionLink]
    }

    /// Retrieve the cache of switches
    pub fn switches(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::Switch]
    }

    /// Retrieve the cache of switch types
    pub fn switch_types(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::SwitchType]
    }

    /// Retrieve the cache of operational points
    pub fn operational_points(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::OperationalPoint]
    }

    /// Retrieve the cache of catenaries
    pub fn catenaries(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::Catenary]
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
        .expect("Error loading track sections").into_iter().for_each(|track| infra_cache.add::<TrackSectionCache>(track.into()));

        // Load signal tracks references
        sql_query(
            "SELECT obj_id, data->>'track' AS track, (data->>'position')::float AS position FROM osrd_infra_signalmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SignalCache>(conn).expect("Error loading signal refs").into_iter().for_each(|signal| 
            infra_cache.add(signal)
        );

        // Load speed sections tracks references
        sql_query(
            "SELECT obj_id, data->>'track_ranges' AS track_ranges, (data->>'speed_limit')::float AS speed_limit, data->>'speed_limit_by_tag' AS speed_limit_by_tag FROM osrd_infra_speedsectionmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SpeedSectionQueryable>(conn).expect("Error loading speed section refs").into_iter().for_each(|speed| 
            infra_cache.add::<SpeedSection>(speed.into())
        );

        // Load routes tracks references
        sql_query(
            "SELECT obj_id, data->>'entry_point' AS entry_point, data->>'exit_point' AS exit_point, data->>'release_detectors' AS release_detectors, data->>'path' AS path FROM osrd_infra_routemodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<RouteQueryable>(conn).expect("Error loading route refs").into_iter().for_each(|route| 
            infra_cache.add::<Route>(route.into())
        );

        // Load operational points tracks references
        sql_query(
            "SELECT obj_id, data->>'parts' AS parts FROM osrd_infra_operationalpointmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<OperationalPointQueryable>(conn).expect("Error loading operational point refs").into_iter().for_each(|op| 
            infra_cache.add::<OperationalPointCache>(op.into())
        );

        // Load track section links tracks references
        sql_query(
            "SELECT obj_id, data->>'src' AS src, data->>'dst' AS dst FROM osrd_infra_tracksectionlinkmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<TrackSectionLinkQueryable>(conn).expect("Error loading track section link refs").into_iter().for_each(|link| 
            infra_cache.add::<TrackSectionLink>(link.into())
        );

        // Load switch tracks references
        sql_query(
            "SELECT obj_id, data->>'switch_type' AS switch_type, data->>'ports' AS ports FROM osrd_infra_switchmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SwitchQueryable>(conn).expect("Error loading switch refs").into_iter().for_each(|switch| {
            infra_cache.add::<SwitchCache>(switch.into());
        });

        // Load switch types references
        sql_query(
            "SELECT obj_id, data->>'ports' AS ports, data->>'groups' AS groups FROM osrd_infra_switchtypemodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SwitchTypeQueryable>(conn).expect("Error loading switch types refs").into_iter().for_each(|switch_type| 
            infra_cache.add::<SwitchType>(switch_type.into())
        );

        // Load detector tracks references
        sql_query(
            "SELECT obj_id, data->>'track' AS track, (data->>'position')::float AS position FROM osrd_infra_detectormodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<DetectorCache>(conn).expect("Error loading detector refs").into_iter().for_each(|detector| 
            infra_cache.add(detector)
        );

        // Load buffer stop tracks references
        sql_query(
            "SELECT obj_id, data->>'track' AS track, (data->>'position')::float AS position FROM osrd_infra_bufferstopmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<BufferStopCache>(conn).expect("Error loading buffer stop refs").into_iter().for_each(|buffer_stop| 
            infra_cache.add(buffer_stop)
        );

        // Load catenary tracks references
        sql_query(
            "SELECT obj_id, (data->>'voltage')::float AS voltage, data->>'track_ranges' AS track_ranges FROM osrd_infra_catenarymodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<CatenaryQueryable>(conn).expect("Error loading catenary refs").into_iter().for_each(|catenary| 
            infra_cache.add::<Catenary>(catenary.into())
        );

        infra_cache
    }

    /// Get all track sections references of a given track and type
    pub fn get_track_refs_type(&self, track_id: &String, obj_type: ObjectType) -> Vec<&ObjectRef> {
        self.track_sections_refs
            .get(track_id)
            .map(|set| {
                set.iter()
                    .filter(|obj_ref| obj_ref.obj_type == obj_type)
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Apply delete operation to the infra cache
    pub fn apply_delete(&mut self, object_ref: &ObjectRef) {
        let obj_cache = self.objects[object_ref.obj_type]
            .remove(&object_ref.obj_id)
            .unwrap();

        for track_id in obj_cache.get_track_referenced_id() {
            self.track_sections_refs
                .get_mut(track_id)
                .unwrap()
                .remove(object_ref);
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
            RailjsonObject::TrackSection { railjson } => {
                self.add::<TrackSectionCache>(railjson.clone().into())
            }
            RailjsonObject::Signal { railjson } => self.add::<SignalCache>(railjson.clone().into()),
            RailjsonObject::SpeedSection { railjson } => self.add(railjson.clone()),
            RailjsonObject::TrackSectionLink { railjson } => {
                self.add::<TrackSectionLink>(railjson.clone())
            }
            RailjsonObject::Switch { railjson } => self.add::<SwitchCache>(railjson.clone().into()),
            RailjsonObject::SwitchType { railjson } => self.add::<SwitchType>(railjson.clone()),
            RailjsonObject::Detector { railjson } => {
                self.add::<DetectorCache>(railjson.clone().into())
            }
            RailjsonObject::BufferStop { railjson } => {
                self.add::<BufferStopCache>(railjson.clone().into())
            }
            RailjsonObject::Route { railjson } => self.add::<Route>(railjson.clone()),
            RailjsonObject::OperationalPoint { railjson } => {
                self.add::<OperationalPointCache>(railjson.clone().into())
            }
            RailjsonObject::Catenary { railjson } => self.add::<Catenary>(railjson.clone()),
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

    use crate::errors::graph::Graph;
    use crate::infra::tests::test_transaction;
    use crate::infra_cache::{InfraCache, SwitchCache};
    use crate::layer::BoundingBox;
    use crate::schema::operation::create::tests::{
        create_buffer_stop, create_catenary, create_detector, create_link, create_op, create_route,
        create_signal, create_speed, create_switch, create_switch_type, create_track,
    };
    use crate::schema::{
        ApplicableDirections, ApplicableDirectionsTrackRange, Catenary, Direction,
        DirectionalTrackRange, Endpoint, OSRDObject, OperationalPoint, OperationalPointPart, Route,
        SpeedSection, Switch, SwitchPortConnection, SwitchType, TrackEndpoint, TrackSectionLink,
        Waypoint,
    };

    use crate::errors::{
        buffer_stops, detectors, operational_points, routes, signals, speed_sections, switch_types,
        switches, track_section_links, track_sections,
    };

    use super::{
        BufferStopCache, DetectorCache, OperationalPointCache, SignalCache, TrackSectionCache,
    };

    #[test]
    fn load_track_section() {
        test_transaction(|conn, infra| {
            let track = create_track(conn, infra.id, Default::default());
            let infra_cache = InfraCache::load(conn, infra.id);
            assert_eq!(infra_cache.track_sections().len(), 1);
            assert!(infra_cache.track_sections().contains_key(track.get_id()));
        });
    }

    #[test]
    fn load_signal() {
        test_transaction(|conn, infra| {
            let signal = create_signal(conn, infra.id, Default::default());

            let infra_cache = InfraCache::load(conn, infra.id);

            assert!(infra_cache.signals().contains_key(signal.get_id()));
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

            assert!(infra_cache.speed_sections().contains_key(speed.get_id()));
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

            assert!(infra_cache.routes().contains_key(route.get_id()));
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

            assert!(infra_cache.operational_points().contains_key(op.get_id()));
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
                .track_section_links()
                .contains_key(link.get_id()));
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
            assert!(infra_cache.switches().contains_key(switch.get_id()));
        })
    }

    #[test]
    fn load_switch_type() {
        test_transaction(|conn, infra| {
            let s_type = create_switch_type(conn, infra.id, Default::default());
            let infra_cache = InfraCache::load(conn, infra.id);
            assert!(infra_cache.switch_types().contains_key(s_type.get_id()));
        })
    }

    #[test]
    fn load_detector() {
        test_transaction(|conn, infra| {
            let detector = create_detector(conn, infra.id, Default::default());

            let infra_cache = InfraCache::load(conn, infra.id);

            assert!(infra_cache.detectors().contains_key(detector.get_id()));
            let refs = infra_cache.track_sections_refs;
            assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
        })
    }

    #[test]
    fn load_buffer_stop() {
        test_transaction(|conn, infra| {
            let bs = create_buffer_stop(conn, infra.id, Default::default());

            let infra_cache = InfraCache::load(conn, infra.id);

            assert!(infra_cache.buffer_stops().contains_key(bs.get_id()));
            let refs = infra_cache.track_sections_refs;
            assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
        })
    }

    #[test]
    fn load_catenary() {
        test_transaction(|conn, infra| {
            let catenary = create_catenary(
                conn,
                infra.id,
                Catenary {
                    track_ranges: vec![Default::default()],
                    ..Default::default()
                },
            );

            let infra_cache = InfraCache::load(conn, infra.id);

            assert!(infra_cache.catenaries().contains_key(catenary.get_id()));
            let refs = infra_cache.track_sections_refs;
            assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
        })
    }

    pub fn create_track_section_cache(obj_id: String, length: f64) -> TrackSectionCache {
        TrackSectionCache {
            obj_id,
            length,
            bbox_geo: BoundingBox::default(),
            bbox_sch: BoundingBox::default(),
        }
    }

    pub fn create_track_endpoint<T: AsRef<str>>(endpoint: Endpoint, obj_id: T) -> TrackEndpoint {
        TrackEndpoint {
            endpoint,
            track: obj_id.as_ref().into(),
        }
    }

    pub fn create_signal_cache<T: AsRef<str>>(obj_id: T, track: T, position: f64) -> SignalCache {
        SignalCache {
            obj_id: obj_id.as_ref().into(),
            track: track.as_ref().into(),
            position,
        }
    }

    pub fn create_detector_cache<T: AsRef<str>>(
        obj_id: T,
        track: T,
        position: f64,
    ) -> DetectorCache {
        DetectorCache {
            obj_id: obj_id.as_ref().into(),
            track: track.as_ref().into(),
            position,
        }
    }

    pub fn create_buffer_stop_cache<T: AsRef<str>>(
        obj_id: T,
        track: T,
        position: f64,
    ) -> BufferStopCache {
        BufferStopCache {
            obj_id: obj_id.as_ref().into(),
            track: track.as_ref().into(),
            position,
        }
    }

    pub fn create_operational_point_cache<T: AsRef<str>>(
        obj_id: T,
        track: T,
        position: f64,
    ) -> OperationalPointCache {
        OperationalPointCache {
            obj_id: obj_id.as_ref().into(),
            parts: vec![OperationalPointPart {
                track: track.as_ref().into(),
                position,
            }],
        }
    }

    pub fn create_speed_section_cache<T: AsRef<str>>(
        id: T,
        range_list: Vec<(T, f64, f64)>,
    ) -> SpeedSection {
        let mut track_ranges = vec![];
        for (obj_id, begin, end) in range_list {
            track_ranges.push(ApplicableDirectionsTrackRange {
                track: obj_id.as_ref().into(),
                begin,
                end,
                applicable_directions: ApplicableDirections::Both,
            });
        }
        SpeedSection {
            id: id.as_ref().into(),
            speed_limit: None,
            speed_limit_by_tag: HashMap::default(),
            track_ranges,
        }
    }

    pub fn create_route_cache<T: AsRef<str>>(
        id: T,
        entry_point: Waypoint,
        exit_point: Waypoint,
        release_detectors: Vec<String>,
        path_list: Vec<(T, f64, f64, Direction)>,
    ) -> Route {
        let mut path = vec![];
        for (obj_id, begin, end, direction) in path_list {
            path.push(DirectionalTrackRange {
                track: obj_id.as_ref().into(),
                begin,
                end,
                direction,
            });
        }
        Route {
            id: id.as_ref().into(),
            entry_point,
            exit_point,
            release_detectors,
            path,
        }
    }

    pub fn create_track_link_cache<T: AsRef<str>>(
        id: T,
        src: TrackEndpoint,
        dst: TrackEndpoint,
    ) -> TrackSectionLink {
        TrackSectionLink {
            id: id.as_ref().into(),
            src,
            dst,
        }
    }

    pub fn create_switch_connection(src: String, dst: String) -> SwitchPortConnection {
        SwitchPortConnection { src, dst }
    }

    pub fn create_switch_type_cache<T: AsRef<str>>(
        id: T,
        ports: Vec<String>,
        groups: HashMap<String, Vec<SwitchPortConnection>>,
    ) -> SwitchType {
        SwitchType {
            id: id.as_ref().into(),
            ports,
            groups,
        }
    }

    pub fn create_switch_cache_point(
        obj_id: String,
        base: (&str, TrackEndpoint),
        left: (&str, TrackEndpoint),
        right: (&str, TrackEndpoint),
        switch_type: String,
    ) -> SwitchCache {
        let ports_list = [base, left, right];
        let ports: HashMap<String, TrackEndpoint> =
            ports_list.into_iter().map(|(s, t)| (s.into(), t)).collect();
        SwitchCache {
            obj_id,
            switch_type,
            ports,
        }
    }

    ///                    -------| C
    ///              D1   /
    /// |--------_---*---
    ///     A        B    \
    ///                    -------| D
    ///
    /// No speed section
    /// No signal
    /// No operational point
    ///
    pub fn create_small_infra_cache() -> InfraCache {
        let mut infra_cache = InfraCache::default();

        for id in 'A'..='D' {
            infra_cache.add(create_track_section_cache(id.into(), 500.))
        }

        infra_cache.add(create_detector_cache("D1", "B", 250.));

        infra_cache.add(create_buffer_stop_cache("BF1", "A", 20.));
        infra_cache.add(create_buffer_stop_cache("BF2", "C", 480.));
        infra_cache.add(create_buffer_stop_cache("BF3", "D", 480.));

        let r1_path = vec![
            ("A", 20., 500., Direction::StartToStop),
            ("B", 0., 250., Direction::StartToStop),
        ];
        infra_cache.add(create_route_cache(
            "R1",
            Waypoint::BufferStop { id: "BF1".into() },
            Waypoint::Detector { id: "D1".into() },
            vec![],
            r1_path,
        ));
        let r2_path = vec![
            ("B", 250., 500., Direction::StartToStop),
            ("C", 0., 480., Direction::StartToStop),
        ];
        infra_cache.add(create_route_cache(
            "R2",
            Waypoint::Detector { id: "D1".into() },
            Waypoint::BufferStop { id: "BF2".into() },
            vec![],
            r2_path,
        ));
        let r3_path = vec![
            ("B", 250., 500., Direction::StartToStop),
            ("D", 0., 480., Direction::StartToStop),
        ];
        infra_cache.add(create_route_cache(
            "R3",
            Waypoint::Detector { id: "D1".into() },
            Waypoint::BufferStop { id: "BF3".into() },
            vec![],
            r3_path,
        ));

        let link = create_track_link_cache(
            "tracklink",
            create_track_endpoint(Endpoint::End, "A"),
            create_track_endpoint(Endpoint::Begin, "B"),
        );
        infra_cache.add(link);

        infra_cache.add(create_switch_type_cache(
            "point",
            vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            HashMap::from([
                (
                    "LEFT".into(),
                    vec![create_switch_connection("BASE".into(), "LEFT".into())],
                ),
                (
                    "RIGHT".into(),
                    vec![create_switch_connection("BASE".into(), "RIGHT".into())],
                ),
            ]),
        ));

        let switch = create_switch_cache_point(
            "switch".into(),
            ("BASE", create_track_endpoint(Endpoint::End, "B")),
            ("LEFT", create_track_endpoint(Endpoint::Begin, "C")),
            ("RIGHT", create_track_endpoint(Endpoint::Begin, "D")),
            "point".into(),
        );
        infra_cache.add(switch);

        infra_cache
    }

    #[test]
    fn small_infra_cache_validation() {
        let small_infra_cache = create_small_infra_cache();

        let graph = Graph::load(&small_infra_cache);

        // Generate the errors
        assert!(track_sections::generate_errors(&small_infra_cache, &graph).is_empty());
        assert!(signals::generate_errors(&small_infra_cache).is_empty());
        assert!(speed_sections::generate_errors(&small_infra_cache).is_empty());
        assert!(track_section_links::generate_errors(&small_infra_cache).is_empty());
        assert!(switch_types::generate_errors(&small_infra_cache).is_empty());
        assert!(switches::generate_errors(&small_infra_cache).is_empty());
        assert!(detectors::generate_errors(&small_infra_cache).is_empty());
        assert!(buffer_stops::generate_errors(&small_infra_cache).is_empty());
        assert!(routes::generate_errors(&small_infra_cache, &graph).is_empty());
        assert!(operational_points::generate_errors(&small_infra_cache).is_empty());
    }
}
