pub mod group {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, DeriveEntityModel, Eq, PartialEq)]
    #[sea_orm(table_name = "temporary_speed_limit_group")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: i64,
        pub creation_date: chrono::DateTime<chrono::Utc>,
        #[sea_orm(unique)]
        pub name: String,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(has_many = "super::speed_limit::Entity")]
        SpeedLimit,
        #[sea_orm(has_many = "crate::stdcm_search_environment::Entity")]
        StdcmSearchEnvironment,
    }

    impl Related<super::speed_limit::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::SpeedLimit.def()
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
pub enum TslGroupError {
    #[error("Temporary speed limit group name already used: {name}")]
    NameAlreadyUsed { name: String },
    #[error(transparent)]
    Database(crate::Error),
}

impl From<crate::Error> for TslGroupError {
    fn from(error: crate::Error) -> Self {
        if let Some(violation) = error.unique_violation()
            && violation.constraint == "temporary_speed_limit_group_name_key"
            && violation.column == "name"
        {
            return Self::NameAlreadyUsed {
                name: violation.value,
            };
        }
        Self::Database(error)
    }
}

pub mod speed_limit {
    use schemas::infra::DirectionalTrackRange;
    use sea_orm::entity::prelude::*;
    use serde::Serialize;

    use crate::sea_orm_types::ForeignJson;

    #[derive(Clone, Debug, DeriveEntityModel, PartialEq, Serialize, utoipa::ToSchema)]
    #[sea_orm(table_name = "temporary_speed_limit")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: i64,
        pub start_date_time: chrono::DateTime<chrono::Utc>,
        pub end_date_time: chrono::DateTime<chrono::Utc>,
        #[sea_orm(column_type = "Double")]
        pub speed_limit: f64,
        #[sea_orm(column_type = "JsonBinary")]
        pub track_ranges: ForeignJson<Vec<DirectionalTrackRange>>,
        pub obj_id: String,
        pub temporary_speed_limit_group_id: i64,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(
            belongs_to = "super::group::Entity",
            from = "Column::TemporarySpeedLimitGroupId",
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
