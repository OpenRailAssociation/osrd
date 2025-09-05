use std::collections::HashMap;
use std::io::Cursor;
use std::ops::DerefMut;
use std::str::FromStr;

use chrono::DateTime;
use chrono::Duration as ChronoDuration;
use chrono::Utc;
use database::DbConnection;

use common::units;
use database::DbConnectionPoolV2;
use postgis_diesel::types::LineString;
use schemas::fixtures::simple_created_exception_with_change_groups;
use schemas::fixtures::simple_modified_exception_with_change_groups;
use schemas::infra::Direction;
use schemas::infra::DirectionalTrackRange;
use schemas::infra::InfraObject;
use schemas::infra::RailJson;
use schemas::infra::TrackOffset;
use schemas::paced_train::ConstraintDistributionChangeGroup;
use schemas::paced_train::ExceptionType;
use schemas::paced_train::InitialSpeedChangeGroup;
use schemas::paced_train::LabelsChangeGroup;
use schemas::paced_train::OptionsChangeGroup;
use schemas::paced_train::Paced;
use schemas::paced_train::PacedTrain;
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
use schemas::rolling_stock::EffortCurves;
use schemas::rolling_stock::LoadingGaugeType;
use schemas::rolling_stock::RollingResistance;
use schemas::rolling_stock::RollingResistancePerWeight;
use schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use schemas::rolling_stock::SubCategoryColor;
use schemas::rolling_stock::TowedRollingStock;
use schemas::rolling_stock::TrainMainCategories;
use schemas::rolling_stock::TrainMainCategory;
use schemas::train_schedule::Comfort;
use schemas::train_schedule::Distribution;
use schemas::train_schedule::MarginValue;
use schemas::train_schedule::Margins;
use schemas::train_schedule::OperationalPointIdentifier;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItem;
use schemas::train_schedule::PathItemLocation;
use schemas::train_schedule::ScheduleItem;
use schemas::train_schedule::TrainSchedule;
use schemas::train_schedule::TrainScheduleOptions;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

use crate::infra_cache::operation::create::apply_create_operation;
use crate::models;
use crate::models::Infra;
use crate::models::Project;
use crate::models::RollingStock;
use crate::models::Scenario;
use crate::models::Study;
use crate::models::rolling_stock_livery::RollingStockLivery;
use crate::models::timetable::Timetable;
use editoast_models::Document;
use editoast_models::ElectricalProfileSet;
use editoast_models::SubCategory;
use editoast_models::WorkSchedule;
use editoast_models::WorkScheduleGroup;
use editoast_models::prelude::*;
use editoast_models::tags::Tags;

use editoast_models::TemporarySpeedLimitGroup;

pub fn project_changeset(name: &str) -> Changeset<Project> {
    Project::changeset()
        .name(name.to_owned())
        .budget(Some(0))
        .creation_date(Utc::now())
        .last_modification(Utc::now())
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
        .creation_date(Utc::now())
        .last_modification(Utc::now())
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
    Timetable::changeset()
        .create(conn)
        .await
        .expect("Failed to create timetable")
}

pub fn simple_train_schedule_base() -> TrainSchedule {
    serde_json::from_str(include_str!("../tests/train_schedules/simple.json"))
        .expect("Unable to parse test train schedule")
}

pub fn create_created_exception_with_change_groups(key: &str) -> PacedTrainException {
    PacedTrainException {
        key: key.into(),
        exception_type: ExceptionType::Created {},
        disabled: false,
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
                    deleted: false,
                    location: PathItemLocation::TrackOffset(TrackOffset {
                        offset: 300,
                        track: Identifier("TC0".to_string()),
                    }),
                },
                PathItem {
                    id: "bb".into(),
                    deleted: false,
                    location: PathItemLocation::OperationalPointReference(
                        OperationalPointReference {
                            reference: OperationalPointIdentifier::OperationalPointId {
                                operational_point: Identifier("Mid_East_station".to_string()),
                            },
                            track_reference: None,
                        },
                    ),
                },
                PathItem {
                    id: "cc".into(),
                    deleted: false,
                    location: PathItemLocation::TrackOffset(TrackOffset {
                        offset: 300,
                        track: Identifier("TC1".to_string()),
                    }),
                },
                PathItem {
                    id: "dd".into(),
                    deleted: false,
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
    }
}

pub fn create_modified_exception_with_change_groups(
    key: &str,
    occurrence_index: i32,
) -> PacedTrainException {
    let mut exception = create_created_exception_with_change_groups(key);
    exception.exception_type = ExceptionType::Modified { occurrence_index };
    exception.start_time = None;
    exception.train_name = Some(TrainNameChangeGroup {
        value: "modified_exception_train_name".to_string(),
    });
    exception
}

pub fn simple_paced_train_base() -> PacedTrain {
    let train_schedule_base =
        serde_json::from_str(include_str!("../tests/train_schedules/simple.json"))
            .expect("Unable to parse test train schedule");
    PacedTrain {
        train_schedule_base,
        exceptions: vec![
            simple_created_exception_with_change_groups("exception_key_1"),
            simple_modified_exception_with_change_groups("exception_key_2", 0),
        ],
        paced: Paced {
            time_window: ChronoDuration::hours(2).try_into().unwrap(),
            interval: ChronoDuration::minutes(15).try_into().unwrap(),
        },
    }
}

pub fn simple_train_schedule_changeset(timetable_id: i64) -> Changeset<models::TrainSchedule> {
    Changeset::<models::TrainSchedule>::from(simple_train_schedule_base())
        .timetable_id(timetable_id)
}

pub fn simple_paced_train_changeset(timetable_id: i64) -> Changeset<models::PacedTrain> {
    Changeset::<models::PacedTrain>::from(simple_paced_train_base()).timetable_id(timetable_id)
}

pub async fn create_simple_train_schedule(
    conn: &mut DbConnection,
    timetable_id: i64,
) -> models::TrainSchedule {
    simple_train_schedule_changeset(timetable_id)
        .create(conn)
        .await
        .expect("Failed to create train schedule")
}

pub async fn create_simple_paced_train(
    conn: &mut DbConnection,
    timetable_id: i64,
) -> models::PacedTrain {
    simple_paced_train_changeset(timetable_id)
        .create(conn)
        .await
        .expect("Failed to create paced train")
}

pub async fn create_paced_train_with_exceptions(
    conn: &mut DbConnection,
    timetable_id: i64,
    exceptions: Vec<PacedTrainException>,
) -> models::PacedTrain {
    let paced_train = simple_paced_train_changeset(timetable_id).exceptions(exceptions);
    paced_train
        .create(conn)
        .await
        .expect("Failed to create paced train")
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

pub fn fast_rolling_stock_changeset(name: &str) -> Changeset<RollingStock> {
    Changeset::<RollingStock>::from(
        serde_json::from_str::<schemas::RollingStock>(include_str!(
            "../tests/example_rolling_stock_1.json"
        ))
        .expect("Unable to parse example rolling stock"),
    )
    .name(name.to_owned())
    .locked(false)
    .version(0)
}

pub async fn create_fast_rolling_stock(conn: &mut DbConnection, name: &str) -> RollingStock {
    fast_rolling_stock_changeset(name)
        .create(conn)
        .await
        .expect("Failed to create rolling stock")
}

pub fn rolling_stock_with_energy_sources_changeset(name: &str) -> Changeset<RollingStock> {
    Changeset::<RollingStock>::from(
        serde_json::from_str::<schemas::RollingStock>(include_str!(
            "../tests/example_rolling_stock_2_energy_sources.json"
        ))
        .expect("Unable to parse rolling stock with energy sources"),
    )
    .name(name.to_owned())
    .locked(false)
    .version(1)
}

pub async fn create_rolling_stock_with_energy_sources(
    conn: &mut DbConnection,
    name: &str,
) -> RollingStock {
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
) -> Changeset<RollingStockLivery> {
    RollingStockLivery::changeset()
        .name(name.to_string())
        .rolling_stock_id(rolling_stock_id)
        .compound_image_id(Some(compound_image_id))
}

pub async fn create_rolling_stock_livery(
    conn: &mut DbConnection,
    name: &str,
    rolling_stock_id: i64,
    compound_image_id: i64,
) -> RollingStockLivery {
    rolling_stock_livery_changeset(name, rolling_stock_id, compound_image_id)
        .create(conn)
        .await
        .expect("Failed to create rolling stock livery")
}

pub async fn create_document_example(conn: &mut DbConnection) -> Document {
    let img = image::open("src/tests/example_rolling_stock_image_1.gif").unwrap();
    let mut img_bytes: Vec<u8> = Vec::new();
    assert!(
        img.write_to(&mut Cursor::new(&mut img_bytes), image::ImageFormat::Png)
            .is_ok()
    );
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
) -> (RollingStockLivery, RollingStock, Document) {
    let rolling_stock = create_fast_rolling_stock(conn, name).await;
    let document_example = create_document_example(conn).await;
    let rs_livery =
        create_rolling_stock_livery(conn, name, rolling_stock.id, document_example.id).await;
    (rs_livery, rolling_stock, document_example)
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
        .creation_date(Utc::now())
        .create(conn)
        .await
        .expect("Failed to create empty work schedule group")
}

pub async fn create_temporary_speed_limit_group(
    conn: &mut DbConnection,
) -> TemporarySpeedLimitGroup {
    TemporarySpeedLimitGroup::changeset()
        .name("Empty temporary speed limit group".to_string())
        .creation_date(Utc::now())
        .create(conn)
        .await
        .expect("Failed to create empty temporary speed limit group")
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

#[derive(Debug, Deserialize)]
pub struct PartialProjectPathTrainResult {
    pub departure_time: DateTime<Utc>,
    // Ignore the rest of the payload
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
