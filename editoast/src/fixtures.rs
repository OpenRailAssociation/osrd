use chrono::Duration as ChronoDuration;
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
use editoast_models::towed_rolling_stock::TowedRollingStock;
use editoast_models::train_schedule_exception::TrainScheduleException;
use schemas::TrainScheduleExceptionChangeGroups;
use schemas::infra::InfraObject;
use schemas::paced_train::Paced;
use schemas::paced_train::TrainNameChangeGroup;
use schemas::paced_train::TrainSchedule;
use schemas::primitives::OSRDObject;
use schemas::rolling_stock::SubCategoryColor;

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

pub fn simple_paced_train_base() -> TrainSchedule {
    TrainSchedule {
        train_occurrence: schemas::TrainOccurrence::fake(),
        paced: Some(Paced {
            time_window: ChronoDuration::hours(2).try_into().unwrap(),
            interval: ChronoDuration::minutes(15).try_into().unwrap(),
            exceptions: vec![],
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

pub async fn create_train_schedule_exception(
    conn: &mut DbConnection,
    timetable_id: i64,
    train_schedule_id: i64,
    occurrence_index: Option<i64>,
    key: Option<String>,
    change_groups: Option<TrainScheduleExceptionChangeGroups>,
) -> TrainScheduleException {
    TrainScheduleException::changeset()
        .timetable_id(timetable_id)
        .train_schedule_id(train_schedule_id)
        .occurrence_index(occurrence_index)
        .key(key)
        .disabled(false)
        .change_groups(
            change_groups.unwrap_or_else(|| TrainScheduleExceptionChangeGroups {
                train_name: Some(TrainNameChangeGroup {
                    value: "Name".into(),
                }),
                ..Default::default()
            }),
        )
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

pub async fn create_towed_rolling_stock(conn: &mut DbConnection, name: &str) -> TowedRollingStock {
    Changeset::<TowedRollingStock>::from(schemas::fixtures::towed_rolling_stock())
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
    let json = include_str!("tests/electrical_profile_set.json");
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
