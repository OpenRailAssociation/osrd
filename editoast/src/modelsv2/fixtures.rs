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
use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::train_schedule::TrainScheduleBase;
use postgis_diesel::types::LineString;

use crate::infra_cache::operation::create::apply_create_operation;
use crate::modelsv2::prelude::*;
use crate::modelsv2::rolling_stock_livery::RollingStockLiveryModel;
use crate::modelsv2::timetable::Timetable;
use crate::modelsv2::train_schedule::TrainSchedule;
use crate::modelsv2::work_schedules::WorkScheduleGroup;
use crate::modelsv2::Document;
use crate::modelsv2::Infra;
use crate::modelsv2::Project;
use crate::modelsv2::RollingStockModel;
use crate::modelsv2::Scenario;
use crate::modelsv2::Study;
use crate::modelsv2::Tags;
use crate::views::rolling_stocks::rolling_stock_form::RollingStockForm;
use crate::views::v2::train_schedule::TrainScheduleForm;
use crate::ElectricalProfileSet;

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
        .expect("Unable to parse")
}

pub fn simple_train_schedule_form(timetable_id: i64) -> TrainScheduleForm {
    let train_schedule: TrainScheduleBase = simple_train_schedule_base();
    TrainScheduleForm {
        timetable_id: Some(timetable_id),
        train_schedule,
    }
}

pub async fn create_simple_train_schedule(
    conn: &mut DbConnection,
    timetable_id: i64,
) -> TrainSchedule {
    let train_schedule: Changeset<TrainSchedule> = simple_train_schedule_form(timetable_id).into();
    train_schedule
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
        .description("test_scenario_v2 description".to_string())
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

pub fn fast_rolling_stock_form(name: &str) -> RollingStockForm {
    let mut rolling_stock_form: RollingStockForm =
        serde_json::from_str(include_str!("../tests/example_rolling_stock_1.json"))
            .expect("Unable to parse exemple rolling stock");
    rolling_stock_form.name = name.to_string();
    rolling_stock_form
}

pub fn fast_rolling_stock_changeset(name: &str) -> Changeset<RollingStockModel> {
    let mut rolling_stock_form: RollingStockForm = fast_rolling_stock_form(name);
    rolling_stock_form.name = name.to_string();
    let rolling_stock_model: Changeset<RollingStockModel> = rolling_stock_form.into();
    rolling_stock_model.version(0)
}

pub async fn create_fast_rolling_stock(conn: &mut DbConnection, name: &str) -> RollingStockModel {
    fast_rolling_stock_changeset(name)
        .create(conn)
        .await
        .expect("Failed to create rolling stock")
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

pub fn rolling_stock_with_energy_sources_form(name: &str) -> RollingStockForm {
    let mut rolling_stock_form: RollingStockForm = serde_json::from_str(include_str!(
        "../tests/example_rolling_stock_2_energy_sources.json"
    ))
    .expect("Unable to parse rolling stock with energy sources");
    rolling_stock_form.name = name.to_string();
    rolling_stock_form
}

pub fn rolling_stock_with_energy_sources_changeset(name: &str) -> Changeset<RollingStockModel> {
    let rolling_stock_model: Changeset<RollingStockModel> =
        rolling_stock_with_energy_sources_form(name).into();
    rolling_stock_model.name(name.to_owned()).version(1)
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

pub fn get_trainschedule_json_array() -> &'static str {
    include_str!("../tests/train_schedules/simple_array.json")
}

pub fn get_fast_rolling_stock_schema(name: &str) -> RollingStock {
    let mut rolling_stock_form: RollingStock =
        serde_json::from_str(include_str!("../tests/example_rolling_stock_1.json"))
            .expect("Unable to parse");
    rolling_stock_form.name = name.to_string();
    rolling_stock_form
}
