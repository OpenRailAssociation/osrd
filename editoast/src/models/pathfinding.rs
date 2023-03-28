//! LOL

use crate::tables::osrd_infra_pathmodel;
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::prelude::*;
use diesel::result::Error as DieselError;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use editoast_derive::Model;
use postgis_diesel::types::*;
use serde::Serialize;

#[derive(
    Clone, Debug, Serialize, Insertable, Derivative, Queryable, QueryableByName, AsChangeset, Model,
)]
#[derivative(Default(new = "true"))]
#[model(table = "osrd_infra_pathmodel")]
#[model(create, delete, retrieve, update)]
#[diesel(table_name = osrd_infra_pathmodel)]
pub struct Pathfinding {
    pub id: i64,
    pub owner: uuid::Uuid,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub created: NaiveDateTime,
    pub payload: serde_json::Value,
    pub slopes: serde_json::Value,
    pub curves: serde_json::Value,
    #[derivative(Default(value = "LineString { points: vec![], srid: None }"))]
    pub geographic: LineString<Point>,
    #[derivative(Default(value = "LineString { points: vec![], srid: None }"))]
    pub schematic: LineString<Point>,
    pub infra_id: i64,
}
