use crate::railjson::operation::{OperationResult, RailjsonObject};
use crate::railjson::{ObjectRef, ObjectType};
use derivative::Derivative;
use diesel::sql_types::{Double, Integer, Text};
use diesel::PgConnection;
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use std::collections::{HashMap, HashSet};

/// Contains infra cached data used to generate layers and errors
#[derive(Debug, Default)]
pub struct InfraCache {
    /// Map speed section id to track sections id
    pub speed_section_dependencies: HashMap<String, Vec<String>>,

    /// Map track section id to the list of objects that depend on it
    /// Contains all referenced track sections (not only existing ones)
    pub track_sections_refs: HashMap<String, HashSet<ObjectRef>>,

    /// List existing track sections
    pub track_sections: HashMap<String, TrackCache>,

    /// List existing signals
    pub signals: HashMap<String, SignalCache>,
}

#[derive(QueryableByName, Debug, Clone)]
struct ObjRefLink {
    #[sql_type = "Text"]
    obj_id: String,
    #[sql_type = "Text"]
    ref_id: String,
}

#[derive(QueryableByName, Debug, Clone, Derivative)]
#[derivative(Hash, PartialEq)]
pub struct TrackCache {
    #[sql_type = "Text"]
    pub obj_id: String,
    #[derivative(Hash = "ignore", PartialEq = "ignore")]
    #[sql_type = "Double"]
    pub length: f64,
}

impl TrackCache {
    fn new(obj_id: String, length: f64) -> Self {
        Self { obj_id, length }
    }
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

impl Eq for TrackCache {}

impl InfraCache {
    fn add_track_ref(&mut self, track_id: String, obj_ref: ObjectRef) {
        self.track_sections_refs
            .entry(track_id)
            .or_default()
            .insert(obj_ref);
    }

    fn add_tracks_refs(&mut self, refs: &[ObjRefLink], obj_type: ObjectType) {
        for link in refs.iter() {
            self.track_sections_refs
                .entry(link.ref_id.clone())
                .or_default()
                .insert(ObjectRef::new(obj_type, link.obj_id.clone()));
        }
    }

    fn load_signals(&mut self, signals: Vec<SignalCache>) {
        for signal in signals {
            self.add_track_ref(
                signal.track.clone(),
                ObjectRef::new(ObjectType::Signal, signal.obj_id.clone()),
            );
            self.signals.insert(signal.obj_id.clone(), signal);
        }
    }

    fn add_speed_section_dependencies(&mut self, refs: &[ObjRefLink]) {
        for link in refs.iter() {
            self.speed_section_dependencies
                .entry(link.obj_id.clone())
                .or_default()
                .push(link.ref_id.clone());
        }
    }

    /// Initialize an infra cache given an infra id
    pub fn init(conn: &PgConnection, infra_id: i32) -> InfraCache {
        let mut infra_cache = Self::default();

        // Load track sections list
        let track_sections = sql_query(
            "SELECT obj_id, (data->>'length')::float as length FROM osrd_infra_tracksectionmodel WHERE infra_id = $1",
        )
        .bind::<Integer, _>(infra_id)
        .load::<TrackCache>(conn)
        .expect("Error loading track sections");
        infra_cache.track_sections = track_sections
            .into_iter()
            .map(|tc| (tc.obj_id.clone(), tc))
            .collect();

        // Load signal tracks references
        infra_cache.load_signals(sql_query(
            "SELECT obj_id, data->'track'->>'id' AS track, (data->>'position')::float AS position FROM osrd_infra_signalmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load::<SignalCache>(conn).expect("Error loading signal refs"));

        // Load speed sections tracks references
        let speed_references = sql_query(
            "SELECT obj_id, jsonb_array_elements(data->'track_ranges')->'track'->>'id' AS ref_id FROM osrd_infra_speedsectionmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load(conn).expect("Error loading signal refs");
        infra_cache.add_tracks_refs(&speed_references, ObjectType::SpeedSection);
        infra_cache.add_speed_section_dependencies(&speed_references);

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
                let track_ids = self.speed_section_dependencies.remove(obj_id).unwrap();
                for track_id in track_ids {
                    self.track_sections_refs
                        .get_mut(&track_id)
                        .unwrap()
                        .remove(object_ref);
                }
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
            RailjsonObject::Signal { railjson } => {
                assert!(self
                    .signals
                    .insert(
                        railjson.id.clone(),
                        SignalCache::new(
                            railjson.id.clone(),
                            railjson.track.obj_id.clone(),
                            railjson.position
                        )
                    )
                    .is_none());
                self.track_sections_refs
                    .entry(railjson.track.obj_id.clone())
                    .or_default()
                    .insert(railjson_obj.get_ref());
            }
            RailjsonObject::SpeedSection { railjson } => {
                assert!(self
                    .speed_section_dependencies
                    .insert(
                        railjson.id.clone(),
                        railjson
                            .track_ranges
                            .iter()
                            .map(|track_range| track_range.track.obj_id.clone())
                            .collect(),
                    )
                    .is_none());
                railjson.track_ranges.iter().for_each(|track_range| {
                    self.track_sections_refs
                        .entry(track_range.track.obj_id.clone())
                        .or_default()
                        .insert(railjson_obj.get_ref());
                });
            }
            RailjsonObject::TrackSection { railjson } => {
                self.track_sections.insert(
                    railjson.id.clone(),
                    TrackCache::new(railjson.id.clone(), railjson.length),
                );
            }
        }
    }

    /// Apply an operation to the infra cache
    pub fn apply(&mut self, op_res: &OperationResult) {
        match op_res {
            OperationResult::Delete(obj_ref) => self.apply_delete(obj_ref),
            OperationResult::Update(railjson_obj) => self.apply_update(railjson_obj),
            OperationResult::Create(railjson_obj) => self.apply_create(railjson_obj),
        }
    }
}
