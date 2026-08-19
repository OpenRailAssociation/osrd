use std::collections::HashSet;

use database::Db;
use sea_orm::ActiveModelTrait as _;
use sea_orm::ActiveValue::Set;
use sea_orm::EntityTrait as _;
use sea_orm::TransactionTrait as _;
use sea_orm::entity::prelude::*;

use crate::search_journey_environment_timetable;

#[derive(Clone, Debug, DeriveEntityModel, Eq, PartialEq)]
#[sea_orm(table_name = "search_journey_environment")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub infra_id: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::infra::Entity",
        from = "Column::InfraId",
        to = "super::infra::Column::Id"
    )]
    Infra,
    #[sea_orm(has_many = "super::search_journey_environment_timetable::Entity")]
    Timetable,
}

impl Related<super::infra::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Infra.def()
    }
}

impl Related<super::search_journey_environment_timetable::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Timetable.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

impl Model {
    /// Creates an environment with infra_id and linked to timetable_ids
    pub async fn create_with_timetables(
        infra_id: i64,
        timetable_ids: HashSet<i64>,
        db: Db,
    ) -> Result<Self, crate::Error> {
        db.transaction::<_, _, crate::Error>(move |txn| {
            Box::pin(async move {
                let environment = ActiveModel {
                    infra_id: Set(infra_id),
                    ..Default::default()
                }
                .insert(txn)
                .await?;
                if !timetable_ids.is_empty() {
                    let links = timetable_ids.into_iter().map(|timetable_id| {
                        search_journey_environment_timetable::ActiveModel {
                            search_journey_environment_id: Set(environment.id),
                            timetable_id: Set(timetable_id),
                            ..Default::default()
                        }
                    });
                    super::search_journey_environment_timetable::Entity::insert_many(links)
                        .exec(txn)
                        .await?;
                }
                Ok(environment)
            })
        })
        .await
        .map_err(Into::into)
    }
}

/// A search journey environment with its timetable ids.
#[derive(Debug, Clone, Eq, PartialEq)]
pub struct SearchJourneyEnvironmentWithTimetables {
    pub id: i64,
    pub infra_id: i64,
    pub timetable_ids: Vec<i64>,
}

impl SearchJourneyEnvironmentWithTimetables {
    /// Returns the most recent env with its timetable ids or None if there is no env
    pub async fn retrieve_latest(db: Db) -> Result<Option<Self>, crate::Error> {
        Ok(sqlx::query_as!(
            Self,
            "SELECT search_journey_environment.id,
                search_journey_environment.infra_id,
                array_remove(array_agg(search_journey_environment_timetable.timetable_id), NULL) AS \"timetable_ids!\"
            FROM search_journey_environment
            LEFT JOIN search_journey_environment_timetable
                ON search_journey_environment.id = search_journey_environment_timetable.search_journey_environment_id
            GROUP BY search_journey_environment.id
            ORDER BY search_journey_environment.id DESC LIMIT 1"
        )
        .fetch_optional(db.sqlx())
        .await?)
    }
}

#[cfg(any(test, feature = "testing"))]
pub mod fixtures {
    use database::Db;

    use super::*;
    use crate::infra;
    use crate::timetable;

    pub async fn search_journey_env_fixtures(db: Db) -> (infra::Model, Vec<timetable::Model>) {
        let infra = infra::ActiveModel {
            name: Set("empty_infra".to_owned()),
            ..Default::default()
        }
        .last_railjson_version()
        .insert(&db)
        .await
        .expect("Failed to create empty infra");

        let timetable_1 = <timetable::ActiveModel as Default>::default()
            .insert(&db)
            .await
            .expect("Failed to create timetable");

        let timetable_2 = <timetable::ActiveModel as Default>::default()
            .insert(&db)
            .await
            .expect("Failed to create timetable");

        (infra, vec![timetable_1, timetable_2])
    }
}

#[cfg(test)]
mod tests {
    use super::fixtures::search_journey_env_fixtures;
    use super::*;
    use database::Db;
    use pretty_assertions::assert_eq;
    use sea_orm::QuerySelect as _;
    use sea_orm::Set;
    use std::collections::HashSet;

    use crate::infra;
    use crate::search_journey_environment;
    use crate::timetable;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_create_with_timetables() {
        let db = Db::for_tests().await;

        let (infra, timetables) = search_journey_env_fixtures(db.clone()).await;
        let timetable_ids: HashSet<i64> = timetables.iter().map(|t| t.id).collect();

        let env = search_journey_environment::Model::create_with_timetables(
            infra.id,
            timetable_ids.clone(),
            db.clone(),
        )
        .await
        .expect("Failed to create search journey environment");

        assert_eq!(env.infra_id, infra.id);

        let linked_timetable_ids: HashSet<i64> =
            super::super::search_journey_environment_timetable::Entity::find()
                .select_only()
                .column(
                    super::super::search_journey_environment_timetable::Column::TimetableId,
                )
                .filter(
                    super::super::search_journey_environment_timetable::Column::SearchJourneyEnvironmentId
                        .eq(env.id),
                )
                .into_tuple()
                .all(&db)
                .await
                .expect("Failed to load linked timetable_ids")
                .into_iter()
                .collect();

        assert_eq!(linked_timetable_ids, timetable_ids);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_create_with_timetables_rejects_non_calendar() {
        use super::super::timetable_type::TimetableType;

        let db = Db::for_tests().await;

        let infra = infra::ActiveModel {
            name: Set("empty_infra".to_owned()),
            ..Default::default()
        }
        .last_railjson_version()
        .insert(&db)
        .await
        .expect("Failed to create empty infra");

        let hourly_timetable = timetable::ActiveModel {
            timetable_type: Set(TimetableType::Hourly),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create hourly timetable");

        let result = search_journey_environment::Model::create_with_timetables(
            infra.id,
            HashSet::from([hourly_timetable.id]),
            db.clone(),
        )
        .await;
        assert!(
            result.is_err(),
            "Linking a non-CALENDAR timetable must be rejected"
        );

        let latest = SearchJourneyEnvironmentWithTimetables::retrieve_latest(db.clone())
            .await
            .expect("retrieve_latest should not fail");
        assert_eq!(latest, None);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_retrieve_latest() {
        let db = Db::for_tests().await;

        let (infra, timetables) = search_journey_env_fixtures(db.clone()).await;
        let timetable_ids: HashSet<i64> = timetables.iter().map(|t| t.id).collect();

        let _first = search_journey_environment::ActiveModel {
            infra_id: Set(infra.id),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create search journey environment");

        let latest = search_journey_environment::Model::create_with_timetables(
            infra.id,
            timetable_ids.clone(),
            db.clone(),
        )
        .await
        .expect("Failed to create search journey environment");

        let result = SearchJourneyEnvironmentWithTimetables::retrieve_latest(db.clone())
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
        let db = Db::for_tests().await;
        let result = SearchJourneyEnvironmentWithTimetables::retrieve_latest(db.clone())
            .await
            .expect("retrieve_latest should not fail on an empty table");
        assert_eq!(result, None);
    }
}
