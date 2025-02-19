use chrono::DateTime;
use chrono::Utc;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use editoast_models::DbConnection;
use serde::Serialize;
use std::ops::DerefMut;
use utoipa::ToSchema;

use crate::models::prelude::*;

#[cfg(test)]
use editoast_models::model;
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
    /// The start of the search time window.
    /// Usually, trains schedules from the `timetable_id` runs within this window.
    pub search_window_begin: DateTime<Utc>,
    /// The end of the search time window.
    pub search_window_end: DateTime<Utc>,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temporary_speed_limit_group_id: Option<i64>,
    /// The time window start point where the environment is enabled.
    pub enabled_from: DateTime<Utc>,
    /// The time window end point where the environment is enabled.
    /// This value is usually lower than the `search_window_begin`, since a search is performed before the train rolls.
    pub enabled_until: DateTime<Utc>,
}

impl StdcmSearchEnvironment {
    /// Retrieve the enabled search environment. If no env is enabled returns the most recent `enabled_until`.
    /// In case of multiple enabled environments, the one with the highest `id` is returned.
    pub async fn retrieve_latest_enabled(conn: &mut DbConnection) -> Option<Self> {
        use editoast_models::tables::stdcm_search_environment::dsl::*;
        // Search for enabled env
        let enabled_env = stdcm_search_environment
            .order_by(id.desc())
            .filter(enabled_from.le(diesel::dsl::now))
            .filter(enabled_until.ge(diesel::dsl::now))
            .first::<Row<StdcmSearchEnvironment>>(conn.write().await.deref_mut())
            .await
            .map(Into::into)
            .ok();
        if enabled_env.is_some() {
            return enabled_env;
        }

        // Search for the most recent env
        tracing::warn!("No STDCM search environment enabled");
        stdcm_search_environment
            .order_by((enabled_until.desc(), id.desc()))
            .first::<Row<StdcmSearchEnvironment>>(conn.write().await.deref_mut())
            .await
            .map(Into::into)
            .ok()
    }

    /// Delete all existing search environments.
    #[cfg(test)]
    pub async fn delete_all(conn: &mut DbConnection) -> Result<(), model::Error> {
        use editoast_models::tables::stdcm_search_environment::dsl::*;
        diesel::delete(stdcm_search_environment)
            .execute(conn.write().await.deref_mut())
            .await?;
        Ok(())
    }
}

#[cfg(test)]
pub mod tests {
    use chrono::Duration;
    use chrono::DurationRound;
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
    use crate::models::Model;
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
    async fn test_retrieve_latest() {
        let db_pool = DbConnectionPoolV2::for_tests();

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
            .search_window_end(Utc.with_ymd_and_hms(2024, 1, 2, 0, 0, 0).unwrap())
            .enabled_from(Utc::now() - Duration::days(3))
            .enabled_until(Utc::now() - Duration::days(2));

        let too_young = too_old
            .clone()
            .enabled_from(Utc::now() + Duration::days(2))
            .enabled_until(Utc::now() + Duration::days(3));

        let enabled_but_not_last = too_old
            .clone()
            .enabled_from(Utc::now() - Duration::hours(1))
            .enabled_until(Utc::now() + Duration::hours(1));

        let enabled_from =
            Utc::now().duration_trunc(Duration::seconds(1)).unwrap() - Duration::days(1);
        let enabled_until =
            Utc::now().duration_trunc(Duration::seconds(1)).unwrap() + Duration::days(1);

        let the_best = too_old
            .clone()
            .enabled_from(enabled_from)
            .enabled_until(enabled_until);

        for changeset in [
            too_old,
            too_young.clone(),
            enabled_but_not_last,
            the_best,
            too_young,
        ] {
            changeset
                .create(&mut db_pool.get_ok())
                .await
                .expect("Failed to create search environment");
        }

        let result = StdcmSearchEnvironment::retrieve_latest_enabled(&mut db_pool.get_ok())
            .await
            .expect("Failed to retrieve latest search environment");

        assert_eq!(result.enabled_from, enabled_from);
        assert_eq!(result.enabled_until, enabled_until);
    }

    #[rstest]
    async fn test_retrieve_latest_empty() {
        let db_pool = DbConnectionPoolV2::for_tests();
        StdcmSearchEnvironment::delete_all(&mut db_pool.get_ok())
            .await
            .expect("Failed to delete all search environments");

        let result = StdcmSearchEnvironment::retrieve_latest_enabled(&mut db_pool.get_ok()).await;
        assert_eq!(result, None);
    }
}
