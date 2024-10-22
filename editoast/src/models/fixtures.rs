use std::collections::HashMap;
use std::io::Cursor;
use std::ops::DerefMut;

use chrono::Utc;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPool;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::Direction;
use editoast_schemas::infra::DirectionalTrackRange;
use editoast_schemas::infra::InfraObject;
use editoast_schemas::infra::RailJson;
use editoast_schemas::primitives::OSRDObject;
use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use editoast_schemas::rolling_stock::TowedRollingStock;
use editoast_schemas::train_schedule::TrainScheduleBase;
use postgis_diesel::types::LineString;
use serde_json::Value;

use crate::infra_cache::operation::create::apply_create_operation;
use crate::models::electrical_profiles::ElectricalProfileSet;
use crate::models::prelude::*;
use crate::models::rolling_stock_livery::RollingStockLiveryModel;
use crate::models::timetable::Timetable;
use crate::models::train_schedule::TrainSchedule;
use crate::models::work_schedules::WorkSchedule;
use crate::models::work_schedules::WorkScheduleGroup;
use crate::models::Document;
use crate::models::Infra;
use crate::models::Project;
use crate::models::RollingStockModel;
use crate::models::Scenario;
use crate::models::Study;
use crate::models::Tags;

pub fn project_changeset(name: &str) -> Changeset<Project> {
    Project::changeset()
        .name(name.to_owned())
        .budget(Some(0))
        .creation_date(Utc::now().naive_utc())
        .last_modification(Utc::now().naive_utc())
        .tags(Tags::default())
}

pub async fn create_project(conn: &mut DbConnection, name: &str) -> Project {
    project_changeset(name)
        .create(conn)
        .await
        .expect("Failed to create project")
}

pub fn study_changeset(name: &str, project_id: i64) -> Changeset<Study> {
    Study::changeset()
        .name(name.to_owned())
        .creation_date(Utc::now().naive_utc())
        .creation_date(Utc::now().naive_utc())
        .last_modification(Utc::now().naive_utc())
        .budget(Some(0))
        .tags(Tags::default())
        .state("some_state".into())
        .project_id(project_id)
}

pub async fn create_study(conn: &mut DbConnection, name: &str, project_id: i64) -> Study {
    study_changeset(name, project_id)
        .create(conn)
        .await
        .expect("Failed to create study")
}

pub async fn create_timetable(conn: &mut DbConnection) -> Timetable {
    Timetable::create(conn)
        .await
        .expect("Failed to create timetable")
}

pub fn simple_train_schedule_base() -> TrainScheduleBase {
    serde_json::from_str(include_str!("../tests/train_schedules/simple.json"))
        .expect("Unable to parse test train schedule")
}

pub fn simple_train_schedule_changeset(timetable_id: i64) -> Changeset<TrainSchedule> {
    Changeset::<TrainSchedule>::from(simple_train_schedule_base()).timetable_id(timetable_id)
}

pub async fn create_simple_train_schedule(
    conn: &mut DbConnection,
    timetable_id: i64,
) -> TrainSchedule {
    simple_train_schedule_changeset(timetable_id)
        .create(conn)
        .await
        .expect("Failed to create train schedule")
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
        .creation_date(Utc::now().naive_utc())
        .last_modification(Utc::now().naive_utc())
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
    pub project: Project,
    pub study: Study,
    pub scenario: Scenario,
    pub timetable: Timetable,
    pub infra: Infra,
}

pub async fn create_scenario_fixtures_set(
    conn: &mut DbConnection,
    name: &str,
) -> ScenarioFixtureSet {
    let project = create_project(conn, &format!("project_test_name_with_{name}")).await;
    let study = create_study(conn, &format!("study_test_name_with_{name}"), project.id).await;
    let infra = create_empty_infra(conn).await;
    let timetable = create_timetable(conn).await;
    let scenario = create_scenario(conn, name, study.id, timetable.id, infra.id).await;
    ScenarioFixtureSet {
        project,
        study,
        scenario,
        timetable,
        infra,
    }
}

pub fn fast_rolling_stock_changeset(name: &str) -> Changeset<RollingStockModel> {
    Changeset::<RollingStockModel>::from(
        serde_json::from_str::<editoast_schemas::rolling_stock::RollingStock>(include_str!(
            "../tests/example_rolling_stock_1.json"
        ))
        .expect("Unable to parse example rolling stock"),
    )
    .name(name.to_owned())
    .version(0)
}

pub async fn create_fast_rolling_stock(conn: &mut DbConnection, name: &str) -> RollingStockModel {
    fast_rolling_stock_changeset(name)
        .create(conn)
        .await
        .expect("Failed to create rolling stock")
}

pub fn rolling_stock_with_energy_sources_changeset(name: &str) -> Changeset<RollingStockModel> {
    Changeset::<RollingStockModel>::from(
        serde_json::from_str::<editoast_schemas::rolling_stock::RollingStock>(include_str!(
            "../tests/example_rolling_stock_2_energy_sources.json"
        ))
        .expect("Unable to parse rolling stock with energy sources"),
    )
    .name(name.to_owned())
    .version(1)
}

pub async fn create_rolling_stock_with_energy_sources(
    conn: &mut DbConnection,
    name: &str,
) -> RollingStockModel {
    rolling_stock_with_energy_sources_changeset(name)
        .create(conn)
        .await
        .expect("Failed to create rolling stock with energy sources")
}

pub fn get_rolling_stock_with_invalid_effort_curves() -> &'static str {
    include_str!("../tests/example_rolling_stock_3.json")
}

pub fn rolling_stock_livery_changeset(
    name: &str,
    rolling_stock_id: i64,
    compound_image_id: i64,
) -> Changeset<RollingStockLiveryModel> {
    RollingStockLiveryModel::changeset()
        .name(name.to_string())
        .rolling_stock_id(rolling_stock_id)
        .compound_image_id(Some(compound_image_id))
}

pub async fn create_rolling_stock_livery(
    conn: &mut DbConnection,
    name: &str,
    rolling_stock_id: i64,
    compound_image_id: i64,
) -> RollingStockLiveryModel {
    rolling_stock_livery_changeset(name, rolling_stock_id, compound_image_id)
        .create(conn)
        .await
        .expect("Failed to create rolling stock livery")
}

pub fn create_towed_rolling_stock() -> TowedRollingStock {
    TowedRollingStock {
        name: "TOWED ROLLING STOCK".to_string(),
        mass: 50000_f64,
        length: 30_f64, // m
        comfort_acceleration: 0.2,
        startup_acceleration: 0.06,
        inertia_coefficient: 1.05,
        rolling_resistance: RollingResistance::new("davis".to_string(), 1.0, 0.01, 0.0002),
        gamma: Gamma::new("CONST".to_string(), 1.0),
        railjson_version: "3.4".to_string(),
    }
}

pub fn create_simple_rolling_stock() -> RollingStock {
    RollingStock {
        name: "ROLLING_STOCK_NAME".to_string(),
        loading_gauge: LoadingGaugeType::G1,
        supported_signaling_systems: RollingStockSupportedSignalingSystems(vec![]),
        base_power_class: None,
        comfort_acceleration: 0.1,
        inertia_coefficient: 1.10,
        startup_acceleration: 0.04,
        startup_time: 1.0,
        effort_curves: EffortCurves::default(),
        electrical_power_startup_time: None,
        raise_pantograph_time: None,
        energy_sources: vec![],
        gamma: Gamma::new("CONST".to_string(), 1.0),
        locked: false,
        metadata: None,
        power_restrictions: HashMap::new(),
        railjson_version: "12".to_string(),
        rolling_resistance: RollingResistance::new("davis".to_string(), 1.0, 0.01, 0.0005),
        length: 140.0,   // m
        mass: 15000.0,   // kg
        max_speed: 20.0, // m/s
    }
}

pub async fn create_document_example(conn: &mut DbConnection) -> Document {
    let img = image::open("src/tests/example_rolling_stock_image_1.gif").unwrap();
    let mut img_bytes: Vec<u8> = Vec::new();
    assert!(img
        .write_to(&mut Cursor::new(&mut img_bytes), image::ImageFormat::Png)
        .is_ok());
    let changeset = Document::changeset()
        .content_type(String::from("img/png"))
        .data(img_bytes);

    changeset
        .create(conn)
        .await
        .expect("Failed to create document")
}

pub async fn create_rolling_stock_livery_fixture(
    conn: &mut DbConnection,
    name: &str,
) -> (RollingStockLiveryModel, RollingStockModel, Document) {
    let rolling_stock = create_fast_rolling_stock(conn, name).await;
    let document_exemple = create_document_example(conn).await;
    let rs_livery =
        create_rolling_stock_livery(conn, name, rolling_stock.id, document_exemple.id).await;
    (rs_livery, rolling_stock, document_exemple)
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
    let railjson: RailJson = serde_json::from_str(include_str!(
        "../../../tests/data/infras/small_infra/infra.json"
    ))
    .unwrap();
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
        .creation_date(Utc::now().naive_utc())
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
