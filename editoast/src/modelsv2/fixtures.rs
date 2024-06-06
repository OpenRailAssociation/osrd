use std::io::Cursor;

use chrono::Utc;
use editoast_schemas::primitives::OSRDObject;

use crate::infra_cache::operation::create::apply_create_operation;
use crate::infra_cache::operation::RailjsonObject;
use crate::modelsv2::prelude::*;
use crate::modelsv2::rolling_stock_livery::RollingStockLiveryModel;
use crate::modelsv2::timetable::Timetable;
use crate::modelsv2::DbConnection;
use crate::modelsv2::Document;
use crate::modelsv2::ElectricalProfileSet;
use crate::modelsv2::Infra;
use crate::modelsv2::Project;
use crate::modelsv2::RollingStockModel;
use crate::modelsv2::Study;
use crate::modelsv2::Tags;
use crate::views::rolling_stocks::rolling_stock_form::RollingStockForm;

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
    // let rolling_stock = named_fast_rolling_stock(&rs_name, db_pool.clone()).await;
    // let image = document_example(db_pool.clone()).await;

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

pub async fn create_timetable(conn: &mut DbConnection) -> Timetable {
    Timetable::changeset()
        .electrical_profile_set_id(None)
        .create(conn)
        .await
        .expect("Failed to create timetable")
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
) -> RailjsonObject
where
    T: Into<RailjsonObject> + OSRDObject,
{
    let object_type = object.get_type();
    let railjson_object: RailjsonObject = object.into();
    let result = apply_create_operation(&railjson_object, infra_id, conn).await;
    assert!(result.is_ok(), "Failed to create a {object_type}");
    railjson_object
}
