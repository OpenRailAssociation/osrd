use crate::tables::osrd_infra_timetable;
use derivative::Derivative;
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(
    Clone,
    Debug,
    Serialize,
    Deserialize,
    Derivative,
    Queryable,
    QueryableByName,
    Insertable,
    Identifiable,
    Model,
)]
#[derivative(Default)]
#[model(table = "osrd_infra_timetable")]
#[model(create)]
#[diesel(table_name = osrd_infra_timetable)]
pub struct Timetable {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
}
