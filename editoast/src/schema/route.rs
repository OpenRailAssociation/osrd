use std::collections::HashSet;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::layer::Layer;

use super::generate_id;
use super::DirectionalTrackRange;
use super::OSRDObject;
use super::ObjectType;
use super::Waypoint;
use derivative::Derivative;
use diesel::result::Error;
use diesel::PgConnection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Route {
    #[derivative(Default(value = r#"generate_id("route")"#))]
    pub id: String,
    pub entry_point: Waypoint,
    pub exit_point: Waypoint,
    pub release_detectors: Vec<String>,
    pub path: Vec<DirectionalTrackRange>,
}

impl OSRDObject for Route {
    fn get_id(&self) -> &String {
        &self.id
    }
    fn get_type(&self) -> ObjectType {
        ObjectType::Route
    }
}

impl Layer for Route {
    fn get_table_name() -> &'static str {
        "osrd_infra_routelayer"
    }

    fn generate_layer_query() -> &'static str {
        include_str!("../layer/sql/generate_route_layer.sql")
    }

    fn insert_update_layer_query() -> &'static str {
        include_str!("../layer/sql/insert_route_layer.sql")
    }

    fn layer_name() -> &'static str {
        "routes"
    }

    fn get_obj_type() -> ObjectType {
        ObjectType::Route
    }

    /// Delete and Insert for update some objects of the layer object
    fn update_list(
        conn: &PgConnection,
        infra: i32,
        obj_ids: HashSet<&String>,
    ) -> Result<(), Error> {
        Self::delete_list(conn, infra, obj_ids.clone())?;
        Self::insert_list(conn, infra, obj_ids)
    }
}

impl Cache for Route {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.path.iter().map(|tr| &tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Route(self.clone())
    }
}
