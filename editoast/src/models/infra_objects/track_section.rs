//! Provides the [TrackSectionModel] model

use crate::{schema::TrackSection, tables::infra_object_track_section};
use derivative::Derivative;
use diesel::{result::Error as DieselError, ExpressionMethods, QueryDsl};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Derivative, Serialize, Deserialize, Queryable, QueryableByName, Model)]
#[derivative(Default(new = "true"))]
#[model(table = "infra_object_track_section")]
#[model(retrieve, delete)]
#[diesel(table_name = infra_object_track_section)]
pub struct TrackSectionModel {
    pub id: i64,
    pub obj_id: String,
    #[derivative(Default(value = "diesel_json::Json::new(Default::default())"))]
    pub data: diesel_json::Json<TrackSection>,
    pub infra_id: i64,
}
