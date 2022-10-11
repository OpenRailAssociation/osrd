use std::collections::HashSet;

use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use crate::layer::Layer;

use super::generate_id;
use super::ApplicableDirectionsTrackRange;
use super::OSRDObject;
use super::ObjectType;
use derivative::Derivative;
use diesel::result::Error;
use diesel::PgConnection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Derivative, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[derivative(Default)]
pub struct Catenary {
    #[derivative(Default(value = r#"generate_id("catenary")"#))]
    pub id: String,
    pub voltage: f64,
    pub track_ranges: Vec<ApplicableDirectionsTrackRange>,
}

impl OSRDObject for Catenary {
    fn get_type(&self) -> ObjectType {
        ObjectType::Catenary
    }

    fn get_id(&self) -> &String {
        &self.id
    }
}

impl Layer for Catenary {
    fn get_table_name() -> &'static str {
        "osrd_infra_catenarylayer"
    }

    fn generate_layer_query() -> &'static str {
        include_str!("../layer/sql/generate_catenary_layer.sql")
    }

    fn insert_update_layer_query() -> &'static str {
        include_str!("../layer/sql/insert_catenary_layer.sql")
    }

    fn layer_name() -> &'static str {
        "catenaries"
    }

    fn get_obj_type() -> ObjectType {
        ObjectType::Catenary
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

impl Cache for Catenary {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        self.track_ranges.iter().map(|tr| &tr.track).collect()
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Catenary(self.clone())
    }
}
