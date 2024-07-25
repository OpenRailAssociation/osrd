mod graph;
pub mod object_cache;
pub mod operation;

use std::collections::hash_map::Entry;
use std::collections::HashMap;
use std::collections::HashSet;

use chashmap::CHashMap;
use chashmap::ReadGuard;
use chashmap::WriteGuard;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Double;
use diesel::sql_types::Integer;
use diesel::sql_types::Nullable;
use diesel::sql_types::Text;
use diesel::QueryableByName;
use diesel_async::RunQueryDsl;
use editoast_derive::EditoastError;
use editoast_schemas::infra::Crossing;
use editoast_schemas::infra::Direction;
use editoast_schemas::infra::DirectionalTrackRange;
use editoast_schemas::infra::DoubleSlipSwitch;
use editoast_schemas::infra::Electrification;
use editoast_schemas::infra::Endpoint;
use editoast_schemas::infra::Link;
use editoast_schemas::infra::NeutralSection;
use editoast_schemas::infra::OperationalPointPart;
use editoast_schemas::infra::PointSwitch;
use editoast_schemas::infra::Route;
use editoast_schemas::infra::RoutePath;
use editoast_schemas::infra::SingleSlipSwitch;
use editoast_schemas::infra::SpeedSection;
use editoast_schemas::infra::TrackNodeType;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::infra::Waypoint;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::OSRDObject;
use editoast_schemas::primitives::ObjectRef;
use editoast_schemas::primitives::ObjectType;
use enum_map::EnumMap;
use geos::geojson::Geometry;
pub use graph::Graph;
use itertools::Itertools as _;
use thiserror::Error;

use crate::error::Result;
use crate::infra_cache::object_cache::BufferStopCache;
use crate::infra_cache::object_cache::DetectorCache;
use crate::infra_cache::object_cache::OperationalPointCache;
use crate::infra_cache::object_cache::SignalCache;
use crate::infra_cache::object_cache::TrackNodeCache;
use crate::infra_cache::object_cache::TrackSectionCache;
use crate::infra_cache::operation::CacheOperation;
use crate::modelsv2::railjson::find_all_schemas;
use crate::modelsv2::Infra;
use editoast_models::DbConnection;
use editoast_schemas::infra::InfraObject;
use editoast_schemas::primitives::BoundingBox;

/// Contains infra cached data used to generate layers and errors
#[derive(Debug, Default, Clone)]
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
    TrackNode(TrackNodeCache),
    Detector(DetectorCache),
    BufferStop(BufferStopCache),
    Route(Route),
    OperationalPoint(OperationalPointCache),
    TrackNodeType(TrackNodeType),
    Electrification(Electrification),
    NeutralSection(NeutralSection),
}

impl From<InfraObject> for ObjectCache {
    fn from(infra_object: InfraObject) -> Self {
        match infra_object {
            InfraObject::TrackSection { railjson } => ObjectCache::TrackSection(railjson.into()),
            InfraObject::Signal { railjson } => ObjectCache::Signal(railjson.into()),
            InfraObject::NeutralSection { railjson } => ObjectCache::NeutralSection(railjson),
            InfraObject::SpeedSection { railjson } => ObjectCache::SpeedSection(railjson),
            InfraObject::TrackNode { railjson } => ObjectCache::TrackNode(railjson.into()),
            InfraObject::TrackNodeType { railjson } => ObjectCache::TrackNodeType(railjson),
            InfraObject::Detector { railjson } => ObjectCache::Detector(railjson.into()),
            InfraObject::BufferStop { railjson } => ObjectCache::BufferStop(railjson.into()),
            InfraObject::Route { railjson } => ObjectCache::Route(railjson),
            InfraObject::OperationalPoint { railjson } => {
                ObjectCache::OperationalPoint(railjson.into())
            }
            InfraObject::Electrification { railjson } => ObjectCache::Electrification(railjson),
        }
    }
}

impl<T: Cache> From<T> for ObjectCache {
    fn from(cache: T) -> Self {
        cache.get_object_cache()
    }
}

impl OSRDIdentified for ObjectCache {
    fn get_id(&self) -> &String {
        match self {
            ObjectCache::TrackSection(obj) => obj.get_id(),
            ObjectCache::Signal(obj) => obj.get_id(),
            ObjectCache::SpeedSection(obj) => obj.get_id(),
            ObjectCache::TrackNode(obj) => obj.get_id(),
            ObjectCache::Detector(obj) => obj.get_id(),
            ObjectCache::BufferStop(obj) => obj.get_id(),
            ObjectCache::Route(obj) => obj.get_id(),
            ObjectCache::OperationalPoint(obj) => obj.get_id(),
            ObjectCache::TrackNodeType(obj) => obj.get_id(),
            ObjectCache::Electrification(obj) => obj.get_id(),
            ObjectCache::NeutralSection(obj) => obj.get_id(),
        }
    }
}

impl OSRDObject for ObjectCache {
    fn get_type(&self) -> ObjectType {
        match self {
            ObjectCache::TrackSection(_) => ObjectType::TrackSection,
            ObjectCache::Signal(_) => ObjectType::Signal,
            ObjectCache::SpeedSection(_) => ObjectType::SpeedSection,
            ObjectCache::TrackNode(_) => ObjectType::TrackNode,
            ObjectCache::Detector(_) => ObjectType::Detector,
            ObjectCache::BufferStop(_) => ObjectType::BufferStop,
            ObjectCache::Route(_) => ObjectType::Route,
            ObjectCache::OperationalPoint(_) => ObjectType::OperationalPoint,
            ObjectCache::TrackNodeType(_) => ObjectType::TrackNodeType,
            ObjectCache::Electrification(_) => ObjectType::Electrification,
            ObjectCache::NeutralSection(_) => ObjectType::NeutralSection,
        }
    }
}

impl ObjectCache {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        match self {
            ObjectCache::TrackSection(track) => track.get_track_referenced_id(),
            ObjectCache::Signal(signal) => signal.get_track_referenced_id(),
            ObjectCache::SpeedSection(speed) => speed.get_track_referenced_id(),
            ObjectCache::TrackNode(track_node) => track_node.get_track_referenced_id(),
            ObjectCache::Detector(detector) => detector.get_track_referenced_id(),
            ObjectCache::BufferStop(buffer_stop) => buffer_stop.get_track_referenced_id(),
            ObjectCache::Route(route) => route.get_track_referenced_id(),
            ObjectCache::OperationalPoint(op) => op.get_track_referenced_id(),
            ObjectCache::TrackNodeType(track_node_type) => track_node_type.get_track_referenced_id(),
            ObjectCache::Electrification(electrification) => {
                electrification.get_track_referenced_id()
            }
            ObjectCache::NeutralSection(neutral_section) => {
                neutral_section.get_track_referenced_id()
            }
        }
    }

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

    /// Unwrap a track_node from the object cache
    pub fn unwrap_track_node(&self) -> &TrackNodeCache {
        match self {
            ObjectCache::TrackNode(track_node) => track_node,
            _ => panic!("ObjectCache is not a TrackNode"),
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

    /// Unwrap a track_node type from the object cache
    pub fn unwrap_track_node_type(&self) -> &TrackNodeType {
        match self {
            ObjectCache::TrackNodeType(track_node_type) => track_node_type,
            _ => panic!("ObjectCache is not a TrackNodeType"),
        }
    }

    /// Unwrap a electrification from the object cache
    pub fn unwrap_electrification(&self) -> &Electrification {
        match self {
            ObjectCache::Electrification(electrification) => electrification,
            _ => panic!("ObjectCache is not a Electrification"),
        }
    }

    /// Unwrap a neutral section from the object cache
    pub fn unwrap_neutral_section(&self) -> &NeutralSection {
        match self {
            ObjectCache::NeutralSection(neutral_section) => neutral_section,
            _ => panic!("ObjectCache is not a NeutralSection"),
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct TrackQueryable {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[diesel(sql_type = Nullable<Integer>)]
    pub line_code: Option<i32>,
    #[diesel(sql_type = Double)]
    pub length: f64,
    #[diesel(sql_type = Text)]
    pub curves: String,
    #[diesel(sql_type = Text)]
    pub slopes: String,
    #[diesel(sql_type = Text)]
    pub geo: String,
}

impl From<TrackQueryable> for TrackSectionCache {
    fn from(track: TrackQueryable) -> Self {
        let geo: Geometry =
            serde_json::from_str(&track.geo).expect("invalid track section geometry");
        Self {
            obj_id: track.obj_id,
            length: track.length,
            curves: serde_json::from_str(&track.curves).unwrap(),
            slopes: serde_json::from_str(&track.slopes).unwrap(),
            line_code: track.line_code,
            bbox_geo: BoundingBox::from_geometry(geo)
                .expect("tracksections' geometry must be LineStrings"),
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct TrackNodeQueryable {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[diesel(sql_type = Text)]
    pub track_node_type: String,
    #[diesel(sql_type = Text)]
    pub ports: String,
}

impl From<TrackNodeQueryable> for TrackNodeCache {
    fn from(track_node: TrackNodeQueryable) -> Self {
        Self {
            obj_id: track_node.obj_id,
            track_node_type: track_node.track_node_type,
            ports: serde_json::from_str(&track_node.ports).unwrap(),
        }
    }
}

#[derive(QueryableByName, Debug, Clone)]
pub struct OperationalPointQueryable {
    #[diesel(sql_type = Text)]
    pub obj_id: String,
    #[diesel(sql_type = Text)]
    pub parts: String,
}

impl From<OperationalPointQueryable> for OperationalPointCache {
    fn from(op: OperationalPointQueryable) -> Self {
        let parts: Vec<OperationalPointPart> = serde_json::from_str(&op.parts).unwrap();
        Self {
            obj_id: op.obj_id,
            parts: parts.into_iter().map_into().collect(),
        }
    }
}

impl InfraCache {
    /// Add an object to the cache.
    /// If the object already exists, it will fail (without inserting).
    pub fn add<T: Cache>(&mut self, obj: T) -> Result<()> {
        for track_id in obj.get_track_referenced_id() {
            self.track_sections_refs
                .entry(track_id.clone())
                .or_default()
                .insert(obj.get_ref());
        }

        let entry = self.objects[obj.get_type()].entry(obj.get_id().clone());
        match entry {
            Entry::Occupied(_) => Err(CacheOperationError::DuplicateIdsProvided {
                obj_type: obj.get_type().to_string(),
                obj_id: obj.get_id().clone(),
            }
            .into()),
            Entry::Vacant(v) => {
                v.insert(obj.get_object_cache());
                Ok(())
            }
        }
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

    /// Retrieve the cache of neutral sections
    pub fn neutral_sections(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::NeutralSection]
    }

    /// Retrieve the cache of routes
    pub fn routes(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::Route]
    }

    /// Retrieve the cache of track_nodes
    pub fn track_nodes(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::TrackNode]
    }

    /// Retrieve the cache of track_node types
    pub fn track_node_types(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::TrackNodeType]
    }

    /// Retrieve the cache of operational points
    pub fn operational_points(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::OperationalPoint]
    }

    /// Retrieve the cache of electrifications
    pub fn electrifications(&self) -> &HashMap<String, ObjectCache> {
        &self.objects[ObjectType::Electrification]
    }

    pub fn get_objects_by_type(&self, object_type: ObjectType) -> &HashMap<String, ObjectCache> {
        &self.objects[object_type]
    }

    /// Given an infra id load infra cache from database
    pub async fn load(conn: &mut DbConnection, infra: &Infra) -> Result<InfraCache> {
        let infra_id = infra.id;
        let mut infra_cache = Self::default();

        // Load track sections list
        sql_query(
            "SELECT
                obj_id,
                (data->'extensions'->'sncf'->>'line_code')::integer as line_code,
                (data->>'length')::float as length,
                data->>'curves' as curves,
                data->>'slopes' as slopes,
                data->>'geo' as geo
            FROM infra_object_track_section WHERE infra_id = $1",
        )
        .bind::<BigInt, _>(infra_id)
        .load::<TrackQueryable>(conn)
        .await?
        .into_iter()
        .try_for_each(|track| infra_cache.add::<TrackSectionCache>(track.into()))?;

        // Load signal tracks references
        sql_query(
            "SELECT obj_id, data->>'track' AS track, (data->>'position')::float AS position, data->'logical_signals' as logical_signals FROM infra_object_signal WHERE infra_id = $1")
        .bind::<BigInt, _>(infra_id)
        .load::<SignalCache>(conn).await?.into_iter().try_for_each(|signal|
            infra_cache.add(signal)
        )?;

        // Load speed sections tracks references
        find_all_schemas::<SpeedSection, Vec<_>>(conn, infra_id)
            .await?
            .into_iter()
            .try_for_each(|speed| infra_cache.add(speed))?;

        // Load speed sections tracks references
        find_all_schemas::<NeutralSection, Vec<_>>(conn, infra_id)
            .await?
            .into_iter()
            .try_for_each(|neutralsection| infra_cache.add(neutralsection))?;

        // Load routes tracks references
        find_all_schemas::<_, Vec<Route>>(conn, infra_id)
            .await?
            .into_iter()
            .try_for_each(|route| infra_cache.add(route))?;

        // Load operational points tracks references
        sql_query(
            "SELECT obj_id, data->>'parts' AS parts FROM infra_object_operational_point WHERE infra_id = $1")
        .bind::<BigInt, _>(infra_id)
        .load::<OperationalPointQueryable>(conn).await?.into_iter().try_for_each(|op|
            infra_cache.add::<OperationalPointCache>(op.into())
        )?;

        // Load track_node tracks references
        sql_query(
            "SELECT obj_id, data->>'track_node_type' AS track_node_type, data->>'ports' AS ports FROM infra_object_track_node WHERE infra_id = $1")
        .bind::<BigInt, _>(infra_id)
        .load::<TrackNodeQueryable>(conn).await?.into_iter().try_for_each(|track_node|
            infra_cache.add::<TrackNodeCache>(track_node.into())
        )?;

        // Load track_node types references
        find_all_schemas::<_, Vec<TrackNodeType>>(conn, infra_id)
            .await?
            .into_iter()
            .try_for_each(|track_node_type| infra_cache.add::<TrackNodeType>(track_node_type))?;

        // Add builtin track_node nodes
        infra_cache.add::<TrackNodeType>(Link.into())?;
        infra_cache.add::<TrackNodeType>(PointSwitch.into())?;
        infra_cache.add::<TrackNodeType>(Crossing.into())?;
        infra_cache.add::<TrackNodeType>(SingleSlipSwitch.into())?;
        infra_cache.add::<TrackNodeType>(DoubleSlipSwitch.into())?;

        // Load detector tracks references
        sql_query(
            "SELECT obj_id, data->>'track' AS track, (data->>'position')::float AS position FROM infra_object_detector WHERE infra_id = $1")
        .bind::<BigInt, _>(infra_id)
        .load::<DetectorCache>(conn).await?.into_iter().try_for_each(|detector|
            infra_cache.add(detector)
        )?;

        // Load buffer stop tracks references
        sql_query(
            "SELECT obj_id, data->>'track' AS track, (data->>'position')::float AS position FROM infra_object_buffer_stop WHERE infra_id = $1")
        .bind::<BigInt, _>(infra_id)
        .load::<BufferStopCache>(conn).await?.into_iter().try_for_each(|buffer_stop|
            infra_cache.add(buffer_stop)
        )?;

        // Load electrification tracks references
        find_all_schemas::<_, Vec<Electrification>>(conn, infra_id)
            .await?
            .into_iter()
            .try_for_each(|electrification| infra_cache.add::<Electrification>(electrification))?;

        Ok(infra_cache)
    }

    /// This function tries to get the infra from the cache, if it fails, it loads it from the database
    /// If the infra is not found in the database, it returns `None`
    pub async fn get_or_load<'a>(
        conn: &mut DbConnection,
        infra_caches: &'a CHashMap<i64, InfraCache>,
        infra: &Infra,
    ) -> Result<ReadGuard<'a, i64, InfraCache>> {
        // Cache hit
        if let Some(infra_cache) = infra_caches.get(&infra.id) {
            return Ok(infra_cache);
        }
        // Cache miss
        infra_caches.insert_new(infra.id, InfraCache::load(conn, infra).await?);
        Ok(infra_caches.get(&infra.id).unwrap())
    }

    /// This function tries to get the infra from the cache, if it fails, it loads it from the database
    /// If the infra is not found in the database, it returns `None`
    pub async fn get_or_load_mut<'a>(
        conn: &mut DbConnection,
        infra_caches: &'a CHashMap<i64, InfraCache>,
        infra: &Infra,
    ) -> Result<WriteGuard<'a, i64, InfraCache>> {
        // Cache hit
        if let Some(infra_cache) = infra_caches.get_mut(&infra.id) {
            return Ok(infra_cache);
        }
        // Cache miss
        infra_caches.insert_new(infra.id, InfraCache::load(conn, infra).await?);
        Ok(infra_caches.get_mut(&infra.id).unwrap())
    }

    /// Get all track sections references of a given track and type
    /// If the track is not found, it returns an empty vector
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
    pub fn apply_delete(&mut self, object_ref: &ObjectRef) -> Result<()> {
        let obj_cache = self.objects[object_ref.obj_type]
            .remove(&object_ref.obj_id)
            .ok_or_else(|| CacheOperationError::ObjectNotFound {
                obj_type: object_ref.obj_type.to_string(),
                obj_id: object_ref.obj_id.clone(),
            })?;

        for track_id in obj_cache.get_track_referenced_id() {
            self.track_sections_refs
                .get_mut(track_id)
                .ok_or_else(|| CacheOperationError::ObjectNotFound {
                    obj_type: object_ref.obj_type.to_string(),
                    obj_id: object_ref.obj_id.clone(),
                })?
                .remove(object_ref);
        }
        Ok(())
    }

    /// Apply update operation to the infra cache
    fn apply_update(&mut self, object_cache: ObjectCache) -> Result<()> {
        self.apply_delete(&object_cache.get_ref())?;
        self.apply_create(object_cache)?;
        Ok(())
    }

    /// Apply create operation to the infra cache
    fn apply_create(&mut self, object_cache: ObjectCache) -> Result<()> {
        match object_cache {
            ObjectCache::TrackSection(track_section) => {
                self.add::<TrackSectionCache>(track_section)?;
            }
            ObjectCache::Signal(signal) => self.add::<SignalCache>(signal)?,
            ObjectCache::SpeedSection(speed_section) => self.add(speed_section)?,
            ObjectCache::TrackNode(track_node) => self.add::<TrackNodeCache>(track_node)?,
            ObjectCache::TrackNodeType(track_node_type) => self.add::<TrackNodeType>(track_node_type)?,
            ObjectCache::Detector(detector) => self.add::<DetectorCache>(detector)?,
            ObjectCache::BufferStop(buffer_stop) => self.add::<BufferStopCache>(buffer_stop)?,
            ObjectCache::Route(route) => self.add::<Route>(route)?,
            ObjectCache::OperationalPoint(operational_point) => {
                self.add::<OperationalPointCache>(operational_point)?;
            }
            ObjectCache::Electrification(electrification) => {
                self.add::<Electrification>(electrification)?
            }
            ObjectCache::NeutralSection(neutral_section) => {
                self.add::<NeutralSection>(neutral_section)?
            }
        }
        Ok(())
    }

    /// Apply an operation to the infra cache
    pub fn apply_operations(&mut self, operations: &[CacheOperation]) -> Result<()> {
        for op_res in operations {
            match op_res {
                CacheOperation::Delete(obj_ref) => self.apply_delete(obj_ref)?,
                CacheOperation::Update(object_cache) => self.apply_update(object_cache.clone())?,
                CacheOperation::Create(object_cache) => self.apply_create(object_cache.clone())?,
            }
        }
        Ok(())
    }

    pub fn get_track_section(&self, track_section_id: &str) -> Result<&TrackSectionCache> {
        Ok(self
            .track_sections()
            .get(track_section_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::TrackSection.to_string(),
                obj_id: track_section_id.to_string(),
            })?
            .unwrap_track_section())
    }

    pub fn get_signal(&self, signal_id: &str) -> Result<&SignalCache> {
        Ok(self
            .signals()
            .get(signal_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::Signal.to_string(),
                obj_id: signal_id.to_string(),
            })?
            .unwrap_signal())
    }

    pub fn get_speed_section(&self, speed_section_id: &str) -> Result<&SpeedSection> {
        Ok(self
            .speed_sections()
            .get(speed_section_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::SpeedSection.to_string(),
                obj_id: speed_section_id.to_string(),
            })?
            .unwrap_speed_section())
    }

    pub fn get_neutral_section(&self, neutral_section_id: &str) -> Result<&NeutralSection> {
        Ok(self
            .neutral_sections()
            .get(neutral_section_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::NeutralSection.to_string(),
                obj_id: neutral_section_id.to_string(),
            })?
            .unwrap_neutral_section())
    }

    pub fn get_detector(&self, detector_id: &str) -> Result<&DetectorCache> {
        Ok(self
            .detectors()
            .get(detector_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::Detector.to_string(),
                obj_id: detector_id.to_string(),
            })?
            .unwrap_detector())
    }

    pub fn get_track_node(&self, track_node_id: &str) -> Result<&TrackNodeCache> {
        Ok(self
            .track_nodes()
            .get(track_node_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::TrackNode.to_string(),
                obj_id: track_node_id.to_string(),
            })?
            .unwrap_track_node())
    }

    pub fn get_track_node_type(&self, track_node_type_id: &str) -> Result<&TrackNodeType> {
        Ok(self
            .track_node_types()
            .get(track_node_type_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::TrackNodeType.to_string(),
                obj_id: track_node_type_id.to_string(),
            })?
            .unwrap_track_node_type())
    }

    pub fn get_buffer_stop(&self, buffer_stop_id: &str) -> Result<&BufferStopCache> {
        Ok(self
            .buffer_stops()
            .get(buffer_stop_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::BufferStop.to_string(),
                obj_id: buffer_stop_id.to_string(),
            })?
            .unwrap_buffer_stop())
    }

    pub fn get_route(&self, route_id: &str) -> Result<&Route> {
        Ok(self
            .routes()
            .get(route_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::Route.to_string(),
                obj_id: route_id.to_string(),
            })?
            .unwrap_route())
    }

    pub fn get_operational_point(
        &self,
        operational_point_id: &str,
    ) -> Result<&OperationalPointCache> {
        Ok(self
            .operational_points()
            .get(operational_point_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::OperationalPoint.to_string(),
                obj_id: operational_point_id.to_string(),
            })?
            .unwrap_operational_point())
    }

    pub fn get_electrification(&self, electrification_id: &str) -> Result<&Electrification> {
        Ok(self
            .electrifications()
            .get(electrification_id)
            .ok_or_else(|| InfraCacheEditoastError::ObjectNotFound {
                obj_type: ObjectType::Electrification.to_string(),
                obj_id: electrification_id.to_string(),
            })?
            .unwrap_electrification())
    }

    /// Return the track and position of a waypoint
    fn get_waypoint_location(&self, waypoint: &Waypoint) -> Option<(&String, f64)> {
        if waypoint.is_detector() {
            let detector = self.detectors().get(waypoint.get_id())?;
            let detector = detector.unwrap_detector();
            Some((&detector.track, detector.position))
        } else {
            let bs = self.buffer_stops().get(waypoint.get_id())?;
            let bs = bs.unwrap_buffer_stop();
            Some((&bs.track, bs.position))
        }
    }

    /// Compute the track ranges through which the route passes.
    /// If the path cannot be computed (e.g. invalid topology), returns None.
    /// Route = start_waypoint + end_waypoint
    /// Waypoint = BufferStop || Detector
    pub fn compute_track_ranges_on_route(&self, route: &Route, graph: &Graph) -> Option<RoutePath> {
        // Check if entry and exit points are the same
        if route.entry_point == route.exit_point {
            return None;
        }

        let mut cur_dir = route.entry_point_direction;
        let (cur_track, mut cur_offset) = self.get_waypoint_location(&route.entry_point)?;
        let (exit_track, exit_offset) = self.get_waypoint_location(&route.exit_point)?;

        // Check that the track exists
        let mut cur_track = self.track_sections().get(cur_track)?.unwrap_track_section();

        // Save track ranges and used track_nodes
        let mut track_ranges = vec![];
        let mut used_track_nodes = vec![];

        // Check path validity
        loop {
            let cur_track_id = cur_track.get_id();

            // Add track range
            let end_offset = if cur_track_id == exit_track {
                exit_offset
            } else if cur_dir == Direction::StartToStop {
                cur_track.length
            } else {
                0.
            };
            let dir_track_range = DirectionalTrackRange::new(
                cur_track_id.clone(),
                cur_offset.min(end_offset),
                cur_offset.max(end_offset),
                cur_dir,
            );
            track_ranges.push(dir_track_range);

            // Search for the exit_point
            if cur_track_id == exit_track {
                if (cur_dir == Direction::StartToStop && cur_offset > exit_offset)
                    || (cur_dir == Direction::StopToStart && cur_offset < exit_offset)
                {
                    return None;
                }
                break;
            }

            // Search for the next track section
            let endpoint = TrackEndpoint::from_track_and_direction(cur_track_id, cur_dir);
            // No neighbour found
            if !graph.has_neighbour(&endpoint) {
                return None;
            }

            let track_node = graph.get_track_node(&endpoint)?;
            let track_node_id = track_node.get_id();
            let track_node_type = self.get_track_node_type(&track_node.track_node_type).ok()?;
            let group = if track_node_type.groups.len() == 1 {
                // Check if track_node has one group
                track_node_type.groups.keys().next()?
            } else {
                // Check we found the track_node in the route
                route.track_nodes_directions.get(&track_node_id.clone().into())?
            };
            used_track_nodes.push((track_node_id.clone().into(), group.clone()));
            let next_endpoint = graph.get_neighbour(&endpoint, group)?;

            // Update current track section, offset and direction
            cur_track = self
                .track_sections()
                .get(&next_endpoint.track.0)?
                .unwrap_track_section();
            (cur_dir, cur_offset) = match next_endpoint.endpoint {
                Endpoint::Begin => (Direction::StartToStop, 0.),
                Endpoint::End => (Direction::StopToStart, cur_track.length),
            };
        }
        Some(RoutePath {
            track_ranges,
            track_nodes_directions: used_track_nodes,
        })
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "cache_operation")]
pub enum CacheOperationError {
    #[error("{obj_type} '{obj_id}', could not be found everywhere in the infrastructure cache")]
    #[editoast_error(status = 404)]
    ObjectNotFound { obj_type: String, obj_id: String },
    #[error("{obj_type} '{obj_id}', a duplicate already exists")]
    #[editoast_error(status = 404)]
    DuplicateIdsProvided { obj_type: String, obj_id: String },
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra_cache")]
pub enum InfraCacheEditoastError {
    #[error("{obj_type} '{obj_id}', could not be found in the infrastructure cache")]
    #[editoast_error(status = 404)]
    ObjectNotFound { obj_type: String, obj_id: String },
}

#[cfg(test)]
pub mod tests {
    use chashmap::CHashMap;
    use editoast_schemas::infra::BufferStop;
    use editoast_schemas::infra::Detector;
    use editoast_schemas::infra::Waypoint;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use std::collections::HashMap;
    use std::ops::DerefMut;

    use super::OperationalPointCache;
    use crate::infra_cache::object_cache::BufferStopCache;
    use crate::infra_cache::object_cache::DetectorCache;
    use crate::infra_cache::object_cache::OperationalPointPartCache;
    use crate::infra_cache::object_cache::SignalCache;
    use crate::infra_cache::object_cache::TrackSectionCache;
    use crate::infra_cache::InfraCache;
    use crate::infra_cache::TrackNodeCache;
    use crate::modelsv2::fixtures::create_empty_infra;
    use crate::modelsv2::fixtures::create_infra_object;
    use editoast_models::DbConnectionPoolV2;
    use editoast_schemas::infra::ApplicableDirections;
    use editoast_schemas::infra::ApplicableDirectionsTrackRange;
    use editoast_schemas::infra::Direction;
    use editoast_schemas::infra::Electrification;
    use editoast_schemas::infra::Endpoint;
    use editoast_schemas::infra::OperationalPoint;
    use editoast_schemas::infra::Route;
    use editoast_schemas::infra::Signal;
    use editoast_schemas::infra::SpeedSection;
    use editoast_schemas::infra::TrackNode;
    use editoast_schemas::infra::TrackNodePortConnection;
    use editoast_schemas::infra::TrackNodeType;
    use editoast_schemas::infra::TrackEndpoint;
    use editoast_schemas::infra::TrackSection;
    use editoast_schemas::primitives::BoundingBox;
    use editoast_schemas::primitives::Identifier;
    use editoast_schemas::primitives::NonBlankString;
    use editoast_schemas::primitives::OSRDIdentified;

    #[rstest]
    async fn load_track_section() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let track = create_infra_object(
            db_pool.get_ok().deref_mut(),
            infra.id,
            TrackSection::default(),
        )
        .await;
        let infra_cache = InfraCache::load(db_pool.get_ok().deref_mut(), &infra)
            .await
            .unwrap();

        assert_eq!(infra_cache.track_sections().len(), 1);
        assert!(infra_cache.track_sections().contains_key(track.get_id()));
    }

    #[rstest]
    async fn load_signal() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let signal =
            create_infra_object(db_pool.get_ok().deref_mut(), infra.id, Signal::default()).await;
        let infra_cache = InfraCache::load(db_pool.get_ok().deref_mut(), &infra)
            .await
            .unwrap();

        assert!(infra_cache.signals().contains_key(signal.get_id()));
        let refs = infra_cache.track_sections_refs;
        assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
    }

    #[rstest]
    async fn load_speed_section() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let speed = create_infra_object(
            db_pool.get_ok().deref_mut(),
            infra.id,
            SpeedSection {
                track_ranges: vec![Default::default()],
                ..Default::default()
            },
        )
        .await;
        let infra_cache = InfraCache::load(db_pool.get_ok().deref_mut(), &infra)
            .await
            .unwrap();

        assert!(infra_cache.speed_sections().contains_key(speed.get_id()));
        let refs = infra_cache.track_sections_refs;
        assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
    }

    #[rstest]
    async fn load_route() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let route =
            create_infra_object(db_pool.get_ok().deref_mut(), infra.id, Route::default()).await;
        let infra_cache = InfraCache::load(db_pool.get_ok().deref_mut(), &infra)
            .await
            .unwrap();

        assert!(infra_cache.routes().contains_key(route.get_id()));
    }

    #[rstest]
    async fn load_operational_point() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let op = create_infra_object(
            db_pool.get_ok().deref_mut(),
            infra.id,
            OperationalPoint {
                parts: vec![Default::default()],
                ..Default::default()
            },
        )
        .await;

        let infra_cache = InfraCache::load(db_pool.get_ok().deref_mut(), &infra)
            .await
            .unwrap();

        assert!(infra_cache.operational_points().contains_key(op.get_id()));
        let refs = infra_cache.track_sections_refs;
        assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
    }

    #[rstest]
    async fn load_track_node() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let track_node = create_infra_object(
            db_pool.get_ok().deref_mut(),
            infra.id,
            TrackNode {
                ports: HashMap::from([("port".into(), Default::default())]),
                ..Default::default()
            },
        )
        .await;
        let infra_cache = InfraCache::load(db_pool.get_ok().deref_mut(), &infra)
            .await
            .unwrap();

        assert!(infra_cache.track_nodes().contains_key(track_node.get_id()));
    }

    #[rstest]
    async fn load_track_node_type() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let s_type = create_infra_object(
            db_pool.get_ok().deref_mut(),
            infra.id,
            TrackNodeType::default(),
        )
        .await;
        let infra_cache = InfraCache::load(db_pool.get_ok().deref_mut(), &infra)
            .await
            .unwrap();

        assert!(infra_cache.track_node_types().contains_key(s_type.get_id()));
    }

    #[rstest]
    async fn load_detector() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let detector =
            create_infra_object(db_pool.get_ok().deref_mut(), infra.id, Detector::default()).await;
        let infra_cache = InfraCache::load(db_pool.get_ok().deref_mut(), &infra)
            .await
            .unwrap();

        assert!(infra_cache.detectors().contains_key(detector.get_id()));
        let refs = infra_cache.track_sections_refs;
        assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
    }

    #[rstest]
    async fn load_buffer_stop() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let bs = create_infra_object(
            db_pool.get_ok().deref_mut(),
            infra.id,
            BufferStop::default(),
        )
        .await;
        let infra_cache = InfraCache::load(db_pool.get_ok().deref_mut(), &infra)
            .await
            .unwrap();

        assert!(infra_cache.buffer_stops().contains_key(bs.get_id()));
        let refs = infra_cache.track_sections_refs;
        assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
    }

    #[rstest]
    async fn load_electrification() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let electrification = create_infra_object(
            db_pool.get_ok().deref_mut(),
            infra.id,
            Electrification {
                track_ranges: vec![Default::default()],
                ..Default::default()
            },
        )
        .await;

        let infra_cache = InfraCache::load(db_pool.get_ok().deref_mut(), &infra)
            .await
            .unwrap();

        assert!(infra_cache
            .electrifications()
            .contains_key(electrification.get_id()));
        let refs = infra_cache.track_sections_refs;
        assert_eq!(refs.get("InvalidRef").unwrap().len(), 1);
    }

    pub fn create_track_section_cache<T: AsRef<str>>(obj_id: T, length: f64) -> TrackSectionCache {
        TrackSectionCache {
            obj_id: obj_id.as_ref().into(),
            length,
            line_code: None,
            bbox_geo: BoundingBox::default(),
            ..Default::default()
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
            logical_signals: Default::default(),
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
            parts: vec![OperationalPointPartCache {
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
            track_ranges.push(ApplicableDirectionsTrackRange::new(
                obj_id,
                begin,
                end,
                ApplicableDirections::Both,
            ));
        }
        SpeedSection {
            id: id.as_ref().into(),
            speed_limit: None,
            speed_limit_by_tag: HashMap::default(),
            track_ranges,
            ..Default::default()
        }
    }

    pub fn create_electrification_cache<T: AsRef<str>>(
        id: T,
        range_list: Vec<(T, f64, f64)>,
    ) -> Electrification {
        let mut track_ranges = vec![];
        for (obj_id, begin, end) in range_list {
            track_ranges.push(ApplicableDirectionsTrackRange::new(
                obj_id,
                begin,
                end,
                ApplicableDirections::Both,
            ));
        }
        Electrification {
            id: id.as_ref().into(),
            voltage: NonBlankString("1500V".to_string()),
            track_ranges,
        }
    }

    pub fn create_route_cache<T: AsRef<str>>(
        id: T,
        entry_point: Waypoint,
        entry_point_direction: Direction,
        exit_point: Waypoint,
        release_detectors: Vec<Identifier>,
        track_nodes_directions: HashMap<Identifier, Identifier>,
    ) -> Route {
        Route {
            id: id.as_ref().into(),
            entry_point,
            entry_point_direction,
            exit_point,
            release_detectors,
            track_nodes_directions,
        }
    }

    pub fn create_track_node_connection<T: AsRef<str>>(src: T, dst: T) -> TrackNodePortConnection {
        TrackNodePortConnection {
            src: src.as_ref().into(),
            dst: dst.as_ref().into(),
        }
    }

    pub fn create_track_node_type_cache<T: AsRef<str>>(
        id: T,
        ports: Vec<Identifier>,
        groups: HashMap<Identifier, Vec<TrackNodePortConnection>>,
    ) -> TrackNodeType {
        TrackNodeType {
            id: id.as_ref().into(),
            ports,
            groups,
        }
    }

    pub fn create_track_node_cache_point(
        obj_id: String,
        base: (&str, TrackEndpoint),
        left: (&str, TrackEndpoint),
        right: (&str, TrackEndpoint),
        track_node_type: String,
    ) -> TrackNodeCache {
        let ports_list = [base, left, right];
        let ports: HashMap<String, TrackEndpoint> =
            ports_list.into_iter().map(|(s, t)| (s.into(), t)).collect();
        TrackNodeCache {
            obj_id,
            track_node_type,
            ports,
        }
    }

    pub fn create_track_node_cache_link(
        obj_id: String,
        source: (&str, TrackEndpoint),
        destination: (&str, TrackEndpoint),
        track_node_type: String,
    ) -> TrackNodeCache {
        let ports_list = [source, destination];
        let ports: HashMap<String, TrackEndpoint> =
            ports_list.into_iter().map(|(s, t)| (s.into(), t)).collect();
        TrackNodeCache {
            obj_id,
            track_node_type,
            ports,
        }
    }

    ///                    -------| C
    ///              D1   /
    /// |--------+---*---
    ///     A        B    \
    ///                    -------| D
    ///
    /// No speed section
    /// No signal
    /// No operational point
    /// No electrification
    ///
    pub fn create_small_infra_cache() -> InfraCache {
        let mut infra_cache = InfraCache::default();

        for id in 'A'..='D' {
            infra_cache
                .add(create_track_section_cache(id.to_string(), 500.))
                .unwrap();
        }

        infra_cache
            .add(create_detector_cache("D1", "B", 250.))
            .unwrap();

        infra_cache
            .add(create_buffer_stop_cache("BF1", "A", 20.))
            .unwrap();
        infra_cache
            .add(create_buffer_stop_cache("BF2", "C", 480.))
            .unwrap();
        infra_cache
            .add(create_buffer_stop_cache("BF3", "D", 480.))
            .unwrap();

        infra_cache
            .add(create_route_cache(
                "R1",
                Waypoint::new_buffer_stop("BF1"),
                Direction::StartToStop,
                Waypoint::new_detector("D1"),
                vec![],
                [("link".into(), "LINK".into())].into(),
            ))
            .unwrap();
        infra_cache
            .add(create_route_cache(
                "R2",
                Waypoint::new_detector("D1"),
                Direction::StartToStop,
                Waypoint::new_buffer_stop("BF2"),
                vec![],
                [("track_node".into(), "A_B1".into())].into(),
            ))
            .unwrap();
        infra_cache
            .add(create_route_cache(
                "R3",
                Waypoint::new_detector("D1"),
                Direction::StartToStop,
                Waypoint::new_buffer_stop("BF3"),
                vec![],
                [("track_node".into(), "A_B2".into())].into(),
            ))
            .unwrap();

        infra_cache
            .add(create_track_node_type_cache(
                "link",
                vec!["A".into(), "B".into()],
                HashMap::from([("LINK".into(), vec![create_track_node_connection("A", "B")])]),
            ))
            .unwrap();

        let link = create_track_node_cache_link(
            "link".into(),
            ("A", create_track_endpoint(Endpoint::End, "A")),
            ("B", create_track_endpoint(Endpoint::Begin, "B")),
            "link".into(),
        );
        infra_cache.add(link).unwrap();

        infra_cache
            .add(create_track_node_type_cache(
                "point_switch",
                vec!["A".into(), "B1".into(), "B2".into()],
                HashMap::from([
                    ("A_B1".into(), vec![create_track_node_connection("A", "B1")]),
                    ("A_B2".into(), vec![create_track_node_connection("A", "B2")]),
                ]),
            ))
            .unwrap();

        let track_node = create_track_node_cache_point(
            "track_node".into(),
            ("A", create_track_endpoint(Endpoint::End, "B")),
            ("B1", create_track_endpoint(Endpoint::Begin, "C")),
            ("B2", create_track_endpoint(Endpoint::Begin, "D")),
            "point_switch".into(),
        );
        infra_cache.add(track_node).unwrap();

        infra_cache
    }

    #[rstest]
    async fn load_infra_cache() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let infra_caches = CHashMap::new();
        InfraCache::get_or_load(db_pool.get_ok().deref_mut(), &infra_caches, &infra)
            .await
            .unwrap();
        assert_eq!(infra_caches.len(), 1);
        InfraCache::get_or_load(db_pool.get_ok().deref_mut(), &infra_caches, &infra)
            .await
            .unwrap();
        assert_eq!(infra_caches.len(), 1);
    }

    #[rstest]
    async fn load_infra_cache_mut() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;
        let infra_caches = CHashMap::new();
        InfraCache::get_or_load_mut(db_pool.get_ok().deref_mut(), &infra_caches, &infra)
            .await
            .unwrap();
        assert_eq!(infra_caches.len(), 1);
        InfraCache::get_or_load_mut(db_pool.get_ok().deref_mut(), &infra_caches, &infra)
            .await
            .unwrap();
        assert_eq!(infra_caches.len(), 1);
    }

    mod getters {
        use std::collections::HashMap;

        use super::create_track_section_cache;
        use crate::infra_cache::tests::create_buffer_stop_cache;
        use crate::infra_cache::tests::create_detector_cache;
        use crate::infra_cache::tests::create_electrification_cache;
        use crate::infra_cache::tests::create_operational_point_cache;
        use crate::infra_cache::tests::create_route_cache;
        use crate::infra_cache::tests::create_signal_cache;
        use crate::infra_cache::tests::create_speed_section_cache;
        use crate::infra_cache::tests::create_track_node_cache_point;
        use crate::infra_cache::tests::create_track_node_type_cache;
        use crate::infra_cache::InfraCache;
        use crate::infra_cache::InfraCacheEditoastError;
        use editoast_schemas::infra::Direction::StartToStop;
        use editoast_schemas::infra::TrackEndpoint;
        use editoast_schemas::infra::Waypoint::BufferStop;
        use editoast_schemas::primitives::Identifier;
        use editoast_schemas::primitives::ObjectType;

        #[test]
        fn track_section() {
            const ID: &str = "track_section_id";

            let mut infra_cache = InfraCache::default();

            assert_eq!(
                infra_cache.get_track_section(ID).unwrap_err(),
                InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::TrackSection.to_string(),
                    obj_id: ID.to_string()
                }
                .into()
            );
            let track_section = create_track_section_cache(ID, 100.0);
            infra_cache.add(track_section.clone()).unwrap();
            assert_eq!(infra_cache.get_track_section(ID).unwrap(), &track_section);
        }

        #[test]
        fn signal() {
            const ID: &str = "signal_id";

            let mut infra_cache = InfraCache::default();

            assert_eq!(
                infra_cache.get_signal(ID).unwrap_err(),
                InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::Signal.to_string(),
                    obj_id: ID.to_string()
                }
                .into()
            );
            let signal = create_signal_cache(ID, "track_section_id", 0.0);
            infra_cache.add(signal.clone()).unwrap();
            assert_eq!(infra_cache.get_signal(ID).unwrap(), &signal);
        }

        #[test]
        fn speed_section() {
            const ID: &str = "speed_section_id";

            let mut infra_cache = InfraCache::default();

            assert_eq!(
                infra_cache.get_speed_section(ID).unwrap_err(),
                InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::SpeedSection.to_string(),
                    obj_id: ID.to_string()
                }
                .into()
            );
            let speed_section =
                create_speed_section_cache(ID, vec![("track_section_id", 0.0, 100.0)]);
            infra_cache.add(speed_section.clone()).unwrap();
            assert_eq!(infra_cache.get_speed_section(ID).unwrap(), &speed_section);
        }

        #[test]
        fn detector() {
            const ID: &str = "detector_id";

            let mut infra_cache = InfraCache::default();

            assert_eq!(
                infra_cache.get_detector(ID).unwrap_err(),
                InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::Detector.to_string(),
                    obj_id: ID.to_string()
                }
                .into()
            );
            let detector = create_detector_cache(ID, "track_section_id", 0.0);
            infra_cache.add(detector.clone()).unwrap();
            assert_eq!(infra_cache.get_detector(ID).unwrap(), &detector);
        }

        #[test]
        fn track_node() {
            const ID: &str = "track_node_id";

            let mut infra_cache = InfraCache::default();

            assert_eq!(
                infra_cache.get_track_node(ID).unwrap_err(),
                InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::TrackNode.to_string(),
                    obj_id: ID.to_string()
                }
                .into()
            );
            let track_node = create_track_node_cache_point(
                ID.to_string(),
                ("track_section_1_id", TrackEndpoint::default()),
                ("track_section_2_id", TrackEndpoint::default()),
                ("track_section_3_id", TrackEndpoint::default()),
                "track_node_type_id".to_string(),
            );

            infra_cache.add(track_node.clone()).unwrap();
            assert_eq!(infra_cache.get_track_node(ID).unwrap(), &track_node);
        }

        #[test]
        fn track_node_type() {
            const ID: &str = "track_node_type_id";

            let mut infra_cache = InfraCache::default();

            assert_eq!(
                infra_cache.get_track_node_type(ID).unwrap_err(),
                InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::TrackNodeType.to_string(),
                    obj_id: ID.to_string()
                }
                .into()
            );
            let track_node_type = create_track_node_type_cache(ID, vec![], HashMap::default());
            infra_cache.add(track_node_type.clone()).unwrap();
            assert_eq!(infra_cache.get_track_node_type(ID).unwrap(), &track_node_type);
        }

        #[test]
        fn buffer_stop() {
            const ID: &str = "buffer_stop_id";

            let mut infra_cache = InfraCache::default();

            assert_eq!(
                infra_cache.get_buffer_stop(ID).unwrap_err(),
                InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::BufferStop.to_string(),
                    obj_id: ID.to_string()
                }
                .into()
            );
            let buffer_stop = create_buffer_stop_cache(ID, "track_section_id", 0.0);

            infra_cache.add(buffer_stop.clone()).unwrap();
            assert_eq!(infra_cache.get_buffer_stop(ID).unwrap(), &buffer_stop);
        }

        #[test]
        fn route() {
            const ID: &str = "route_id";

            let mut infra_cache = InfraCache::default();

            assert_eq!(
                infra_cache.get_route(ID).unwrap_err(),
                InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::Route.to_string(),
                    obj_id: ID.to_string()
                }
                .into()
            );
            let route = create_route_cache(
                ID,
                BufferStop {
                    id: Identifier::from("buffer_stop_start_id"),
                },
                StartToStop,
                BufferStop {
                    id: Identifier::from("buffer_stop_end_id"),
                },
                vec![],
                HashMap::default(),
            );

            infra_cache.add(route.clone()).unwrap();
            assert_eq!(infra_cache.get_route(ID).unwrap(), &route);
        }

        #[test]
        fn operational_point() {
            const ID: &str = "operational_point_id";

            let mut infra_cache = InfraCache::default();

            assert_eq!(
                infra_cache.get_operational_point(ID).unwrap_err(),
                InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::OperationalPoint.to_string(),
                    obj_id: ID.to_string()
                }
                .into()
            );
            let operational_point = create_operational_point_cache(ID, "track_section_id", 0.0);

            infra_cache.add(operational_point.clone()).unwrap();
            assert_eq!(
                infra_cache.get_operational_point(ID).unwrap(),
                &operational_point
            );
        }

        #[test]
        fn electrification() {
            const ID: &str = "electrification_id";

            let mut infra_cache = InfraCache::default();

            assert_eq!(
                infra_cache.get_electrification(ID).unwrap_err(),
                InfraCacheEditoastError::ObjectNotFound {
                    obj_type: ObjectType::Electrification.to_string(),
                    obj_id: ID.to_string()
                }
                .into()
            );
            let electrification = create_electrification_cache(ID, vec![]);

            infra_cache.add(electrification.clone()).unwrap();
            assert_eq!(
                infra_cache.get_electrification(ID).unwrap(),
                &electrification
            );
        }
    }
}
