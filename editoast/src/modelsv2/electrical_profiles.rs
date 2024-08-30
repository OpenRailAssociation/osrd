use diesel_async::RunQueryDsl;
use editoast_derive::ModelV2;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::diesel::QueryDsl;
use crate::error::Result;
use editoast_models::tables::electrical_profile_set;
use editoast_models::DbConnection;
use editoast_schemas::infra::ElectricalProfileSetData;

#[derive(Clone, Debug, Serialize, Deserialize, ModelV2, ToSchema)]
#[model(table = editoast_models::tables::electrical_profile_set)]
#[model(changeset(derive(Deserialize)))]
pub struct ElectricalProfileSet {
    pub id: i64,
    pub name: String,
    #[model(json)]
    pub data: ElectricalProfileSetData,
}

impl ElectricalProfileSet {
    pub async fn list_light(conn: &mut DbConnection) -> Result<Vec<LightElectricalProfileSet>> {
        use editoast_models::tables::electrical_profile_set::dsl::*;
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
    use rstest::rstest;
    use std::ops::DerefMut;

    use super::*;
    use crate::modelsv2::fixtures::create_electrical_profile_set;
    use editoast_models::DbConnectionPoolV2;

    #[rstest]
    async fn test_list_light() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let set_1 = create_electrical_profile_set(db_pool.get_ok().deref_mut()).await;
        let set_2 = create_electrical_profile_set(db_pool.get_ok().deref_mut()).await;

        let list = ElectricalProfileSet::list_light(db_pool.get_ok().deref_mut())
            .await
            .expect("Failed to list electrical profile sets");

        assert!(list.contains(&LightElectricalProfileSet {
            id: set_1.id,
            name: set_1.name.clone(),
        }));

        assert!(list.contains(&LightElectricalProfileSet {
            id: set_2.id,
            name: set_2.name.clone(),
        }));
    }
}
