use std::collections::HashMap;
use std::collections::HashSet;

use database::Db;
use sea_orm::EntityTrait as _;
use sea_orm::QueryFilter as _;
use sea_orm::QueryOrder as _;
use sea_orm::entity::prelude::*;
use sea_orm::sea_query::Expr;
use sea_orm::sea_query::ExprTrait as _;
use serde::Serialize;
use utoipa::ToSchema;

use crate::sea_orm_types::ForeignJson;

#[derive(Clone, Debug, DeriveEntityModel, PartialEq, Serialize, ToSchema)]
#[cfg_attr(any(test, feature = "testing"), derive(serde::Deserialize))]
#[sea_orm(table_name = "stdcm_search_environment")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub infra_id: i64,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub electrical_profile_set_id: Option<i64>,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_schedule_group_id: Option<i64>,
    pub timetable_id: i64,
    /// The start of the search time window.
    /// Usually, trains schedules from the `timetable_id` runs within this window.
    pub search_window_begin: chrono::DateTime<chrono::Utc>,
    /// The end of the search time window.
    pub search_window_end: chrono::DateTime<chrono::Utc>,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temporary_speed_limit_group_id: Option<i64>,
    /// The time window start point where the environment is enabled.
    pub enabled_from: chrono::DateTime<chrono::Utc>,
    /// The time window end point where the environment is enabled.
    /// This value is usually lower than the `search_window_begin`, since a search is performed before the train rolls.
    pub enabled_until: chrono::DateTime<chrono::Utc>,
    pub operational_points: Vec<i64>,
    /// Map of speed limit tag with their value
    #[sea_orm(column_type = "JsonBinary")]
    pub speed_limit_tags: ForeignJson<HashMap<String, i64>>,
    pub default_speed_limit_tag: Option<String>,
    pub operational_points_id_filtered: Vec<String>,
    /// Map of a key (ex. loading gauge) with their allowed track section ids.
    #[sea_orm(column_type = "JsonBinary")]
    #[schema(required, value_type = Option<HashMap<String, HashSet<String>>>)]
    pub allowed_tracks: ForeignJson<Option<HashMap<String, HashSet<String>>>>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::electrical_profiles::Entity",
        from = "Column::ElectricalProfileSetId",
        to = "super::electrical_profiles::Column::Id"
    )]
    ElectricalProfileSet,
    #[sea_orm(
        belongs_to = "super::infra::Entity",
        from = "Column::InfraId",
        to = "super::infra::Column::Id"
    )]
    Infra,
    #[sea_orm(
        belongs_to = "super::temporary_speed_limits::group::Entity",
        from = "Column::TemporarySpeedLimitGroupId",
        to = "super::temporary_speed_limits::group::Column::Id"
    )]
    TemporarySpeedLimitGroup,
    #[sea_orm(
        belongs_to = "super::timetable::Entity",
        from = "Column::TimetableId",
        to = "super::timetable::Column::Id"
    )]
    Timetable,
    #[sea_orm(
        belongs_to = "super::work_schedules::group::Entity",
        from = "Column::WorkScheduleGroupId",
        to = "super::work_schedules::group::Column::Id"
    )]
    WorkScheduleGroup,
}

impl Related<super::infra::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Infra.def()
    }
}

impl Related<super::timetable::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Timetable.def()
    }
}

impl Related<super::temporary_speed_limits::group::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TemporarySpeedLimitGroup.def()
    }
}

impl Related<super::work_schedules::group::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::WorkScheduleGroup.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

impl Model {
    /// Retrieve the enabled search environment. If no env is enabled returns the most recent `enabled_until`.
    /// In case of multiple enabled environments, the one with the highest `id` is returned.
    pub async fn retrieve_latest_enabled(db: Db) -> Option<Self> {
        // Search for enabled env
        let enabled = Entity::find()
            .filter(Expr::col(Column::EnabledFrom).lte(Expr::current_timestamp()))
            .filter(Expr::col(Column::EnabledUntil).gte(Expr::current_timestamp()))
            .order_by_desc(Column::Id)
            .one(&db)
            .await
            .ok()
            .flatten();
        if enabled.is_some() {
            return enabled;
        }

        // Search for the most recent env
        tracing::warn!("No STDCM search environment enabled");
        Entity::find()
            .order_by_desc(Column::EnabledUntil)
            .order_by_desc(Column::Id)
            .one(&db)
            .await
            .ok()
            .flatten()
    }

    #[cfg(any(test, feature = "testing"))]
    /// Delete all existing search environments.
    pub async fn delete_all(db: Db) -> Result<(), crate::Error> {
        Entity::delete_many().exec(&db).await?;
        Ok(())
    }
}

#[cfg(any(test, feature = "testing"))]
pub mod fixtures {
    use chrono::Utc;
    use database::Db;
    use sea_orm::ActiveModelTrait as _;
    use sea_orm::Set;

    use crate::electrical_profiles;
    use crate::infra;
    use crate::temporary_speed_limits;
    use crate::timetable;
    use crate::work_schedules;

    pub async fn stdcm_search_env_fixtures(
        db: Db,
    ) -> (
        infra::Model,
        timetable::Model,
        work_schedules::group::Model,
        temporary_speed_limits::group::Model,
        electrical_profiles::Model,
    ) {
        let infra = infra::ActiveModel {
            name: Set("empty_infra".to_owned()),
            ..Default::default()
        }
        .last_railjson_version()
        .insert(&db)
        .await
        .expect("Failed to create empty infra");

        let timetable = <timetable::ActiveModel as Default>::default()
            .insert(&db)
            .await
            .expect("Failed to create timetable");

        let work_schedule_group = work_schedules::group::ActiveModel {
            name: Set("Test work schedule group".to_string()),
            creation_date: Set(Utc::now()),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create work schedule group");

        let temporary_speed_limit_group = temporary_speed_limits::group::ActiveModel {
            name: Set("Test temporary speed limit group".to_string()),
            creation_date: Set(Utc::now()),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create temporary speed limit group");

        let electrical_profile_set = electrical_profiles::ActiveModel::outer_space()
            .insert(&db)
            .await
            .expect("Failed to create electrical profile set");

        (
            infra,
            timetable,
            work_schedule_group,
            temporary_speed_limit_group,
            electrical_profile_set,
        )
    }
}

#[cfg(test)]
mod tests {
    use chrono::Duration;
    use chrono::DurationRound;
    use chrono::TimeZone;
    use chrono::Utc;
    use pretty_assertions::assert_eq;

    use database::Db;
    use sea_orm::Set;

    use super::fixtures::stdcm_search_env_fixtures;
    use super::*;
    use crate::stdcm_search_environment;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_retrieve_latest() {
        let db = Db::for_tests().await;

        let (
            infra,
            timetable,
            work_schedule_group,
            temporary_speed_limit_group,
            electrical_profile_set,
        ) = stdcm_search_env_fixtures(db.clone()).await;

        let too_old = stdcm_search_environment::ActiveModel {
            infra_id: Set(infra.id),
            electrical_profile_set_id: Set(Some(electrical_profile_set.id)),
            work_schedule_group_id: Set(Some(work_schedule_group.id)),
            temporary_speed_limit_group_id: Set(Some(temporary_speed_limit_group.id)),
            timetable_id: Set(timetable.id),
            search_window_begin: Set(Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap()),
            search_window_end: Set(Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap()),
            enabled_from: Set(Utc::now() - Duration::days(3)),
            enabled_until: Set(Utc::now() - Duration::days(2)),
            ..Default::default()
        };

        let mut too_young = too_old.clone();
        too_young.enabled_from = Set(Utc::now() + Duration::days(2));
        too_young.enabled_until = Set(Utc::now() + Duration::days(3));

        let mut enabled_but_not_last = too_old.clone();
        enabled_but_not_last.enabled_from = Set(Utc::now() - Duration::hours(1));
        enabled_but_not_last.enabled_until = Set(Utc::now() + Duration::hours(1));

        let enabled_from =
            Utc::now().duration_trunc(Duration::seconds(1)).unwrap() - Duration::days(1);
        let enabled_until =
            Utc::now().duration_trunc(Duration::seconds(1)).unwrap() + Duration::days(1);

        let mut the_best = too_old.clone();
        the_best.enabled_from = Set(enabled_from);
        the_best.enabled_until = Set(enabled_until);

        for active_model in [
            too_old,
            too_young.clone(),
            enabled_but_not_last,
            the_best,
            too_young,
        ] {
            active_model
                .insert(&db)
                .await
                .expect("Failed to create search environment");
        }

        let result = stdcm_search_environment::Model::retrieve_latest_enabled(db.clone())
            .await
            .expect("Failed to retrieve latest search environment");

        assert_eq!(result.enabled_from, enabled_from);
        assert_eq!(result.enabled_until, enabled_until);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_retrieve_latest_empty() {
        let db = Db::for_tests().await;
        stdcm_search_environment::Model::delete_all(db.clone())
            .await
            .expect("Failed to delete all search environments");

        let result = stdcm_search_environment::Model::retrieve_latest_enabled(db.clone()).await;
        assert_eq!(result, None);
    }
}
