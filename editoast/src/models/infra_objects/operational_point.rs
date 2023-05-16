//! Provides the [OperationalPointModel] model

use crate::{schema::OperationalPoint, tables::osrd_infra_operationalpointmodel};
use derivative::Derivative;
use diesel::{prelude::*, result::Error as DieselError, ExpressionMethods, QueryDsl};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Derivative, Serialize, Deserialize, Queryable, QueryableByName, Model)]
#[derivative(Default(new = "true"))]
#[model(table = "osrd_infra_operationalpointmodel")]
#[model(retrieve, delete)]
#[diesel(table_name = osrd_infra_operationalpointmodel)]
pub struct OperationalPointModel {
    pub id: i64,
    pub obj_id: String,
    #[derivative(Default(value = "diesel_json::Json::new(Default::default())"))]
    pub data: diesel_json::Json<OperationalPoint>,
    pub infra_id: i64,
}
