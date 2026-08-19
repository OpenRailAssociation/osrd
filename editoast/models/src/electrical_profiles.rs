use database::Db;
use schemas::infra::ElectricalProfileSetData;
#[cfg(any(test, feature = "testing"))]
use sea_orm::ActiveValue::Set;
use sea_orm::DerivePartialModel;
use sea_orm::EntityTrait as _;
use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::sea_orm_types::ForeignJson;

#[derive(Clone, Debug, DeriveEntityModel, Deserialize, PartialEq, Serialize, ToSchema)]
#[sea_orm(table_name = "electrical_profile_set")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub name: String,
    #[sea_orm(column_type = "JsonBinary")]
    pub data: ForeignJson<ElectricalProfileSetData>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

#[derive(Debug, DerivePartialModel, Deserialize, PartialEq, Serialize, ToSchema)]
#[sea_orm(entity = "Entity")]
pub struct LightElectricalProfileSet {
    pub id: i64,
    pub name: String,
}

impl Model {
    pub async fn list_light(db: Db) -> Result<Vec<LightElectricalProfileSet>, crate::Error> {
        Entity::find()
            .into_partial_model::<LightElectricalProfileSet>()
            .all(&db)
            .await
            .map_err(crate::Error::from)
    }
}

#[cfg(any(test, feature = "testing"))]
impl ActiveModel {
    pub fn outer_space() -> Self {
        #[derive(Deserialize)]
        struct Fixture {
            name: String,
            data: ElectricalProfileSetData,
        }

        let json = include_str!("../../src/tests/electrical_profile_set.json");
        let fixture: Fixture = serde_json::from_str(json).unwrap();
        Self {
            name: Set(fixture.name),
            data: Set(ForeignJson::new(fixture.data)),
            ..Default::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::electrical_profiles;

    #[tokio::test(flavor = "multi_thread")]
    async fn test_list_light() {
        let db = Db::for_tests().await;
        let set_1 = electrical_profiles::ActiveModel::outer_space()
            .insert(&db)
            .await
            .expect("Failed to create test electrical profile set");
        let set_2 = electrical_profiles::ActiveModel {
            name: Set("test_electrical_profile_set_2".to_string()),
            ..electrical_profiles::ActiveModel::outer_space()
        }
        .insert(&db)
        .await
        .expect("Failed to create test electrical profile set");

        let list = electrical_profiles::Model::list_light(db)
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
