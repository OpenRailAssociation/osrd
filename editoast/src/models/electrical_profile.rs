use crate::schema::electrical_profiles::ElectricalProfileSetData;
use crate::tables::osrd_infra_electricalprofileset;

use crate::models::Identifiable;
use crate::DieselJson;
use derivative::Derivative;

use diesel::result::Error as DieselError;

use diesel::prelude::*;
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(
    Clone,
    Debug,
    Default,
    Deserialize,
    Derivative,
    Identifiable,
    Insertable,
    Model,
    PartialEq,
    Queryable,
    Selectable,
    Serialize,
)]
#[model(table = "osrd_infra_electricalprofileset")]
#[model(create, delete, retrieve)]
#[diesel(table_name = osrd_infra_electricalprofileset)]
pub struct ElectricalProfileSet {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
    #[diesel(deserialize_as = DieselJson<ElectricalProfileSetData>)]
    pub data: Option<DieselJson<ElectricalProfileSetData>>,
}

impl Identifiable for ElectricalProfileSet {
    fn get_id(&self) -> i64 {
        self.id.unwrap()
    }
}

#[derive(Debug, Default, Queryable, Identifiable, Serialize, Deserialize)]
#[diesel(table_name = osrd_infra_electricalprofileset)]
pub struct LightElectricalProfileSet {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
}
