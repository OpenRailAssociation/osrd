use chrono::DateTime;
use chrono::Utc;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use editoast_models::model;
use editoast_models::DbConnection;
use serde::Serialize;
use std::ops::DerefMut;
use std::result::Result;
use utoipa::ToSchema;

use crate::models::prelude::*;

#[cfg(test)]
use serde::Deserialize;

#[derive(Debug, Clone, Model, ToSchema, Serialize)]
#[model(table = editoast_models::tables::stdcm_search_environment)]
#[model(gen(ops = crd, list))]
#[cfg_attr(test, derive(Deserialize, PartialEq), model(changeset(derive(Clone))))]
pub struct StdcmSearchEnvironment {
    pub id: i64,
    pub infra_id: i64,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub electrical_profile_set_id: Option<i64>,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_schedule_group_id: Option<i64>,
    pub timetable_id: i64,
    pub search_window_begin: DateTime<Utc>,
    pub search_window_end: DateTime<Utc>,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temporary_speed_limit_group_id: Option<i64>,
}

impl StdcmSearchEnvironment {
    /// Retrieve the latest search environment. Returns None if no search environment is found.
    pub async fn retrieve_latest(conn: &mut DbConnection) -> Option<Self> {
        use editoast_models::tables::stdcm_search_environment::dsl::*;
        stdcm_search_environment
            .order_by((search_window_end.desc(), search_window_begin.asc()))
            .first::<Row<StdcmSearchEnvironment>>(conn.write().await.deref_mut())
            .await
            .map(Into::into)
            .ok()
    }

    pub async fn delete_all(conn: &mut DbConnection) -> Result<(), model::Error> {
        use editoast_models::tables::stdcm_search_environment::dsl::*;
        diesel::delete(stdcm_search_environment)
            .execute(conn.write().await.deref_mut())
            .await?;
        Ok(())
    }
}

impl StdcmSearchEnvironmentChangeset {
    pub async fn overwrite(
        self,
        conn: &mut DbConnection,
    ) -> Result<StdcmSearchEnvironment, model::Error> {
        StdcmSearchEnvironment::delete_all(conn).await?;
        self.create(conn).await
    }
}

#[cfg(test)]
pub mod tests {
    use chrono::TimeZone;
    use chrono::Utc;
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use super::*;
    use crate::models::electrical_profiles::ElectricalProfileSet;
    use crate::models::fixtures::{
        create_electrical_profile_set, create_empty_infra, create_temporary_speed_limit_group,
        create_timetable, create_work_schedule_group,
    };
    use crate::models::temporary_speed_limits::TemporarySpeedLimitGroup;
    use crate::models::timetable::Timetable;
    use crate::models::work_schedules::WorkScheduleGroup;
    use crate::models::Infra;
    use crate::models::{Count, Model, SelectionSettings};
    use editoast_models::DbConnectionPoolV2;

    pub async fn stdcm_search_env_fixtures(
        conn: &mut DbConnection,
    ) -> (
        Infra,
        Timetable,
        WorkScheduleGroup,
        TemporarySpeedLimitGroup,
        ElectricalProfileSet,
    ) {
        let infra = create_empty_infra(conn).await;
        let timetable = create_timetable(conn).await;
        let work_schedule_group = create_work_schedule_group(conn).await;
        let temporary_speed_limit_group = create_temporary_speed_limit_group(conn).await;
        let electrical_profile_set = create_electrical_profile_set(conn).await;

        (
            infra,
            timetable,
            work_schedule_group,
            temporary_speed_limit_group,
            electrical_profile_set,
        )
    }

    #[rstest]
    async fn test_overwrite() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let initial_env_count =
            StdcmSearchEnvironment::count(&mut db_pool.get_ok(), Default::default())
                .await
                .expect("failed to count STDCM envs");
        let (
            infra,
            timetable,
            work_schedule_group,
            temporary_speed_limit_group,
            electrical_profile_set,
        ) = stdcm_search_env_fixtures(&mut db_pool.get_ok()).await;

        let changeset_1 = StdcmSearchEnvironment::changeset()
            .infra_id(infra.id)
            .electrical_profile_set_id(Some(electrical_profile_set.id))
            .work_schedule_group_id(Some(work_schedule_group.id))
            .temporary_speed_limit_group_id(Some(temporary_speed_limit_group.id))
            .timetable_id(timetable.id)
            .search_window_begin(Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap())
            .search_window_end(Utc.with_ymd_and_hms(2024, 1, 15, 0, 0, 0).unwrap());

        let begin = Utc.with_ymd_and_hms(2024, 1, 16, 0, 0, 0).unwrap();
        let end = Utc.with_ymd_and_hms(2024, 1, 13, 0, 0, 0).unwrap();

        let changeset_2 = changeset_1
            .clone()
            .search_window_begin(begin)
            .search_window_end(end);

        changeset_1
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create first search environment");

        assert_eq!(
            StdcmSearchEnvironment::count(&mut db_pool.get_ok(), SelectionSettings::new())
                .await
                .expect("Failed to count"),
            initial_env_count + 1
        );

        let _ = changeset_2
            .overwrite(&mut db_pool.get_ok())
            .await
            .expect("Failed to overwrite search environment");

        assert_eq!(
            StdcmSearchEnvironment::count(&mut db_pool.get_ok(), SelectionSettings::new())
                .await
                .expect("Failed to count"),
            1
        );

        let result = StdcmSearchEnvironment::retrieve_latest(&mut db_pool.get_ok())
            .await
            .expect("Failed to retrieve latest search environment");

        assert_eq!(result.search_window_begin, begin);
        assert_eq!(result.search_window_end, end);
    }

    #[rstest]
    async fn test_retrieve_latest() {
        let db_pool = DbConnectionPoolV2::for_tests();
        StdcmSearchEnvironment::delete_all(&mut db_pool.get_ok())
            .await
            .expect("failed to delete envs");
        let (
            infra,
            timetable,
            work_schedule_group,
            temporary_speed_limit_group,
            electrical_profile_set,
        ) = stdcm_search_env_fixtures(&mut db_pool.get_ok()).await;

        let too_old = StdcmSearchEnvironment::changeset()
            .infra_id(infra.id)
            .electrical_profile_set_id(Some(electrical_profile_set.id))
            .work_schedule_group_id(Some(work_schedule_group.id))
            .temporary_speed_limit_group_id(Some(temporary_speed_limit_group.id))
            .timetable_id(timetable.id)
            .search_window_begin(Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap())
            .search_window_end(Utc.with_ymd_and_hms(2024, 1, 15, 0, 0, 0).unwrap());

        let too_young = too_old
            .clone()
            .search_window_begin(Utc.with_ymd_and_hms(2024, 1, 16, 0, 0, 0).unwrap())
            .search_window_end(Utc.with_ymd_and_hms(2024, 1, 31, 0, 0, 0).unwrap());

        let begin = Utc.with_ymd_and_hms(2024, 1, 7, 0, 0, 0).unwrap();
        let end = Utc.with_ymd_and_hms(2024, 1, 31, 0, 0, 0).unwrap();

        let the_best = too_old
            .clone()
            .search_window_begin(begin)
            .search_window_end(end);

        for changeset in [too_old, too_young.clone(), the_best, too_young] {
            changeset
                .create(&mut db_pool.get_ok())
                .await
                .expect("Failed to create search environment");
        }

        let result = StdcmSearchEnvironment::retrieve_latest(&mut db_pool.get_ok())
            .await
            .expect("Failed to retrieve latest search environment");

        assert_eq!(result.search_window_begin, begin);
        assert_eq!(result.search_window_end, end);
    }

    #[rstest]
    async fn test_retrieve_latest_empty() {
        let db_pool = DbConnectionPoolV2::for_tests();
        StdcmSearchEnvironment::delete_all(&mut db_pool.get_ok())
            .await
            .expect("failed to delete envs");
        let result = StdcmSearchEnvironment::retrieve_latest(&mut db_pool.get_ok()).await;
        assert_eq!(result, None);
    }
}
