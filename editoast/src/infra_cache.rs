use crate::models::BoundingBox;
use crate::railjson::operation::{OperationResult, RailjsonObject};
use crate::railjson::{
    ApplicableDirectionsTrackRange, Detector, LineString, ObjectRef, ObjectType, Signal,
    SpeedSection, Switch, TrackEndpoint, TrackSection, TrackSectionLink,
};
use derivative::Derivative;
use diesel::sql_types::{Double, Integer, Json, Text};
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
    pub track_section_links: HashMap<String, TrackSectionLinkCache>,

    /// List existing switches
    pub switches: HashMap<String, SwitchCache>,

    /// List existing detectors
    pub detectors: HashMap<String, DetectorCache>,
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
    #[sql_type = "Double"]
    pub speed: f64,
}

impl From<SpeedSectionQueryable> for SpeedSection {
    fn from(speed: SpeedSectionQueryable) -> Self {
        let track_ranges: Vec<ApplicableDirectionsTrackRange> =
            serde_json::from_value(speed.track_ranges).unwrap();
        SpeedSection {
            id: speed.obj_id.clone(),
            speed: speed.speed,
            track_ranges,
        }
    }
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct TrackSectionLinkCache {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Text"]
    pub src: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Text"]
    pub dst: String,
}

impl TrackSectionLinkCache {
    pub fn new(obj_id: String, src: String, dst: String) -> Self {
        Self { obj_id, src, dst }
    }
}

impl From<&TrackSectionLink> for TrackSectionLinkCache {
    fn from(link: &TrackSectionLink) -> Self {
        Self::new(
            link.id.clone(),
            link.src.track.obj_id.clone(),
            link.dst.track.obj_id.clone(),
        )
    }
}

#[derive(Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct SwitchCache {
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    pub ports: HashMap<String, TrackEndpoint>,
}

#[derive(QueryableByName, Debug, Clone)]
pub struct SwitchQueryable {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Json"]
    pub ports: Value,
}

impl From<SwitchQueryable> for SwitchCache {
    fn from(switch: SwitchQueryable) -> Self {
        Self {
            obj_id: switch.obj_id,
            ports: serde_json::from_value(switch.ports).unwrap(),
        }
    }
}

impl SwitchCache {
    pub fn new(obj_id: String, ports: HashMap<String, TrackEndpoint>) -> Self {
        Self { obj_id, ports }
    }
}

impl From<&Switch> for SwitchCache {
    fn from(switch: &Switch) -> Self {
        Self::new(switch.id.clone(), switch.ports.clone())
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
    fn from(sig: &Detector) -> Self {
        Self::new(sig.id.clone(), sig.track.obj_id.clone(), sig.position)
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

    fn load_track_section_link(&mut self, link: TrackSectionLinkCache) {
        for endpoint in [&link.src, &link.dst] {
            self.add_track_ref(
                endpoint.clone(),
                ObjectRef::new(ObjectType::TrackSectionLink, link.obj_id.clone()),
            );
        }
        assert!(self
            .track_section_links
            .insert(link.obj_id.clone(), link)
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

    /// Initialize an infra cache given an infra id
    pub fn init(conn: &PgConnection, infra_id: i32) -> InfraCache {
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
            "SELECT obj_id, data->>'track_ranges' AS track_ranges, (data->>'speed')::float AS speed FROM osrd_infra_speedsectionmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SpeedSectionQueryable>(conn).expect("Error loading speed section refs").into_iter().for_each(|speed| 
            infra_cache.load_speed_section(speed.into())
        );

        // Load track section links tracks references
        sql_query(
            "SELECT obj_id, data->'src'->'track'->>'id' AS src, data->'dst'->'track'->>'id' AS dst FROM osrd_infra_tracksectionlinkmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<TrackSectionLinkCache>(conn).expect("Error loading track section link refs").into_iter().for_each(|link| 
            infra_cache.load_track_section_link(link)
        );

        // Load switch tracks references
        sql_query(
            "SELECT obj_id, data->>'ports' AS ports FROM osrd_infra_switchmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SwitchQueryable>(conn).expect("Error loading switch refs").into_iter().for_each(|switch| {
            infra_cache.load_switch(switch.into());
        });

        // Load detector tracks references
        sql_query(
            "SELECT obj_id, data->'track'->>'id' AS track, (data->>'position')::float AS position FROM osrd_infra_detectormodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<DetectorCache>(conn).expect("Error loading detector refs").into_iter().for_each(|detector| 
            infra_cache.load_detector(detector)
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
                obj_type: ObjectType::TrackSectionLink,
                obj_id,
            } => {
                let link = self.track_section_links.remove(obj_id).unwrap();
                self.track_sections_refs
                    .get_mut(&link.src)
                    .unwrap()
                    .remove(object_ref);
                self.track_sections_refs
                    .get_mut(&link.dst)
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
                obj_type: ObjectType::TrackSection,
                obj_id,
            } => {
                self.track_sections.remove(obj_id);
            }
            _ => (),
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
            RailjsonObject::TrackSectionLink { railjson } => {
                self.load_track_section_link(railjson.into())
            }
            RailjsonObject::Switch { railjson } => self.load_switch(railjson.into()),
            RailjsonObject::Detector { railjson } => self.load_detector(railjson.into()),
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
