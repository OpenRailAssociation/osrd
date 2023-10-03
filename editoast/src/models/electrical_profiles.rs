use crate::error::Result;
use crate::schema::electrical_profiles::ElectricalProfileSetData;
use crate::tables::electrical_profile_set;

use crate::diesel::ExpressionMethods;
use crate::diesel::QueryDsl;
use crate::models::Identifiable;
use crate::DieselJson;
use diesel::result::Error as DieselError;
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

#[derive(
    Clone,
    Debug,
    Default,
    Deserialize,
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

#[derive(Debug, Queryable, Identifiable, Serialize, Deserialize, PartialEq)]
#[diesel(table_name = electrical_profile_set)]
pub struct LightElectricalProfileSet {
    pub id: i64,
    pub name: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::tests::{
        db_pool, dummy_electrical_profile_set, electrical_profile_set, TestFixture,
    };
    use crate::DbPool;
    use actix_web::web::Data;
    use rstest::rstest;

    #[rstest]
    async fn test_list_light(
        db_pool: Data<DbPool>,
        #[future] electrical_profile_set: TestFixture<ElectricalProfileSet>,
        #[future] dummy_electrical_profile_set: TestFixture<ElectricalProfileSet>,
    ) {
        let set_1 = electrical_profile_set.await;
        let set_2 = dummy_electrical_profile_set.await;
        let mut conn = db_pool.get().await.unwrap();
        let list = ElectricalProfileSet::list_light(&mut conn).await.unwrap();

        assert!(list.contains(&LightElectricalProfileSet {
            id: set_1.model.id.unwrap(),
            name: set_1.model.name.clone().unwrap(),
        }));
        assert!(list.contains(&LightElectricalProfileSet {
            id: set_2.model.id.unwrap(),
            name: set_2.model.name.clone().unwrap(),
        }));
    }
}
