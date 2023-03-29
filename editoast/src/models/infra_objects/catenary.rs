#![cfg(test)]

use crate::models::Identifiable;
use crate::{schema::Catenary as CatenarySchema, tables::osrd_infra_catenarymodel};
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use editoast_derive::Model;

#[derive(Debug, Insertable, Queryable, QueryableByName, Model)]
#[model(table = "osrd_infra_catenarymodel")]
#[model(create, delete)]
#[diesel(table_name = osrd_infra_catenarymodel)]
pub struct Catenary {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    pub obj_id: String,
    pub data: diesel_json::Json<CatenarySchema>,
    pub infra_id: i64,
}

impl Catenary {
    pub fn new(data: CatenarySchema, infra_id: i64, obj_id: String) -> Self {
        Self {
            id: None,
            obj_id,
            data: diesel_json::Json(data),
            infra_id,
        }
    }
}

impl Identifiable for Catenary {
    fn get_id(&self) -> i64 {
        self.id.unwrap()
    }
}
