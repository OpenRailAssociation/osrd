use clap::Args;
use clap::Subcommand;
use database::DbConnection;
use database::DbConnectionPoolV2;
use models::Infra;
use models::prelude::*;
use models::scenario::Scenario;
use models::search_journey_environment::SearchJourneyEnvironment;
use models::search_journey_environment::SearchJourneyEnvironmentWithTimetables;
use models::timetable::Timetable;
use std::collections::HashSet;

#[derive(Subcommand, Debug)]
pub enum SearchJourneyEnvCommands {
    SetFromScenario(SetSearchJourneyEnvFromScenarioArgs),
    SetFromScratch(SetSearchJourneyEnvFromScratchArgs),
    Show,
}

pub async fn handle_search_journey_env_command(
    command: SearchJourneyEnvCommands,
    db_pool: DbConnectionPoolV2,
) -> anyhow::Result<()> {
    let conn = &mut db_pool.get().await?;
    match command {
        SearchJourneyEnvCommands::SetFromScenario(args) => {
            set_search_journey_env_from_scenario(args, conn).await
        }
        SearchJourneyEnvCommands::SetFromScratch(args) => {
            set_search_journey_env_from_scratch(args, conn).await
        }
        SearchJourneyEnvCommands::Show => show_search_journey_env(conn).await,
    }
}

async fn check_exists<T>(
    conn: &mut DbConnection,
    object_id: i64,
    readable_name: &str,
) -> anyhow::Result<()>
where
    T: Exists<i64>,
    <T as Exists<i64>>::Error: Sync + 'static,
{
    if !T::exists(conn, object_id).await? {
        anyhow::bail!("{readable_name} not found, id: {object_id}");
    }
    Ok(())
}

#[derive(Args, Debug)]
#[command(
    about,
    long_about = "Set the current search journey env by copying data from a scenario"
)]
pub struct SetSearchJourneyEnvFromScenarioArgs {
    pub scenario_id: i64,
}

async fn set_search_journey_env_from_scenario(
    args: SetSearchJourneyEnvFromScenarioArgs,
    conn: &mut DbConnection,
) -> anyhow::Result<()> {
    let scenario = Scenario::retrieve_or_fail(conn.clone(), args.scenario_id, || {
        anyhow::anyhow!("Scenario not found, id: {}", args.scenario_id)
    })
    .await?;

    SearchJourneyEnvironment::create_with_timetables(
        scenario.infra_id,
        HashSet::from([scenario.timetable_id]),
        conn,
    )
    .await?;

    println!("✅ Search journey environment set up successfully");
    Ok(())
}

#[derive(Args, Debug)]
#[command(
    about,
    long_about = "Set the search journey env by specifying each attribute"
)]
pub struct SetSearchJourneyEnvFromScratchArgs {
    #[arg(long)]
    pub infra_id: i64,
    #[arg(long, num_args = 1.., value_delimiter = ' ')]
    pub timetable_ids: Vec<i64>,
}

async fn set_search_journey_env_from_scratch(
    args: SetSearchJourneyEnvFromScratchArgs,
    conn: &mut DbConnection,
) -> anyhow::Result<()> {
    check_exists::<Infra>(conn, args.infra_id, "Infra").await?;

    for timetable_id in &args.timetable_ids {
        check_exists::<Timetable>(conn, *timetable_id, "Timetable").await?;
    }

    SearchJourneyEnvironment::create_with_timetables(
        args.infra_id,
        args.timetable_ids.into_iter().collect(),
        conn,
    )
    .await?;

    println!("✅ Search journey environment set up successfully");
    Ok(())
}

async fn show_search_journey_env(conn: &mut DbConnection) -> anyhow::Result<()> {
    let env = SearchJourneyEnvironmentWithTimetables::retrieve_latest(conn).await?;
    if let Some(env) = env {
        println!("{env:#?}");
    } else {
        println!("🔎 No Search journey environment has been set up yet")
    };
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::create_scenario_fixtures_set;
    use database::DbConnectionPoolV2;
    use models::search_journey_environment::fixtures::search_journey_env_fixtures;
    use std::collections::HashSet;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_set_search_journey_env_from_scenario() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let scenario_fixture_set =
            create_scenario_fixtures_set(conn, "test_set_search_journey_env_from_scenario").await;

        let args = SetSearchJourneyEnvFromScenarioArgs {
            scenario_id: scenario_fixture_set.scenario.id,
        };

        let result = set_search_journey_env_from_scenario(args, conn).await;
        assert!(result.is_ok());

        let env = SearchJourneyEnvironmentWithTimetables::retrieve_latest(conn)
            .await
            .expect("Failed to retrieve latest search journey environment");
        assert!(env.is_some());
        let env = env.unwrap();

        assert_eq!(env.timetable_ids.len(), 1);
        assert_eq!(scenario_fixture_set.timetable.id, env.timetable_ids[0]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_set_search_journey_env_from_scratch() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let (infra, timetables) = search_journey_env_fixtures(conn).await;
        let timetable_ids: Vec<i64> = timetables.iter().map(|t| t.id).collect();

        let args = SetSearchJourneyEnvFromScratchArgs {
            infra_id: infra.id,
            timetable_ids: timetable_ids.clone(),
        };

        let result = set_search_journey_env_from_scratch(args, conn).await;
        assert!(result.is_ok());

        let env = SearchJourneyEnvironmentWithTimetables::retrieve_latest(conn)
            .await
            .expect("Failed to retrieve latest search journey environment");
        assert!(env.is_some());
        let env = env.unwrap();

        let expected: HashSet<i64> = timetable_ids.into_iter().collect();
        let actual: HashSet<i64> = env.timetable_ids.into_iter().collect();
        assert_eq!(actual, expected);
    }
}
