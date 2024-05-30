use chrono::Utc;
use editoast_schemas::infra::BufferStop;
use editoast_schemas::infra::Detector;
use editoast_schemas::infra::Electrification;
use editoast_schemas::infra::OperationalPoint;
use editoast_schemas::infra::Route;
use editoast_schemas::infra::Signal;
use editoast_schemas::infra::SpeedSection;
use editoast_schemas::infra::Switch;
use editoast_schemas::infra::SwitchType;
use editoast_schemas::infra::TrackSection;

use crate::infra_cache::operation::create::apply_create_operation;
use crate::infra_cache::operation::RailjsonObject;
use crate::modelsv2::prelude::*;
use crate::modelsv2::DbConnection;
use crate::modelsv2::Infra;
use crate::modelsv2::Project;
use crate::modelsv2::Study;
use crate::modelsv2::Tags;

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

pub async fn create_empty_infra(conn: &mut DbConnection) -> Infra {
    Infra::changeset()
        .name("empty_infra".to_owned())
        .last_railjson_version()
        .create(conn)
        .await
        .expect("Failed to create empty infra")
}

pub async fn create_track(
    conn: &mut DbConnection,
    infra_id: i64,
    track: TrackSection,
) -> RailjsonObject {
    let obj = RailjsonObject::TrackSection { railjson: track };
    assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
    obj
}

pub async fn create_signal(
    conn: &mut DbConnection,
    infra_id: i64,
    signal: Signal,
) -> RailjsonObject {
    let obj = RailjsonObject::Signal { railjson: signal };
    assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
    obj
}

pub async fn create_speed(
    conn: &mut DbConnection,
    infra_id: i64,
    speed: SpeedSection,
) -> RailjsonObject {
    let obj = RailjsonObject::SpeedSection { railjson: speed };
    assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
    obj
}

pub async fn create_switch(
    conn: &mut DbConnection,
    infra_id: i64,
    switch: Switch,
) -> RailjsonObject {
    let obj = RailjsonObject::Switch { railjson: switch };
    assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
    obj
}

pub async fn create_detector(
    conn: &mut DbConnection,
    infra_id: i64,
    detector: Detector,
) -> RailjsonObject {
    let obj = RailjsonObject::Detector { railjson: detector };
    assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
    obj
}

pub async fn create_buffer_stop(
    conn: &mut DbConnection,
    infra_id: i64,
    buffer_stop: BufferStop,
) -> RailjsonObject {
    let obj = RailjsonObject::BufferStop {
        railjson: buffer_stop,
    };
    assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
    obj
}

pub async fn create_route(conn: &mut DbConnection, infra_id: i64, route: Route) -> RailjsonObject {
    let obj = RailjsonObject::Route { railjson: route };
    assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
    obj
}

pub async fn create_op(
    conn: &mut DbConnection,
    infra_id: i64,
    op: OperationalPoint,
) -> RailjsonObject {
    let obj = RailjsonObject::OperationalPoint { railjson: op };
    assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
    obj
}

pub async fn create_switch_type(
    conn: &mut DbConnection,
    infra_id: i64,
    st: SwitchType,
) -> RailjsonObject {
    let obj = RailjsonObject::SwitchType { railjson: st };
    assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
    obj
}

pub async fn create_electrification(
    conn: &mut DbConnection,
    infra_id: i64,
    electrification: Electrification,
) -> RailjsonObject {
    let obj = RailjsonObject::Electrification {
        railjson: electrification,
    };
    assert!(apply_create_operation(&obj, infra_id, conn).await.is_ok());
    obj
}
