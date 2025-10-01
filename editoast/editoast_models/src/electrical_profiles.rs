use std::ops::DerefMut;

use database::DbConnection;
use database::tables::electrical_profile_set;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use schemas::infra::ElectricalProfileSetData;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate as editoast_models; // HACK: remove after all models are in this crate
use crate::Error;

#[cfg(any(test, feature = "testing"))]
use crate::prelude::*;

#[derive(Clone, Debug, Serialize, Deserialize, Model, ToSchema)]
#[model(table = database::tables::electrical_profile_set)]
#[model(changeset(derive(Deserialize)))]
#[model(gen(ops = crd))]
pub struct ElectricalProfileSet {
    pub id: i64,
    pub name: String,
    #[model(json)]
    pub data: ElectricalProfileSetData,
}

impl ElectricalProfileSet {
    pub async fn list_light(
        conn: &mut DbConnection,
    ) -> Result<Vec<LightElectricalProfileSet>, Error> {
        use database::tables::electrical_profile_set::dsl::*;
        let result = electrical_profile_set
            .select((id, name))
            .load(conn.write().await.deref_mut())
            .await?;
        Ok(result)
    }
}

#[derive(Debug, Queryable, Identifiable, Serialize, Deserialize, PartialEq, ToSchema)]
#[diesel(table_name = electrical_profile_set)]
pub struct LightElectricalProfileSet {
    pub id: i64,
    pub name: String,
}

#[cfg(any(test, feature = "testing"))]
impl ElectricalProfileSet {
    pub fn outer_space() -> Changeset<Self> {
        let json = include_str!("../../src/tests/electrical_profile_set.json");
        serde_json::from_str(json).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use database::DbConnectionPoolV2;

    use super::*;

    #[tokio::test(flavor = "multi_thread")]
    async fn test_list_light() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let set_1 = ElectricalProfileSet::outer_space()
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create test electrical profile set");
        let set_2 = ElectricalProfileSet::outer_space()
            .name("test_electrical_profile_set_2".to_string())
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create test electrical profile set");

        let list = ElectricalProfileSet::list_light(&mut db_pool.get_ok())
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
