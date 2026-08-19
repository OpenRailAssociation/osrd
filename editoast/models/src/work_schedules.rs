use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

pub mod group {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, DeriveEntityModel, Eq, PartialEq)]
    #[sea_orm(table_name = "work_schedule_group")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: i64,
        pub creation_date: chrono::DateTime<chrono::Utc>,
        #[sea_orm(unique)]
        pub name: String,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(has_many = "super::schedule::Entity")]
        Schedule,
        #[sea_orm(has_many = "crate::stdcm_search_environment::Entity")]
        StdcmSearchEnvironment,
    }

    impl Related<super::schedule::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::Schedule.def()
        }
    }

    impl Related<crate::stdcm_search_environment::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::StdcmSearchEnvironment.def()
        }
    }

    impl ActiveModelBehavior for ActiveModel {}
}

#[derive(Debug, thiserror::Error)]
#[cfg_attr(test, derive(PartialEq))]
pub enum WsGroupError {
    #[error("Work schedule group name already used: {name}")]
    NameAlreadyUsed { name: String },
    #[error(transparent)]
    Database(crate::Error),
}

impl From<crate::Error> for WsGroupError {
    fn from(error: crate::Error) -> Self {
        if let Some(violation) = error.unique_violation()
            && violation.constraint == "work_schedule_group_name_key"
            && violation.column == "name"
        {
            return Self::NameAlreadyUsed {
                name: violation.value,
            };
        }
        Self::Database(error)
    }
}

impl From<sea_orm::DbErr> for WsGroupError {
    fn from(error: sea_orm::DbErr) -> Self {
        Self::from(crate::Error::from(error))
    }
}

#[derive(
    Clone,
    Copy,
    Debug,
    Default,
    Deserialize,
    sea_orm::DeriveActiveEnum,
    sea_orm::EnumIter,
    Eq,
    PartialEq,
    Serialize,
    ToSchema,
)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "i16", db_type = "SmallInteger")]
pub enum WorkScheduleType {
    #[default]
    Catenary = 0,
    Track = 1,
}

pub mod schedule {
    use schemas::infra::TrackRange;
    use sea_orm::entity::prelude::*;
    use serde::Deserialize;
    use serde::Serialize;
    use utoipa::ToSchema;

    use super::WorkScheduleType;
    use crate::sea_orm_types::ForeignJson;

    #[derive(
        Clone, Debug, Default, DeriveEntityModel, Deserialize, PartialEq, Serialize, ToSchema,
    )]
    #[sea_orm(table_name = "work_schedule")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: i64,
        pub start_date_time: chrono::DateTime<chrono::Utc>,
        pub end_date_time: chrono::DateTime<chrono::Utc>,
        #[sea_orm(column_type = "JsonBinary")]
        pub track_ranges: ForeignJson<Vec<TrackRange>>,
        pub obj_id: String,
        pub work_schedule_type: WorkScheduleType,
        pub work_schedule_group_id: i64,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(
            belongs_to = "super::group::Entity",
            from = "Column::WorkScheduleGroupId",
            to = "super::group::Column::Id",
            on_delete = "Cascade"
        )]
        Group,
    }

    impl Related<super::group::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::Group.def()
        }
    }

    impl ActiveModelBehavior for ActiveModel {}
}

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use database::Db;
    use sea_orm::ActiveModelTrait as _;
    use sea_orm::ActiveValue::Set;

    use super::WsGroupError;
    use super::group;

    #[tokio::test(flavor = "multi_thread")]
    async fn unique_group_name() {
        let db = Db::for_tests().await;

        group::ActiveModel {
            name: Set("UNIQUE_NAME".to_string()),
            creation_date: Set(Utc::now()),
            ..Default::default()
        }
        .insert(&db)
        .await
        .unwrap();

        let result = group::ActiveModel {
            name: Set("UNIQUE_NAME".to_string()),
            creation_date: Set(Utc::now()),
            ..Default::default()
        }
        .insert(&db)
        .await
        .map_err(WsGroupError::from);

        match result {
            Err(WsGroupError::NameAlreadyUsed { name }) => {
                assert_eq!(name, "UNIQUE_NAME");
            }
            other => panic!("Expected NameAlreadyUsed error, got: {other:?}"),
        }
    }
}
