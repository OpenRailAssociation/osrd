use database::DbConnection;
use diesel::QueryableByName;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use std::collections::HashSet;
use std::ops::DerefMut;

use crate::SearchJourneyEnvironmentTimetable;
use crate::prelude::*;

#[derive(Clone, Debug, Model)]
#[model(table = database::tables::search_journey_environment)]
#[model(gen(ops = c))]
#[cfg_attr(any(test, feature = "testing"), derive(PartialEq))]
pub struct SearchJourneyEnvironment {
    pub id: i64,
    pub infra_id: i64,
}

impl SearchJourneyEnvironment {
    /// Creates an environment with infra_id and linked to timetable_ids
    pub async fn create_with_timetables(
        infra_id: i64,
        timetable_ids: HashSet<i64>,
        conn: &mut DbConnection,
    ) -> Result<Self, crate::Error> {
        conn.transaction(async move |mut conn| {
            let env = Self::changeset()
                .infra_id(infra_id)
                .create(&mut conn)
                .await?;
            for timetable_id in timetable_ids {
                SearchJourneyEnvironmentTimetable::changeset()
                    .search_journey_environment_id(env.id)
                    .timetable_id(timetable_id)
                    .create(&mut conn)
                    .await?;
            }
            Ok(env)
        })
        .await
    }
}

/// A search journey environment with its timetable ids.
#[derive(Debug, Clone, QueryableByName)]
#[cfg_attr(any(test, feature = "testing"), derive(PartialEq))]
pub struct SearchJourneyEnvironmentWithTimetables {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = BigInt)]
    pub infra_id: i64,
    #[diesel(sql_type = Array<BigInt>)]
    pub timetable_ids: Vec<i64>,
}

impl SearchJourneyEnvironmentWithTimetables {
    /// Returns the most recent env with its timetable ids or None if there is no env
    pub async fn retrieve_latest(conn: &mut DbConnection) -> Result<Option<Self>, crate::Error> {
        let result = sql_query(
            "SELECT search_journey_environment.*,
                array_remove(array_agg(search_journey_environment_timetable.timetable_id), NULL) AS timetable_ids
            FROM search_journey_environment
            LEFT JOIN search_journey_environment_timetable
                ON search_journey_environment.id = search_journey_environment_timetable.search_journey_environment_id
            GROUP BY search_journey_environment.id
            ORDER BY search_journey_environment.id DESC LIMIT 1",
        )
        .get_result::<Self>(conn.write().await.deref_mut())
        .await;
        match result {
            Ok(result) => Ok(Some(result)),
            Err(diesel::result::Error::NotFound) => Ok(None),
            Err(err) => Err(err.into()),
        }
    }
}

#[cfg(any(test, feature = "testing"))]
pub mod fixtures {
    use super::*;
    use crate::Infra;
    use crate::timetable::Timetable;

    pub async fn search_journey_env_fixtures(conn: &mut DbConnection) -> (Infra, Vec<Timetable>) {
        let infra = Infra::changeset()
            .name("empty_infra".to_owned())
            .last_railjson_version()
            .create(conn)
            .await
            .expect("Failed to create empty infra");

        let timetable_1 = Timetable::changeset()
            .create(conn)
            .await
            .expect("Failed to create timetable");

        let timetable_2 = Timetable::changeset()
            .create(conn)
            .await
            .expect("Failed to create timetable");

        (infra, vec![timetable_1, timetable_2])
    }
}

#[cfg(test)]
mod tests {
    use super::fixtures::search_journey_env_fixtures;
    use super::*;
    use database::DbConnectionPoolV2;
    use database::tables::search_journey_environment_timetable::dsl;
    use diesel::ExpressionMethods;
    use diesel::QueryDsl;
    use pretty_assertions::assert_eq;
    use std::collections::HashSet;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_create_with_timetables() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let (infra, timetables) = search_journey_env_fixtures(conn).await;
        let timetable_ids: HashSet<i64> = timetables.iter().map(|t| t.id).collect();

        let env =
            SearchJourneyEnvironment::create_with_timetables(infra.id, timetable_ids.clone(), conn)
                .await
                .expect("Failed to create search journey environment");

        assert_eq!(env.infra_id, infra.id);

        let linked_timetable_ids: HashSet<i64> = dsl::search_journey_environment_timetable
            .filter(dsl::search_journey_environment_id.eq(env.id))
            .select(dsl::timetable_id)
            .load::<i64>(conn.write().await.deref_mut())
            .await
            .expect("Failed to load linked timetable_ids")
            .into_iter()
            .collect();

        assert_eq!(linked_timetable_ids, timetable_ids);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_create_with_timetables_rejects_non_calendar() {
        use crate::Infra;
        use crate::timetable::Timetable;
        use crate::timetable_type::TimetableType;

        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let infra = Infra::changeset()
            .name("empty_infra".to_owned())
            .last_railjson_version()
            .create(conn)
            .await
            .expect("Failed to create empty infra");

        let hourly_timetable = Timetable::changeset()
            .timetable_type(TimetableType(
                schemas::timetable_type::TimetableType::Hourly,
            ))
            .create(conn)
            .await
            .expect("Failed to create hourly timetable");

        let result = SearchJourneyEnvironment::create_with_timetables(
            infra.id,
            HashSet::from([hourly_timetable.id]),
            conn,
        )
        .await;
        assert!(
            result.is_err(),
            "Linking a non-CALENDAR timetable must be rejected"
        );

        let latest = SearchJourneyEnvironmentWithTimetables::retrieve_latest(conn)
            .await
            .expect("retrieve_latest should not fail");
        assert_eq!(latest, None);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_retrieve_latest() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let (infra, timetables) = search_journey_env_fixtures(conn).await;
        let timetable_ids: HashSet<i64> = timetables.iter().map(|t| t.id).collect();

        let _first = SearchJourneyEnvironment::changeset()
            .infra_id(infra.id)
            .create(conn)
            .await
            .expect("Failed to create search journey environment");

        let latest =
            SearchJourneyEnvironment::create_with_timetables(infra.id, timetable_ids.clone(), conn)
                .await
                .expect("Failed to create search journey environment");

        let result = SearchJourneyEnvironmentWithTimetables::retrieve_latest(conn)
            .await
            .expect("Failed to retrieve latest search journey environment")
            .expect("No search journey environment found");

        assert_eq!(result.id, latest.id);
        assert_eq!(result.infra_id, latest.infra_id);

        let retrieved_timetable_ids: HashSet<i64> = result.timetable_ids.into_iter().collect();
        assert_eq!(retrieved_timetable_ids, timetable_ids);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_retrieve_latest_empty() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let result = SearchJourneyEnvironmentWithTimetables::retrieve_latest(&mut db_pool.get_ok())
            .await
            .expect("retrieve_latest should not fail on an empty table");
        assert_eq!(result, None);
    }
}
