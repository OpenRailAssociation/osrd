use std::str::FromStr;

use chrono::DateTime;
use chrono::Utc;
use database::DbConnection;

use editoast_models::CatalogEntry;
use editoast_models::ElectricalProfileSet;
use editoast_models::SubCategory;
use editoast_models::WorkSchedule;
use editoast_models::WorkScheduleGroup;
use editoast_models::prelude::*;
use editoast_models::project::Project;
use editoast_models::rolling_stock::RollingStock;
use editoast_models::scenario::Scenario;
use editoast_models::study::Study;
use editoast_models::tags::Tags;
use editoast_models::timetable::Timetable;
use editoast_models::timetable_train_schedule_set::TimetableTrainScheduleSet;
use editoast_models::train_schedule_exception::TrainScheduleException;
use schemas::TrainScheduleExceptionChangeGroups;
use schemas::infra::InfraObject;
use schemas::infra::TrackOffset;
use schemas::paced_train::ConstraintDistributionChangeGroup;
use schemas::paced_train::ExceptionType;
use schemas::paced_train::InitialSpeedChangeGroup;
use schemas::paced_train::LabelsChangeGroup;
use schemas::paced_train::OptionsChangeGroup;
use schemas::paced_train::PacedTrainException;
use schemas::paced_train::PathAndScheduleChangeGroup;
use schemas::paced_train::RollingStockCategoryChangeGroup;
use schemas::paced_train::RollingStockChangeGroup;
use schemas::paced_train::SpeedLimitTagChangeGroup;
use schemas::paced_train::StartTimeChangeGroup;
use schemas::paced_train::TrainNameChangeGroup;
use schemas::primitives::Identifier;
use schemas::primitives::NonBlankString;
use schemas::primitives::OSRDObject;
use schemas::rolling_stock::SubCategoryColor;
use schemas::train_schedule::Comfort;
use schemas::train_schedule::Distribution;
use schemas::train_schedule::MarginValue;
use schemas::train_schedule::Margins;
use schemas::train_schedule::OperationalPointPartReference;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItem;
use schemas::train_schedule::PathItemLocation;
use schemas::train_schedule::ScheduleItem;
use schemas::train_schedule::TrainScheduleOptions;

use crate::infra_cache::operation::create::apply_create_operation;
use editoast_models::Infra;
use editoast_models::TrainScheduleSet;

pub async fn create_project(conn: &mut DbConnection, name: &str) -> Project {
    Project::fake(name)
        .create(conn)
        .await
        .expect("Failed to create project")
}

pub async fn create_study(conn: &mut DbConnection, name: &str, project_id: i64) -> Study {
    Study::fake(name, project_id)
        .create(conn)
        .await
        .expect("Failed to create study")
}

/// Returns a tuple of (timetable_id, train_schedule_set_id)
pub async fn create_timetable_with_train_schedule_set(
    conn: &mut DbConnection,
) -> (Timetable, TrainScheduleSet) {
    let timetable = create_timetable(conn).await;
    let train_schedule_set = create_train_schedule_set(conn).await;
    let _ = link_train_schedule_set_to_timetable(conn, train_schedule_set.id, timetable.id).await;
    (timetable, train_schedule_set)
}

pub async fn create_timetable_with_simple_paced_train(
    conn: &mut DbConnection,
) -> (Timetable, editoast_models::TrainSchedule) {
    let (timetable, train_schedule_set) = create_timetable_with_train_schedule_set(conn).await;
    let train_schedule = create_simple_paced_train(conn, train_schedule_set.id).await;

    (timetable, train_schedule)
}

pub async fn create_timetable(conn: &mut DbConnection) -> Timetable {
    Timetable::changeset()
        .create(conn)
        .await
        .expect("Failed to create timetable")
}

pub async fn create_train_schedule_set(conn: &mut DbConnection) -> TrainScheduleSet {
    TrainScheduleSet::changeset()
        .name(None)
        .create(conn)
        .await
        .expect("Failed to create train schedule set")
}

pub async fn create_catalog_entry_with_name(conn: &mut DbConnection, name: &str) -> CatalogEntry {
    CatalogEntry::changeset()
        .name(Some(name.into()))
        .create(conn)
        .await
        .expect("Failed to create catalog entry")
}

pub async fn create_catalog_entry(conn: &mut DbConnection) -> CatalogEntry {
    create_catalog_entry_with_name(conn, "test").await
}

async fn link_train_schedule_set_to_timetable(
    conn: &mut DbConnection,
    train_schedule_set_id: i64,
    timetable_id: i64,
) -> TimetableTrainScheduleSet {
    TimetableTrainScheduleSet::changeset()
        .train_schedule_set_id(train_schedule_set_id)
        .timetable_id(timetable_id)
        .create(conn)
        .await
        .expect("Failed to link train schedule set to timetable")
}

pub fn create_created_exception_with_change_groups(key: &str) -> PacedTrainException {
    PacedTrainException {
        key: key.into(),
        exception_type: ExceptionType::Created {},
        disabled: false,
        change_groups: TrainScheduleExceptionChangeGroups {
            train_name: Some(TrainNameChangeGroup {
                value: "created_exception_train_name".into(),
            }),
            constraint_distribution: Some(ConstraintDistributionChangeGroup {
                value: Distribution::Mareco,
            }),
            initial_speed: Some(InitialSpeedChangeGroup { value: 10.0 }),
            labels: Some(LabelsChangeGroup {
                value: vec!["Label 1".to_string(), "Label 3".to_string()],
            }),
            options: Some(OptionsChangeGroup {
                value: TrainScheduleOptions::default(),
            }),
            path_and_schedule: Some(PathAndScheduleChangeGroup {
                power_restrictions: vec![],
                schedule: vec![
                    ScheduleItem {
                        at: NonBlankString("aa".to_string()),
                        ..Default::default()
                    },
                    ScheduleItem {
                        at: NonBlankString("bb".to_string()),
                        ..Default::default()
                    },
                    ScheduleItem {
                        at: NonBlankString("cc".to_string()),
                        ..Default::default()
                    },
                    ScheduleItem {
                        at: NonBlankString("dd".to_string()),
                        ..Default::default()
                    },
                ],
                path: vec![
                    PathItem {
                        id: "aa".into(),
                        location: PathItemLocation::TrackOffset(TrackOffset {
                            offset: 300,
                            track: Identifier("TC0".to_string()),
                        }),
                    },
                    PathItem {
                        id: "bb".into(),
                        location: PathItemLocation::OperationalPointPartReference(
                            OperationalPointPartReference {
                                operational_point: OperationalPointReference::Id {
                                    operational_point: Identifier("Mid_East_station".to_string()),
                                },
                                local_track_name: None,
                            },
                        ),
                    },
                    PathItem {
                        id: "cc".into(),
                        location: PathItemLocation::TrackOffset(TrackOffset {
                            offset: 300,
                            track: Identifier("TC1".to_string()),
                        }),
                    },
                    PathItem {
                        id: "dd".into(),
                        location: PathItemLocation::TrackOffset(TrackOffset {
                            offset: 300,
                            track: Identifier("TC2".to_string()),
                        }),
                    },
                ],
                margins: Margins {
                    boundaries: vec![],
                    values: vec![MarginValue::Percentage(5.0)],
                },
            }),
            rolling_stock: Some(RollingStockChangeGroup {
                rolling_stock_name: "simulation_rolling_stock".into(),
                comfort: Comfort::AirConditioning,
            }),
            rolling_stock_category: Some(RollingStockCategoryChangeGroup { value: None }),
            speed_limit_tag: Some(SpeedLimitTagChangeGroup {
                value: Some(NonBlankString("GB".into())),
            }),
            start_time: Some(StartTimeChangeGroup {
                value: DateTime::<Utc>::from_str("2025-05-15T15:10:00+02:00").unwrap(),
            }),
        },
    }
}

pub fn simple_paced_train_base() -> schemas::paced_train::TrainSchedule {
    schemas::paced_train::TrainSchedule {
        train_occurrence: schemas::TrainOccurrence::fake(),
        paced: Some(schemas::paced_train::Paced {
            time_window: chrono::Duration::hours(2).try_into().unwrap(),
            interval: chrono::Duration::minutes(15).try_into().unwrap(),
            exceptions: vec![
                schemas::fixtures::simple_created_exception_with_change_groups("exception_key_1"),
                schemas::fixtures::simple_modified_exception_with_change_groups(
                    "exception_key_2",
                    0,
                ),
            ],
        }),
    }
}

pub fn simple_paced_train_changeset(
    train_schedule_set_id: i64,
) -> Changeset<editoast_models::TrainSchedule> {
    Changeset::<editoast_models::TrainSchedule>::from(simple_paced_train_base())
        .train_schedule_set_id(train_schedule_set_id)
}

pub async fn create_simple_paced_train(
    conn: &mut DbConnection,
    train_schedule_set_id: i64,
) -> editoast_models::TrainSchedule {
    simple_paced_train_changeset(train_schedule_set_id)
        .create(conn)
        .await
        .expect("Failed to create paced train")
}

pub async fn create_paced_train_with_exceptions(
    conn: &mut DbConnection,
    train_schedule_set_id: i64,
    exceptions: Vec<PacedTrainException>,
) -> editoast_models::TrainSchedule {
    let paced_train = simple_paced_train_changeset(train_schedule_set_id).exceptions(exceptions);
    paced_train
        .create(conn)
        .await
        .expect("Failed to create paced train")
}

pub async fn create_train_schedule_exception(
    conn: &mut DbConnection,
    timetable_id: i64,
    train_schedule_id: i64,
    occurrence_index: Option<i64>,
) -> TrainScheduleException {
    TrainScheduleException::changeset()
        .timetable_id(timetable_id)
        .train_schedule_id(train_schedule_id)
        .occurrence_index(occurrence_index)
        .disabled(false)
        .change_groups(TrainScheduleExceptionChangeGroups {
            train_name: Some(TrainNameChangeGroup {
                value: "Name".into(),
            }),
            ..Default::default()
        })
        .create(conn)
        .await
        .expect("Failed to create exception")
}

pub fn scenario_changeset(
    name: &str,
    study_id: i64,
    timetable_id: i64,
    infra_id: i64,
) -> Changeset<Scenario> {
    Scenario::changeset()
        .name(name.to_string())
        .description("test_scenario description".to_string())
        .creation_date(Utc::now())
        .last_modification(Utc::now())
        .tags(Tags::default())
        .timetable_id(timetable_id)
        .study_id(study_id)
        .infra_id(infra_id)
}

pub async fn create_scenario(
    conn: &mut DbConnection,
    name: &str,
    study_id: i64,
    timetable_id: i64,
    infra_id: i64,
) -> Scenario {
    let scenario = scenario_changeset(name, study_id, timetable_id, infra_id);
    scenario
        .create(conn)
        .await
        .expect("Failed to create scenario")
}

pub struct ScenarioFixtureSet {
    pub scenario: Scenario,
    pub timetable: Timetable,
    pub infra: Infra,
    pub train_schedule_set: TrainScheduleSet,
}

pub async fn create_scenario_fixtures_set(
    conn: &mut DbConnection,
    name: &str,
) -> ScenarioFixtureSet {
    let infra = create_empty_infra(conn).await;
    let (timetable, train_schedule_set) = create_timetable_with_train_schedule_set(conn).await;
    let project = create_project(conn, &format!("project_test_name_with_{name}")).await;
    let study = create_study(conn, &format!("study_test_name_with_{name}"), project.id).await;
    let scenario = create_scenario(conn, name, study.id, timetable.id, infra.id).await;
    ScenarioFixtureSet {
        scenario,
        timetable,
        infra,
        train_schedule_set,
    }
}

pub async fn create_fast_rolling_stock(conn: &mut DbConnection, name: &str) -> RollingStock {
    Changeset::<RollingStock>::from(schemas::fixtures::fast_rolling_stock())
        .name(name.to_string())
        .locked(false)
        .version(0)
        .create(conn)
        .await
        .expect("Failed to create rolling stock")
}

pub async fn create_rolling_stock_with_energy_sources(
    conn: &mut DbConnection,
    name: &str,
) -> RollingStock {
    Changeset::<RollingStock>::from(schemas::fixtures::rolling_stock_with_energy_sources())
        .name(name.to_string())
        .locked(false)
        .version(0)
        .create(conn)
        .await
        .expect("Failed to create rolling stock with energy sources")
}

pub async fn create_electrical_profile_set(conn: &mut DbConnection) -> ElectricalProfileSet {
    let json = include_str!("../tests/electrical_profile_set.json");
    serde_json::from_str::<Changeset<ElectricalProfileSet>>(json)
        .expect("Unable to parse")
        .create(conn)
        .await
        .expect("Failed to create electrical profile set")
}

pub async fn create_empty_infra(conn: &mut DbConnection) -> Infra {
    Infra::changeset()
        .name("empty_infra".to_owned())
        .last_railjson_version()
        .create(conn)
        .await
        .expect("Failed to create empty infra")
}

pub async fn create_infra_object<T>(
    conn: &mut DbConnection,
    infra_id: i64,
    object: T,
) -> InfraObject
where
    T: Into<InfraObject> + OSRDObject,
{
    let object_type = object.get_type();
    let railjson_object: InfraObject = object.into();
    let result = apply_create_operation(&railjson_object, infra_id, conn).await;
    assert!(result.is_ok(), "Failed to create a {object_type}");
    railjson_object
}

pub async fn create_small_infra(conn: &mut DbConnection) -> Infra {
    let railjson = schemas::fixtures::small_infra();
    Infra::changeset()
        .name("small_infra".to_owned())
        .last_railjson_version()
        .persist(railjson, conn)
        .await
        .unwrap()
}

pub async fn create_work_schedule_group(conn: &mut DbConnection) -> WorkScheduleGroup {
    WorkScheduleGroup::changeset()
        .name("Empty work schedule group".to_string())
        .creation_date(Utc::now())
        .create(conn)
        .await
        .expect("Failed to create empty work schedule group")
}

pub async fn create_work_schedules_fixture_set(
    conn: &mut DbConnection,
    work_schedules: Vec<Changeset<WorkSchedule>>,
) -> (WorkScheduleGroup, Vec<WorkSchedule>) {
    let work_schedule_group = create_work_schedule_group(conn).await;
    let work_schedules_changesets = work_schedules
        .into_iter()
        .map(|ws| ws.work_schedule_group_id(work_schedule_group.id))
        .collect::<Vec<_>>();
    let work_schedules = WorkSchedule::create_batch(conn, work_schedules_changesets)
        .await
        .expect("Failed to create work test schedules");

    (work_schedule_group, work_schedules)
}

pub fn simple_sub_category(
    code: &str,
    main_category: editoast_models::rolling_stock::TrainMainCategory,
) -> Changeset<SubCategory> {
    SubCategory::changeset()
        .code(code.to_string())
        .name(code.to_uppercase())
        .main_category(main_category)
        .color("#ff0000".parse::<SubCategoryColor>().unwrap())
        .background_color("#ff2200".parse::<SubCategoryColor>().unwrap())
        .hovered_color("#ff4400".parse::<SubCategoryColor>().unwrap())
}
