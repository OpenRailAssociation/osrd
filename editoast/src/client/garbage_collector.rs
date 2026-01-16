use database::DbConnectionPoolV2;
use editoast_models::timetable::Timetable;
use std::sync::Arc;

use crate::models::train_schedule_set::TrainScheduleSet;

pub async fn run_garbage_collector(db_pool: Arc<DbConnectionPoolV2>) -> anyhow::Result<()> {
    clean_orphaned_timetables(&db_pool).await?;
    clean_orphaned_train_schedule_sets(&db_pool).await?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::fixtures::create_scenario_fixtures_set;
    use crate::models::fixtures::create_timetable;
    use crate::models::stdcm_search_environment::StdcmSearchEnvironment;
    use crate::models::stdcm_search_environment::tests::stdcm_search_env_fixtures;
    use editoast_models::prelude::*;

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
}
