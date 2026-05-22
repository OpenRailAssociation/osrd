use database::DbConnectionPoolV2;
use editoast_models::timetable::Timetable;
use std::sync::Arc;

use editoast_models::TrainScheduleSet;

use crate::client::OpenfgaConfig;
use editoast_models::Group;
use editoast_models::Infra;
use editoast_models::User;
use editoast_models::prelude::*;
use fga::client::UntypedTuple;
use fga::client::UserOrUserset;
use futures::TryStreamExt as _;
use std::collections::HashSet;

struct ExistingEntities {
    users: HashSet<i64>,
    groups: HashSet<i64>,
    infras: HashSet<i64>,
}

pub async fn run_garbage_collector(
    db_pool: Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    clean_orphaned_timetables(&db_pool).await?;
    clean_orphaned_train_schedule_sets(&db_pool).await?;
    clean_orphaned_openfga_tuples(&db_pool, openfga_config).await?;
    Ok(())
}

/// Deletes timetables that are not referenced by any Scenario or StdcmSearchEnvironment
async fn clean_orphaned_timetables(db_pool: &Arc<DbConnectionPoolV2>) -> anyhow::Result<()> {
    let conn = &mut db_pool.get().await?;

    println!("🧹 Removing orphaned timetables...");
    let deleted_count = Timetable::delete_orphaned(conn).await?;

    if deleted_count == 0 {
        println!("✨ No orphaned timetables found");
    } else {
        println!("✅ {} orphaned timetable(s) deleted", deleted_count);
    }
    Ok(())
}

/// Deletes train schedule sets that are not published or linked to a timetable
async fn clean_orphaned_train_schedule_sets(
    db_pool: &Arc<DbConnectionPoolV2>,
) -> anyhow::Result<()> {
    let conn = &mut db_pool.get().await?;

    println!("🧹 Removing orphaned train schedule sets...");
    let deleted_count = TrainScheduleSet::delete_orphaned(conn).await?;

    if deleted_count == 0 {
        println!("✨ No orphaned train schedule sets found");
    } else {
        println!(
            "✅ {} orphaned train schedule set(s) deleted",
            deleted_count
        );
    }
    Ok(())
}

/// Deletes OpenFGA tuples that are not related to any existing infra, group or user
async fn clean_orphaned_openfga_tuples(
    db_pool: &Arc<DbConnectionPoolV2>,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    println!("🧹 Removing orphaned openfga tuples...");
    let regulator = openfga_config.into_regulator(db_pool.clone()).await?;
    let deleted_count = delete_orphaned_tuples(regulator.openfga(), db_pool).await?;

    if deleted_count == 0 {
        println!("✨ No orphaned openfga tuples found");
    } else {
        println!("✅ {} orphaned openfga tuple(s) deleted", deleted_count);
    }
    Ok(())
}

async fn delete_orphaned_tuples(
    client: &fga::Client,
    db_pool: &Arc<DbConnectionPoolV2>,
) -> anyhow::Result<usize> {
    let entities = load_existing_entities(db_pool).await?;

    let mut deletes = client.prepare_deletes();
    let mut stream = client
        .list_tuples()
        .try_filter(|untyped| futures::future::ready(is_tuple_orphaned(untyped, &entities)));
    let mut count = 0;
    while let Some(untyped) = stream.try_next().await? {
        deletes.push_untyped(untyped);
        count += 1;
    }
    deletes.execute().await?;
    Ok(count)
}

async fn load_existing_entities(
    db_pool: &Arc<DbConnectionPoolV2>,
) -> anyhow::Result<ExistingEntities> {
    let conn = &mut db_pool.get().await?;

    let users = User::list(conn, SelectionSettings::new())
        .await?
        .into_iter()
        .map(|user| user.id)
        .collect();

    let groups = Group::list(conn, SelectionSettings::new())
        .await?
        .into_iter()
        .map(|group| group.id)
        .collect();

    let infras = Infra::list(conn, SelectionSettings::new())
        .await?
        .into_iter()
        .map(|infra| infra.id)
        .collect();

    Ok(ExistingEntities {
        users,
        groups,
        infras,
    })
}

fn is_userset_orphaned(userset: &fga::client::UntypedUserset, entities: &ExistingEntities) -> bool {
    if let Some(group) = userset.as_type::<authz::Group>() {
        !entities.groups.contains(&group.0)
    } else if let Some(user) = userset.as_type::<authz::User>() {
        !entities.users.contains(&user.0)
    } else {
        tracing::warn!(userset = ?userset, "OpenFGA GC: unrecognized userset type, kept for safety");
        false
    }
}

fn is_orphaned_infra_relation<R>(
    untyped: &UntypedTuple,
    relation: R,
    entities: &ExistingEntities,
) -> Option<bool>
where
    R: fga::model::Relation<User = authz::User, Object = authz::Infra>,
{
    let (user, infra) = untyped.as_relation(relation)?;
    if !entities.infras.contains(&infra.0) {
        return Some(true);
    }
    Some(match user {
        UserOrUserset::User(user) => !entities.users.contains(&user.0),
        UserOrUserset::Userset(userset) => is_userset_orphaned(&userset, entities),
    })
}

/// Checks if a tuple references orphaned entities
fn is_tuple_orphaned(untyped: &UntypedTuple, entities: &ExistingEntities) -> bool {
    // Infra relations
    if let Some(is_orphaned) = is_orphaned_infra_relation(untyped, authz::Infra::reader(), entities)
        .or_else(|| is_orphaned_infra_relation(untyped, authz::Infra::writer(), entities))
        .or_else(|| is_orphaned_infra_relation(untyped, authz::Infra::owner(), entities))
    {
        return is_orphaned;
    }

    // User relations
    if let Some(is_orphaned) = untyped
        .as_relation(authz::User::role())
        .map(|(_, user)| !entities.users.contains(&user.0))
        .or_else(|| {
            let (group, user) = untyped.as_relation(authz::User::group())?;
            let group_orphaned = match group {
                UserOrUserset::User(group) => !entities.groups.contains(&group.0),
                UserOrUserset::Userset(userset) => is_userset_orphaned(&userset, entities),
            };
            Some(!entities.users.contains(&user.0) || group_orphaned)
        })
    {
        return is_orphaned;
    }

    // Group relations
    if let Some(is_orphaned) = untyped
        .as_relation(authz::Group::role())
        .map(|(_, group)| !entities.groups.contains(&group.0))
        .or_else(|| {
            let (member, group) = untyped.as_relation(authz::Group::member())?;
            let member_orphaned = match member {
                UserOrUserset::User(user) => !entities.users.contains(&user.0),
                UserOrUserset::Userset(userset) => is_userset_orphaned(&userset, entities),
            };
            Some(!entities.groups.contains(&group.0) || member_orphaned)
        })
    {
        return is_orphaned;
    }

    tracing::warn!(tuple = ?untyped, "OpenFGA GC: unrecognized relation, tuple kept for safety");
    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::create_empty_infra;
    use crate::fixtures::create_scenario_fixtures_set;
    use crate::fixtures::create_timetable;
    use editoast_models::stdcm_search_environment::StdcmSearchEnvironment;
    use editoast_models::stdcm_search_environment::fixtures::stdcm_search_env_fixtures;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_clean_orphaned_timetables() {
        let db_pool = Arc::new(DbConnectionPoolV2::for_tests());
        let conn = &mut db_pool.get_ok();

        // Timetable referenced by Scenario
        let scenario_set = create_scenario_fixtures_set(conn, "test_scenario").await;

        // Timetable referenced by StdcmSearchEnvironment
        let (infra, _timetable, work_schedule_group, temp_speed_limit_group, eps) =
            stdcm_search_env_fixtures(conn).await;
        let timetable_with_stdcm = create_timetable(conn).await;
        let _stdcm_env = StdcmSearchEnvironment::changeset()
            .infra_id(infra.id)
            .electrical_profile_set_id(Some(eps.id))
            .work_schedule_group_id(Some(work_schedule_group.id))
            .temporary_speed_limit_group_id(Some(temp_speed_limit_group.id))
            .timetable_id(timetable_with_stdcm.id)
            .search_window_begin(chrono::Utc::now())
            .search_window_end(chrono::Utc::now() + chrono::Duration::hours(1))
            .enabled_from(chrono::Utc::now())
            .enabled_until(chrono::Utc::now() + chrono::Duration::hours(1))
            .create(conn)
            .await
            .expect("Failed to create StdcmSearchEnvironment");

        // Orphaned timetables
        let orphaned1 = create_timetable(conn).await;
        let orphaned2 = create_timetable(conn).await;

        clean_orphaned_timetables(&db_pool).await.unwrap();

        for orphaned_id in &[orphaned1.id, orphaned2.id] {
            let found = Timetable::exists(conn, *orphaned_id).await.unwrap();
            assert!(!found, "Timetable should not exists anymore")
        }

        for kept_id in &[scenario_set.timetable.id, timetable_with_stdcm.id] {
            let found = Timetable::exists(conn, *kept_id).await.unwrap();
            assert!(found, "Timetable should exist")
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_clean_orphaned_train_schedule_sets() {
        let db_pool = Arc::new(DbConnectionPoolV2::for_tests());
        let conn = &mut db_pool.get_ok();

        // Train schedule set referenced by Scenario
        let scenario_set = create_scenario_fixtures_set(conn, "test_scenario").await;

        // Orphaned train schedule sets
        let orphaned1 = TrainScheduleSet::changeset()
            .name(Some("orphaned1".into()))
            .description("description1".into())
            .published(false)
            .create(conn)
            .await
            .expect("Failed to create orphaned train schedule set");
        let orphaned2 = TrainScheduleSet::changeset()
            .name(Some("orphaned2".into()))
            .description("description2".into())
            .published(false)
            .create(conn)
            .await
            .expect("Failed to create orphaned train schedule set");

        clean_orphaned_train_schedule_sets(&db_pool).await.unwrap();

        for orphaned_id in &[orphaned1.id, orphaned2.id] {
            let found = TrainScheduleSet::exists(conn, *orphaned_id).await.unwrap();
            assert!(!found, "Train schedule set should not exists anymore")
        }

        let found = TrainScheduleSet::exists(conn, scenario_set.train_schedule_set.id)
            .await
            .unwrap();
        assert!(found, "Train schedule set should exist")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_clean_orphaned_openfga_tuples() {
        use fga::model::Relation;

        // Setup FGA client with migrations
        let client = fga::test_client!("authz@");
        fga_migrations::run_migrations(
            client.clone(),
            fga::test_client!("migrations@"),
            fga_migrations::TargetMigration::Latest,
        )
        .await
        .expect("FGA migrations should succeed");

        // Create entities in DB
        let db_pool = Arc::new(DbConnectionPoolV2::for_tests());

        let (fga_infra, orphan_infra) = {
            let conn = &mut db_pool.get_ok();
            let existing = create_empty_infra(conn).await;
            let orphan = create_empty_infra(conn).await;
            (authz::Infra(existing.id), authz::Infra(orphan.id))
        };
        let existing_user = authz::User(
            editoast_models::User::register(
                db_pool.get_ok(),
                vec!["alice".to_owned()],
                "Alice".to_owned(),
            )
            .await
            .unwrap()
            .id,
        );
        let orphan_user = authz::User(
            editoast_models::User::register(
                db_pool.get_ok(),
                vec!["bob".to_owned()],
                "Bob".to_owned(),
            )
            .await
            .unwrap()
            .id,
        );
        let existing_group = authz::Group(
            Group::upsert(db_pool.get_ok(), "existing-group".into())
                .await
                .unwrap()
                .id,
        );
        let orphan_group = authz::Group(
            Group::upsert(db_pool.get_ok(), "orphan-group".into())
                .await
                .unwrap()
                .id,
        );

        // Write tuples: direct users + group usersets, on both the existing and orphan infra
        client
            .prepare_writes()
            .write(&authz::Infra::reader().tuple(&existing_user, &fga_infra))
            .write(&authz::Infra::reader().tuple(&orphan_user, &fga_infra))
            .write(
                &authz::Infra::reader()
                    .tuple(authz::Group::member().userset(&existing_group), &fga_infra),
            )
            .write(
                &authz::Infra::reader()
                    .tuple(authz::Group::member().userset(&orphan_group), &fga_infra),
            )
            .write(&authz::Infra::reader().tuple(&existing_user, &orphan_infra))
            .execute()
            .await
            .unwrap();

        // Delete orphan entities from DB
        {
            let conn = &mut db_pool.get_ok();
            editoast_models::authn::user::User::delete_static(conn, orphan_user.0)
                .await
                .unwrap();
            editoast_models::Group::delete_static(conn, orphan_group.0)
                .await
                .unwrap();
            Infra::delete_static(conn, orphan_infra.0).await.unwrap();
        }

        // Run GC — 2 orphaned by user/group deletion + 1 orphaned by infra deletion
        let deleted = delete_orphaned_tuples(&client, &db_pool).await.unwrap();
        assert_eq!(deleted, 3, "should delete exactly the 3 orphaned tuples");

        // Existing tuples should remain
        assert!(
            client
                .tuple_exists(authz::Infra::reader().tuple(&existing_user, &fga_infra))
                .await
                .unwrap(),
            "tuple for existing user should remain"
        );
        assert!(
            client
                .tuple_exists(
                    authz::Infra::reader()
                        .tuple(authz::Group::member().userset(&existing_group), &fga_infra,)
                )
                .await
                .unwrap(),
            "tuple for existing group should remain"
        );

        // Orphaned tuples should be gone
        assert!(
            !client
                .tuple_exists(authz::Infra::reader().tuple(&orphan_user, &fga_infra))
                .await
                .unwrap(),
            "tuple for deleted user should be removed"
        );
        assert!(
            !client
                .tuple_exists(
                    authz::Infra::reader()
                        .tuple(authz::Group::member().userset(&orphan_group), &fga_infra,)
                )
                .await
                .unwrap(),
            "tuple for deleted group should be removed"
        );
        assert!(
            !client
                .tuple_exists(authz::Infra::reader().tuple(&existing_user, &orphan_infra))
                .await
                .unwrap(),
            "tuple for deleted infra should be removed"
        );
    }
}
