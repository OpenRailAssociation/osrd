use diesel_async::AsyncPgConnection as PgConnection;
use diesel_async::RunQueryDsl;
use editoast_derive::ModelV2;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::diesel::QueryDsl;
use crate::error::Result;
use crate::schema::electrical_profiles::ElectricalProfileSetData;
use crate::tables::electrical_profile_set;

#[derive(Clone, Debug, Serialize, Deserialize, ModelV2, ToSchema)]
#[model(table = crate::tables::electrical_profile_set)]
#[model(changeset(derive(Deserialize)))]
pub struct ElectricalProfileSet {
    pub id: i64,
    pub name: String,
    #[model(json)]
    pub data: ElectricalProfileSetData,
}

impl ElectricalProfileSet {
    pub async fn list_light(conn: &mut PgConnection) -> Result<Vec<LightElectricalProfileSet>> {
        use crate::tables::electrical_profile_set::dsl::*;
        let result = electrical_profile_set.select((id, name)).load(conn).await?;
        Ok(result)
    }
}

#[derive(Debug, Queryable, Identifiable, Serialize, Deserialize, PartialEq, ToSchema)]
#[diesel(table_name = electrical_profile_set)]
pub struct LightElectricalProfileSet {
    pub id: i64,
    pub name: String,
}

#[cfg(test)]
mod tests {
    use actix_web::web::Data;
    use rstest::rstest;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::dummy_electrical_profile_set;
    use crate::fixtures::tests::electrical_profile_set;
    use crate::fixtures::tests::TestFixture;
    use crate::DbPool;

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
            id: set_1.model.id,
            name: set_1.model.name.clone(),
        }));
        assert!(list.contains(&LightElectricalProfileSet {
            id: set_2.model.id,
            name: set_2.model.name.clone(),
        }));
    }
}
