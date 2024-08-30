use crate::models::electrical_profiles::ElectricalProfileSet;
use crate::models::stdcm_search_environment::StdcmSearchEnvironment;
use crate::models::timetable::Timetable;
use crate::models::work_schedules::WorkScheduleGroup;
use crate::models::Infra;
use crate::models::Scenario;
use crate::CliError;
use crate::Exists;
use crate::Model;
use crate::Retrieve;
use chrono::Duration;
use chrono::NaiveDateTime;
use clap::Args;
use clap::Subcommand;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPoolV2;
use std::error::Error;

#[derive(Subcommand, Debug)]
pub enum StdcmSearchEnvCommands {
    SetFromScenario(SetSTDCMSearchEnvFromScenarioArgs),
    SetFromScratch(SetSTDCMSearchEnvFromScratchArgs),
    Show,
}

pub async fn handle_stdcm_search_env_command(
    command: StdcmSearchEnvCommands,
    db_pool: DbConnectionPoolV2,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let conn = &mut db_pool.get().await?;
    match command {
        StdcmSearchEnvCommands::SetFromScenario(args) => {
            set_stdcm_search_env_from_scenario(args, conn).await
        }
        StdcmSearchEnvCommands::SetFromScratch(args) => {
            set_stdcm_search_env_from_scratch(args, conn).await
        }
        StdcmSearchEnvCommands::Show => show_stdcm_search_env(conn).await,
    }
}

async fn check_exists<T: Exists<i64>>(
    conn: &mut DbConnection,
    object_id: i64,
    readable_name: &str,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    if !T::exists(conn, object_id).await? {
        let err_msg = format!("❌ {0} not found, id: {1}", readable_name, object_id);
        return Err(Box::new(CliError::new(1, err_msg)));
    }
    Ok(())
}

#[derive(Args, Debug)]
#[command(
    about,
    long_about = "Set the current STDCM search env by copying most data from a scenario"
)]
pub struct SetSTDCMSearchEnvFromScenarioArgs {
    pub scenario_id: i64,
    #[arg(long)]
    pub work_schedule_group_id: Option<i64>,
    /// If omitted, set to the earliest train start time in the timetable
    #[arg(long)]
    pub search_window_begin: Option<NaiveDateTime>,
    /// If omitted, set to the latest train start time in the timetable plus one day
    #[arg(long)]
    pub search_window_end: Option<NaiveDateTime>,
}

async fn set_stdcm_search_env_from_scenario(
    args: SetSTDCMSearchEnvFromScenarioArgs,
    conn: &mut DbConnection,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    if let Some(work_schedule_group_id) = args.work_schedule_group_id {
        check_exists::<WorkScheduleGroup>(conn, work_schedule_group_id, "Work Schedule Group")
            .await?;
    }

    let scenario_option = Scenario::retrieve(conn, args.scenario_id).await?;

    let scenario = scenario_option.ok_or_else(|| {
        let error = CliError::new(
            1,
            format!("❌ Scenario not found, id: {0}", args.scenario_id),
        );
        Box::new(error)
    })?;

    let (begin, end) = resolve_search_window(
        scenario.timetable_id,
        args.search_window_begin,
        args.search_window_end,
        conn,
    )
    .await?;

    StdcmSearchEnvironment::changeset()
        .infra_id(scenario.infra_id)
        .electrical_profile_set_id(scenario.electrical_profile_set_id)
        .work_schedule_group_id(args.work_schedule_group_id)
        .timetable_id(scenario.timetable_id)
        .search_window_begin(begin)
        .search_window_end(end)
        .overwrite(conn)
        .await?;

    println!("✅ STDCM search environment set up successfully");
    Ok(())
}

#[derive(Args, Debug)]
#[command(
    about,
    long_about = "Set the current STDCM search env by specifying each attribute"
)]
pub struct SetSTDCMSearchEnvFromScratchArgs {
    #[arg(long)]
    pub infra_id: i64,
    #[arg(long)]
    pub electrical_profile_set_id: Option<i64>,
    #[arg(long)]
    pub work_schedule_group_id: Option<i64>,
    #[arg(long)]
    pub timetable_id: i64,
    #[arg(long)]
    /// If omitted, set to the earliest train start time in the timetable
    #[arg(long)]
    pub search_window_begin: Option<NaiveDateTime>,
    /// If omitted, set to the latest train start time in the timetable plus one day
    #[arg(long)]
    pub search_window_end: Option<NaiveDateTime>,
}

async fn set_stdcm_search_env_from_scratch(
    args: SetSTDCMSearchEnvFromScratchArgs,
    conn: &mut DbConnection,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    check_exists::<Timetable>(conn, args.timetable_id, "Timetable").await?;

    check_exists::<Infra>(conn, args.infra_id, "Infra").await?;

    if let Some(electrical_profile_set_id) = args.electrical_profile_set_id {
        check_exists::<ElectricalProfileSet>(
            conn,
            electrical_profile_set_id,
            "Electrical Profile Set",
        )
        .await?;
    }

    if let Some(work_schedule_group_id) = args.work_schedule_group_id {
        check_exists::<WorkScheduleGroup>(conn, work_schedule_group_id, "Work Schedule Group")
            .await?;
    }

    let (begin, end) = resolve_search_window(
        args.timetable_id,
        args.search_window_begin,
        args.search_window_end,
        conn,
    )
    .await?;

    StdcmSearchEnvironment::changeset()
        .infra_id(args.infra_id)
        .electrical_profile_set_id(args.electrical_profile_set_id)
        .work_schedule_group_id(args.work_schedule_group_id)
        .timetable_id(args.timetable_id)
        .search_window_begin(begin)
        .search_window_end(end)
        .overwrite(conn)
        .await?;

    println!("✅ STDCM search environment set up successfully");
    Ok(())
}

async fn resolve_search_window(
    timetable_id: i64,
    search_window_begin: Option<NaiveDateTime>,
    search_window_end: Option<NaiveDateTime>,
    conn: &mut DbConnection,
) -> Result<(NaiveDateTime, NaiveDateTime), Box<dyn Error + Send + Sync>> {
    let (begin, end) = if let (Some(begin), Some(end)) = (search_window_begin, search_window_end) {
        (begin, end)
    } else {
        let start_times = Timetable::gather_start_times(timetable_id, conn).await?;

        let (Some(min), Some(max)) = (start_times.iter().min(), start_times.iter().max()) else {
            let error_msg =
                "❌ Timetable specified contains no train. Please fully specify search window.";
            return Err(Box::new(CliError::new(1, error_msg)));
        };

        let begin = search_window_begin.unwrap_or(min.naive_utc());
        let end = search_window_end.unwrap_or(max.naive_utc() + Duration::days(1));
        (begin, end)
    };

    if begin >= end {
        let error_msg = format!(
            "❌ Resolved window is empty: begin ({0}) >= end ({1})",
            begin, end
        );
        return Err(Box::new(CliError::new(1, error_msg)));
    }

    Ok((begin, end))
}

async fn show_stdcm_search_env(
    conn: &mut DbConnection,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let search_env = StdcmSearchEnvironment::retrieve_latest(conn).await;
    if let Some(search_env) = search_env {
        println!("{search_env:#?}");

        let n_trains = Timetable::trains_count(search_env.timetable_id, conn).await?;
        println!("🚆 Number of trains in timetable: {0}", n_trains);
    } else {
        println!("🔎 No STDCM search environment has been set up yet")
    };
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::{
        models::{
            fixtures::{
                create_electrical_profile_set, create_empty_infra, create_scenario_fixtures_set,
                create_timetable, create_work_schedule_group, simple_train_schedule_form,
            },
            train_schedule::TrainSchedule,
            Changeset,
        },
        Create,
    };

    use super::*;
    use chrono::NaiveDateTime;
    use editoast_models::{DbConnection, DbConnectionPoolV2};
    use rstest::rstest;

    fn make_naive_datetime(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").unwrap()
    }

    async fn create_train_schedules_from_start_times(
        start_times: Vec<NaiveDateTime>,
        timetable_id: i64,
        conn: &mut DbConnection,
    ) {
        for start_time in start_times {
            let train_schedule_changeset: Changeset<TrainSchedule> =
                simple_train_schedule_form(timetable_id).into();
            train_schedule_changeset
                .start_time(start_time.and_utc())
                .create(conn)
                .await
                .expect("Should be able to create train schedules");
        }
    }

    #[rstest]
    #[case::both_none(
        None,
        None,
        make_naive_datetime("2000-01-01 11:59:59"),
        make_naive_datetime("2000-02-03 00:00:01")
    )]
    #[case::begin_none(
        None,
        Some(make_naive_datetime("2000-02-01 00:00:00")),
        make_naive_datetime("2000-01-01 11:59:59"),
        make_naive_datetime("2000-02-01 00:00:00")
    )]
    #[case::end_none(
        Some(make_naive_datetime("2000-02-01 08:00:00")),
        None,
        make_naive_datetime("2000-02-01 08:00:00"),
        make_naive_datetime("2000-02-03 00:00:01")
    )]
    #[case::both_some(
        Some(make_naive_datetime("2000-02-01 08:00:00")),
        Some(make_naive_datetime("2000-05-22 09:00:50")),
        make_naive_datetime("2000-02-01 08:00:00"),
        make_naive_datetime("2000-05-22 09:00:50")
    )]
    async fn test_resolve_search_window(
        #[case] search_window_begin: Option<NaiveDateTime>,
        #[case] search_window_end: Option<NaiveDateTime>,
        #[case] expected_begin: NaiveDateTime,
        #[case] expected_end: NaiveDateTime,
    ) {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let timetable = create_timetable(conn).await;

        let start_times = vec![
            make_naive_datetime("2000-01-01 12:00:00"),
            make_naive_datetime("2000-02-02 00:00:00"),
            make_naive_datetime("2000-01-01 11:59:59"), // earliest
            make_naive_datetime("2000-01-15 08:59:59"),
            make_naive_datetime("2000-02-02 00:00:01"), // latest
            make_naive_datetime("2000-01-19 17:00:00"),
        ];

        create_train_schedules_from_start_times(start_times, timetable.id, conn).await;

        let (begin, end) =
            resolve_search_window(timetable.id, search_window_begin, search_window_end, conn)
                .await
                .unwrap();

        assert_eq!(begin, expected_begin);
        assert_eq!(end, expected_end);
    }

    #[rstest]
    async fn fail_resolve_search_window_on_empty_timetable() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let timetable = create_timetable(conn).await;

        assert!(resolve_search_window(timetable.id, None, None, conn)
            .await
            .is_err());
    }

    #[rstest]
    #[case::both_some(
        Some(make_naive_datetime("2000-02-01 08:00:00")),
        Some(make_naive_datetime("2000-02-01 00:00:00"))
    )]
    #[case::end_none(Some(make_naive_datetime("2000-03-01 00:00:00")), None)]
    #[case::begin_none(None, Some(make_naive_datetime("2000-01-01 08:00:00")))]
    async fn test_resolve_search_window_incompatible_dates(
        #[case] search_window_begin: Option<NaiveDateTime>,
        #[case] search_window_end: Option<NaiveDateTime>,
    ) {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let timetable = create_timetable(conn).await;

        let start_times = vec![
            make_naive_datetime("2000-01-01 12:00:00"),
            make_naive_datetime("2000-02-02 00:00:01"),
        ];

        create_train_schedules_from_start_times(start_times, timetable.id, conn).await;

        assert!(
            resolve_search_window(timetable.id, search_window_begin, search_window_end, conn)
                .await
                .is_err()
        );
    }

    #[rstest]
    async fn test_stdcm_set_search_env_from_scenario() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let scenario_fixture_set =
            create_scenario_fixtures_set(conn, "test_stdcm_set_search_env_from_scenario").await;

        let work_schedule_group = create_work_schedule_group(conn).await;

        let start_times = vec![
            make_naive_datetime("2000-01-01 12:00:00"),
            make_naive_datetime("2000-02-02 08:00:00"),
        ];

        create_train_schedules_from_start_times(
            start_times,
            scenario_fixture_set.timetable.id,
            conn,
        )
        .await;

        let args = SetSTDCMSearchEnvFromScenarioArgs {
            scenario_id: scenario_fixture_set.scenario.id,
            work_schedule_group_id: Some(work_schedule_group.id),
            search_window_begin: None,
            search_window_end: None,
        };

        let result = set_stdcm_search_env_from_scenario(args, conn).await;
        assert!(result.is_ok());

        let search_env = StdcmSearchEnvironment::retrieve_latest(conn).await;

        assert!(search_env.is_some());
        let search_env = search_env.unwrap();

        assert_eq!(
            search_env.search_window_begin,
            make_naive_datetime("2000-01-01 12:00:00")
        );
        assert_eq!(
            search_env.search_window_end,
            make_naive_datetime("2000-02-03 08:00:00")
        );
    }

    #[rstest]
    async fn test_set_stdcm_search_env_from_scratch() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let timetable = create_timetable(conn).await;
        let infra = create_empty_infra(conn).await;
        let work_schedule_group = create_work_schedule_group(conn).await;
        let electrical_profile_set = create_electrical_profile_set(conn).await;

        let start_times = vec![
            make_naive_datetime("2000-01-01 12:00:00"),
            make_naive_datetime("2000-02-02 08:00:00"),
        ];

        create_train_schedules_from_start_times(start_times, timetable.id, conn).await;

        let args = SetSTDCMSearchEnvFromScratchArgs {
            infra_id: infra.id,
            electrical_profile_set_id: Some(electrical_profile_set.id),
            work_schedule_group_id: Some(work_schedule_group.id),
            timetable_id: timetable.id,
            search_window_begin: None,
            search_window_end: None,
        };

        let result = set_stdcm_search_env_from_scratch(args, conn).await;
        assert!(result.is_ok());

        let search_env = StdcmSearchEnvironment::retrieve_latest(conn).await;

        assert!(search_env.is_some());
        let search_env = search_env.unwrap();

        assert_eq!(
            search_env.search_window_begin,
            make_naive_datetime("2000-01-01 12:00:00")
        );
        assert_eq!(
            search_env.search_window_end,
            make_naive_datetime("2000-02-03 08:00:00")
        );
    }
}
