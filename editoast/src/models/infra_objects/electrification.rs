#![cfg(test)]

use crate::models::Identifiable;
use crate::{
    schema::Electrification as ElectrificationSchema, tables::infra_object_electrification,
};
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use editoast_derive::Model;

#[derive(Debug, Insertable, Queryable, QueryableByName, Model)]
#[model(table = "infra_object_electrification")]
#[model(create, delete)]
#[diesel(table_name = infra_object_electrification)]
pub struct Electrification {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    pub obj_id: String,
    pub data: diesel_json::Json<ElectrificationSchema>,
    pub infra_id: i64,
}

impl Electrification {
    pub fn new(data: ElectrificationSchema, infra_id: i64, obj_id: String) -> Self {
        Self {
            id: None,
            obj_id,
            data: diesel_json::Json(data),
            infra_id,
        }
    }
}

impl Identifiable for Electrification {
    fn get_id(&self) -> i64 {
        self.id.unwrap()
    }
}
