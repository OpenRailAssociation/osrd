use crate::error::Result;
use crate::schema::electrical_profiles::ElectricalProfileSetData;
use crate::tables::electrical_profile_set;

use crate::diesel::ExpressionMethods;
use crate::diesel::QueryDsl;
use crate::models::Identifiable;
use crate::DieselJson;
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
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
#[model(table = "electrical_profile_set")]
#[model(create, delete, retrieve)]
#[diesel(table_name = electrical_profile_set)]
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

impl ElectricalProfileSet {
    pub async fn list_light(conn: &mut PgConnection) -> Result<Vec<LightElectricalProfileSet>> {
        use crate::tables::electrical_profile_set::dsl::*;
        let result = electrical_profile_set.select((id, name)).load(conn).await?;
        Ok(result)
    }
}

#[derive(Debug, Default, Queryable, Identifiable, Serialize, Deserialize)]
#[diesel(table_name = electrical_profile_set)]
pub struct LightElectricalProfileSet {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
}
