use crate::models::Infra;
use crate::models::Scenario;
use crate::models::stdcm_search_environment::OperationalPointIds;
use crate::models::stdcm_search_environment::StdcmSearchEnvironment;
use crate::models::timetable::Timetable;
use chrono::DateTime;
use chrono::Duration;
use chrono::Utc;
use clap::Args;
use clap::Subcommand;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_models::ElectricalProfileSet;
use editoast_models::WorkScheduleGroup;
use editoast_models::prelude::*;
use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;

#[derive(Subcommand, Debug)]
pub enum StdcmSearchEnvCommands {
    SetFromScenario(SetSTDCMSearchEnvFromScenarioArgs),
    SetFromScratch(SetSTDCMSearchEnvFromScratchArgs),
    Show,
}

pub async fn handle_stdcm_search_env_command(
    command: StdcmSearchEnvCommands,
    db_pool: DbConnectionPoolV2,
) -> anyhow::Result<()> {
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

fn parse_active_perimeter(
    file_path: Option<PathBuf>,
) -> anyhow::Result<Option<geos::geojson::Geometry>> {
    match file_path {
        None => Ok(None),
        Some(perimeter_path) => {
            let perimeter_file = File::open(perimeter_path)
                .map_err(|_| anyhow::anyhow!("Perimeter file must exist"))?;

            let geometry: Option<geos::geojson::Geometry> =
                serde_json::from_reader(BufReader::new(perimeter_file))
                    .map_err(|_| anyhow::anyhow!("Perimeter file can't be read"))?;

            Ok(geometry)
        }
    }
}

fn parse_speed_limit_tags(
    speed_limit_tags: Option<Vec<String>>,
) -> anyhow::Result<HashMap<String, i64>> {
    speed_limit_tags
        .unwrap_or_default()
        .iter()
        .map(|tag| match tag.split_once('|') {
            Some((key, value)) => {
                let speed_tag_name = key.to_string();
                let speed_tag_value = value.parse::<i64>().map_err(|_| {
                    anyhow::anyhow!("Failed to parse speed value as i64 in tag: {}", tag)
                })?;
                Ok((speed_tag_name, speed_tag_value))
            }
            None => anyhow::bail!("Can't parse speed limit tag, format is MA100|100: {}", tag),
        })
        .collect::<Result<HashMap<String, i64>, anyhow::Error>>()
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
    pub search_window_begin: Option<DateTime<Utc>>,
    /// If omitted, set to the latest train start time in the timetable plus one day
    #[arg(long)]
    pub search_window_end: Option<DateTime<Utc>>,
    /// List of operational points
    #[arg(long, num_args = 1.., value_delimiter = ' ')]
    pub operational_points: Option<Vec<i64>>,
    /// List of operational points uuid that are filtered in the result
    #[arg(long, num_args = 1.., value_delimiter = ' ')]
    pub operational_points_id_filtered: Option<Vec<String>>,
    /// List of speed limit tags defined by tag|speed. ex: `MA100|100`
    #[arg(long, num_args = 1.., value_delimiter = ' ')]
    pub speed_limit_tags: Option<Vec<String>>,
    #[arg(long)]
    pub default_speed_limit_tag: Option<String>,
    /// Path to the file that contains the geometry of the active perimeter
    pub active_perimeter_geojson_path: Option<PathBuf>,
}

async fn set_stdcm_search_env_from_scenario(
    args: SetSTDCMSearchEnvFromScenarioArgs,
    conn: &mut DbConnection,
) -> anyhow::Result<()> {
    if let Some(work_schedule_group_id) = args.work_schedule_group_id {
        check_exists::<WorkScheduleGroup>(conn, work_schedule_group_id, "Work Schedule Group")
            .await?;
    }

    let scenario = Scenario::retrieve_or_fail(conn.clone(), args.scenario_id, || {
        anyhow::anyhow!("Scenario not found, id: {}", args.scenario_id)
    })
    .await?;

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
        .enabled_from(Utc::now())
        .enabled_until(Utc::now() + Duration::days(1000))
        .active_perimeter(parse_active_perimeter(args.active_perimeter_geojson_path)?)
        .speed_limit_tags(parse_speed_limit_tags(args.speed_limit_tags)?)
        .default_speed_limit_tag(args.default_speed_limit_tag)
        .operational_points(args.operational_points.into())
        .operational_points_id_filtered(OperationalPointIds::new(
            args.operational_points_id_filtered.unwrap_or_default(),
        ))
        .create(conn)
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
    /// List of operational points
    #[arg(long, num_args = 1.., value_delimiter = ' ')]
    pub operational_points: Option<Vec<i64>>,
    /// List of operational points uuid that are filtered in the result
    #[arg(long, num_args = 1.., value_delimiter = ' ')]
    pub operational_points_id_filtered: Option<Vec<String>>,
    /// List of speed limit tags
    #[arg(long, num_args = 1.., value_delimiter = ' ')]
    pub speed_limit_tags: Option<Vec<String>>,
    #[arg(long)]
    pub default_speed_limit_tag: Option<String>,
    #[arg(long)]
    /// If omitted, set to the earliest train start time in the timetable
    #[arg(long)]
    pub search_window_begin: Option<DateTime<Utc>>,
    /// If omitted, set to the latest train start time in the timetable plus one day
    #[arg(long)]
    pub search_window_end: Option<DateTime<Utc>>,
    /// Path to the file that contains the geometry of the active perimeter
    pub active_perimeter_geojson_path: Option<PathBuf>,
}

async fn set_stdcm_search_env_from_scratch(
    args: SetSTDCMSearchEnvFromScratchArgs,
    conn: &mut DbConnection,
) -> anyhow::Result<()> {
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
        .enabled_from(Utc::now())
        .enabled_until(Utc::now() + Duration::days(1000))
        .operational_points(args.operational_points.into())
        .operational_points_id_filtered(OperationalPointIds::new(
            args.operational_points_id_filtered.unwrap_or_default(),
        ))
        .active_perimeter(parse_active_perimeter(args.active_perimeter_geojson_path)?)
        .speed_limit_tags(parse_speed_limit_tags(args.speed_limit_tags)?)
        .default_speed_limit_tag(args.default_speed_limit_tag)
        .create(conn)
        .await?;

    println!("✅ STDCM search environment set up successfully");
    Ok(())
}

async fn resolve_search_window(
    timetable_id: i64,
    search_window_begin: Option<DateTime<Utc>>,
    search_window_end: Option<DateTime<Utc>>,
    conn: &mut DbConnection,
) -> anyhow::Result<(DateTime<Utc>, DateTime<Utc>)> {
    let (begin, end) = if let (Some(begin), Some(end)) = (search_window_begin, search_window_end) {
        (begin, end)
    } else {
        let start_times = Timetable::gather_start_times(timetable_id, conn).await?;

        let (Some(min), Some(max)) = (start_times.iter().min(), start_times.iter().max()) else {
            let error_msg =
                "Timetable specified contains no train. Please fully specify search window.";
            anyhow::bail!("{error_msg}");
        };

        let begin = search_window_begin.unwrap_or(*min);
        let end = search_window_end.unwrap_or(*max + Duration::days(1));
        (begin, end)
    };

    if begin >= end {
        anyhow::bail!("Resolved window is empty: begin ({begin}) >= end ({end})");
    }

    Ok((begin, end))
}

async fn show_stdcm_search_env(conn: &mut DbConnection) -> anyhow::Result<()> {
    let search_env = StdcmSearchEnvironment::retrieve_latest_enabled(conn).await;
    if let Some(search_env) = search_env {
        println!("{search_env:#?}");

        let n_trains = Timetable::trains_count(search_env.timetable_id, conn).await?;
        println!("🚆 Number of trains in timetable: {n_trains}");
    } else {
        println!("🔎 No STDCM search environment has been set up yet")
    };
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::client::generate_temp_file;
    use crate::models::fixtures::create_electrical_profile_set;
    use crate::models::fixtures::create_empty_infra;
    use crate::models::fixtures::create_scenario_fixtures_set;
    use crate::models::fixtures::create_timetable;
    use crate::models::fixtures::create_work_schedule_group;
    use crate::models::fixtures::simple_train_schedule_changeset;
    use editoast_models::prelude::*;

    use super::*;
    use chrono::DateTime;
    use chrono::Utc;
    use database::DbConnection;
    use database::DbConnectionPoolV2;
    use geos::geojson::Geometry;
    use rstest::rstest;
    use serde_json::json;

    fn make_datetime(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().to_utc()
    }

    async fn create_train_schedules_from_start_times(
        start_times: Vec<DateTime<Utc>>,
        timetable_id: i64,
        conn: &mut DbConnection,
    ) {
        for start_time in start_times {
            simple_train_schedule_changeset(timetable_id)
                .start_time(start_time)
                .create(conn)
                .await
                .expect("Should be able to create train schedules");
        }
    }

    #[rstest]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case::both_none(
        None,
        None,
        make_datetime("2000-01-01 11:59:59Z"),
        make_datetime("2000-02-03 00:00:01Z")
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case::begin_none(
        None,
        Some(make_datetime("2000-02-01 00:00:00Z")),
        make_datetime("2000-01-01 11:59:59Z"),
        make_datetime("2000-02-01 00:00:00Z")
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case::end_none(
        Some(make_datetime("2000-02-01 08:00:00Z")),
        None,
        make_datetime("2000-02-01 08:00:00Z"),
        make_datetime("2000-02-03 00:00:01Z")
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case::both_some(
        Some(make_datetime("2000-02-01 08:00:00Z")),
        Some(make_datetime("2000-05-22 09:00:50Z")),
        make_datetime("2000-02-01 08:00:00Z"),
        make_datetime("2000-05-22 09:00:50Z")
    )]
    async fn test_resolve_search_window(
        #[case] search_window_begin: Option<DateTime<Utc>>,
        #[case] search_window_end: Option<DateTime<Utc>>,
        #[case] expected_begin: DateTime<Utc>,
        #[case] expected_end: DateTime<Utc>,
    ) {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let timetable = create_timetable(conn).await;

        let start_times = vec![
            make_datetime("2000-01-01 12:00:00Z"),
            make_datetime("2000-02-02 00:00:00Z"),
            make_datetime("2000-01-01 11:59:59Z"), // earliest
            make_datetime("2000-01-15 08:59:59Z"),
            make_datetime("2000-02-02 00:00:01Z"), // latest
            make_datetime("2000-01-19 17:00:00Z"),
        ];

        create_train_schedules_from_start_times(start_times, timetable.id, conn).await;

        let (begin, end) =
            resolve_search_window(timetable.id, search_window_begin, search_window_end, conn)
                .await
                .unwrap();

        assert_eq!(begin, expected_begin);
        assert_eq!(end, expected_end);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn fail_resolve_search_window_on_empty_timetable() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let timetable = create_timetable(conn).await;

        assert!(
            resolve_search_window(timetable.id, None, None, conn)
                .await
                .is_err()
        );
    }

    #[rstest]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case::both_some(
        Some(make_datetime("2000-02-01 08:00:00Z")),
        Some(make_datetime("2000-02-01 00:00:00Z"))
    )]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case::end_none(Some(make_datetime("2000-03-01 00:00:00Z")), None)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case::begin_none(None, Some(make_datetime("2000-01-01 08:00:00Z")))]
    async fn test_resolve_search_window_incompatible_dates(
        #[case] search_window_begin: Option<DateTime<Utc>>,
        #[case] search_window_end: Option<DateTime<Utc>>,
    ) {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let timetable = create_timetable(conn).await;

        let start_times = vec![
            make_datetime("2000-01-01 12:00:00Z"),
            make_datetime("2000-02-02 00:00:01Z"),
        ];

        create_train_schedules_from_start_times(start_times, timetable.id, conn).await;

        assert!(
            resolve_search_window(timetable.id, search_window_begin, search_window_end, conn)
                .await
                .is_err()
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_stdcm_set_search_env_from_scenario_with_perimeter() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let scenario_fixture_set =
            create_scenario_fixtures_set(conn, "test_stdcm_set_search_env_from_scenario").await;

        let work_schedule_group = create_work_schedule_group(conn).await;

        let start_times = vec![
            make_datetime("2000-01-01 12:00:00Z"),
            make_datetime("2000-02-02 08:00:00Z"),
        ];

        create_train_schedules_from_start_times(
            start_times,
            scenario_fixture_set.timetable.id,
            conn,
        )
        .await;

        let perimeter_json = json!({
            "type": "Polygon",
            "coordinates": [[
                [-1, 47 ],
                [ -2, 47 ],
                [ -2, 48 ],
                [ -1, 47 ]
            ]]
        });
        let perimeter: Geometry =
            serde_json::from_value(perimeter_json).expect("Failed to parse geometry");
        let perimeter_file = generate_temp_file(&perimeter);

        let operational_points = Vec::from([1, 2, 3, 4]);
        let operational_points_id_filtered =
            Vec::from(["uuid-1".to_string(), "uuid-2".to_string()]);
        let speed_limit_tags = Vec::from(["MA80|80".to_string(), "MA90|90".to_string()]);
        let default_speed_limit_tag = "MA90".to_string();

        let args = SetSTDCMSearchEnvFromScenarioArgs {
            scenario_id: scenario_fixture_set.scenario.id,
            work_schedule_group_id: Some(work_schedule_group.id),
            search_window_begin: None,
            search_window_end: None,
            operational_points: Some(operational_points.clone()),
            operational_points_id_filtered: Some(operational_points_id_filtered.clone()),
            speed_limit_tags: Some(speed_limit_tags),
            default_speed_limit_tag: Some(default_speed_limit_tag.clone()),
            active_perimeter_geojson_path: Some(perimeter_file.path().into()),
        };

        let result = set_stdcm_search_env_from_scenario(args, conn).await;
        assert!(result.is_ok());

        let search_env = StdcmSearchEnvironment::retrieve_latest_enabled(conn).await;

        assert!(search_env.is_some());
        let search_env = search_env.unwrap();

        assert_eq!(
            search_env.search_window_begin,
            make_datetime("2000-01-01 12:00:00Z")
        );
        assert_eq!(
            search_env.search_window_end,
            make_datetime("2000-02-03 08:00:00Z")
        );

        assert_eq!(search_env.active_perimeter, Some(perimeter));
        assert_eq!(search_env.operational_points.to_vec(), operational_points);
        assert_eq!(
            search_env.operational_points_id_filtered.to_vec(),
            operational_points_id_filtered
        );
        assert_eq!(
            search_env.speed_limit_tags,
            vec![("MA80".to_string(), 80), ("MA90".to_string(), 90),]
                .into_iter()
                .collect::<HashMap<String, i64>>()
        );
        assert_eq!(
            search_env.default_speed_limit_tag,
            Some(default_speed_limit_tag)
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_set_stdcm_search_env_from_scratch() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let conn = &mut db_pool.get_ok();

        let timetable = create_timetable(conn).await;
        let infra = create_empty_infra(conn).await;
        let work_schedule_group = create_work_schedule_group(conn).await;
        let electrical_profile_set = create_electrical_profile_set(conn).await;

        let start_times = vec![
            make_datetime("2000-01-01 12:00:00Z"),
            make_datetime("2000-02-02 08:00:00Z"),
        ];

        create_train_schedules_from_start_times(start_times, timetable.id, conn).await;
        let operational_points = Vec::from([1, 2, 3, 4]);
        let operational_points_id_filtered =
            Vec::from(["uuid-1".to_string(), "uuid-2".to_string()]);
        let speed_limit_tags = Vec::from(["MA80|80".to_string(), "MA90|90".to_string()]);
        let default_speed_limit_tag = "MA90".to_string();

        let args = SetSTDCMSearchEnvFromScratchArgs {
            infra_id: infra.id,
            electrical_profile_set_id: Some(electrical_profile_set.id),
            work_schedule_group_id: Some(work_schedule_group.id),
            timetable_id: timetable.id,
            search_window_begin: None,
            search_window_end: None,
            operational_points: Some(operational_points.clone()),
            operational_points_id_filtered: Some(operational_points_id_filtered.clone()),
            speed_limit_tags: Some(speed_limit_tags),
            default_speed_limit_tag: Some(default_speed_limit_tag.clone()),
            active_perimeter_geojson_path: None,
        };

        let result = set_stdcm_search_env_from_scratch(args, conn).await;
        assert!(result.is_ok());

        let search_env = StdcmSearchEnvironment::retrieve_latest_enabled(conn).await;

        assert!(search_env.is_some());
        let search_env = search_env.unwrap();

        assert_eq!(
            search_env.search_window_begin,
            make_datetime("2000-01-01 12:00:00Z")
        );
        assert_eq!(
            search_env.search_window_end,
            make_datetime("2000-02-03 08:00:00Z")
        );

        assert_eq!(search_env.operational_points.to_vec(), operational_points);
        assert_eq!(
            search_env.operational_points_id_filtered.to_vec(),
            operational_points_id_filtered
        );
        assert_eq!(
            search_env.speed_limit_tags,
            vec![("MA80".to_string(), 80), ("MA90".to_string(), 90),]
                .into_iter()
                .collect::<HashMap<String, i64>>()
        );
        assert_eq!(
            search_env.default_speed_limit_tag,
            Some(default_speed_limit_tag)
        );
    }
}
