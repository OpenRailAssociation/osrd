use chrono::DateTime;
use chrono::Utc;
use database::DbConnection;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use serde::Serialize;
use std::collections::HashMap;
use std::collections::HashSet;
use std::ops::DerefMut;
use utoipa::ToSchema;

use editoast_models::prelude::*;

#[derive(Clone, Debug, Serialize, Model, ToSchema)]
#[model(table = database::tables::stdcm_search_environment)]
#[model(gen(ops = crd, list))]
#[cfg_attr(
    test,
    derive(serde::Deserialize, PartialEq),
    model(changeset(derive(Clone)))
)]
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
    #[model(non_null_array = "i64")]
    pub operational_points: Vec<i64>,
    /// Map of speed limit tag with their value
    #[model(json)]
    pub speed_limit_tags: HashMap<String, i64>,
    pub default_speed_limit_tag: Option<String>,
    #[model(non_null_array = "String")]
    pub operational_points_id_filtered: Vec<String>,
    /// Map of a key (ex. loading gauge) with their allowed track section ids.
    #[model(json)]
    #[schema(required)]
    pub allowed_tracks: Option<HashMap<String, HashSet<String>>>,
}

impl StdcmSearchEnvironment {
    /// Retrieve the enabled search environment. If no env is enabled returns the most recent `enabled_until`.
    /// In case of multiple enabled environments, the one with the highest `id` is returned.
    pub async fn retrieve_latest_enabled(conn: &mut DbConnection) -> Option<Self> {
        use database::tables::stdcm_search_environment::dsl::*;
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
    pub async fn delete_all(conn: &mut DbConnection) -> Result<(), editoast_models::Error> {
        use database::tables::stdcm_search_environment::dsl::*;
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

    use super::*;
    use crate::models::fixtures::create_electrical_profile_set;
    use crate::models::fixtures::create_empty_infra;
    use crate::models::fixtures::create_temporary_speed_limit_group;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::create_work_schedule_group;
    use database::DbConnectionPoolV2;
    use editoast_models::ElectricalProfileSet;
    use editoast_models::Infra;
    use editoast_models::TemporarySpeedLimitGroup;
    use editoast_models::WorkScheduleGroup;
    use editoast_models::timetable::Timetable;

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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_retrieve_latest_empty() {
        let db_pool = DbConnectionPoolV2::for_tests();
        StdcmSearchEnvironment::delete_all(&mut db_pool.get_ok())
            .await
            .expect("Failed to delete all search environments");

        let result = StdcmSearchEnvironment::retrieve_latest_enabled(&mut db_pool.get_ok()).await;
        assert_eq!(result, None);
    }
}
