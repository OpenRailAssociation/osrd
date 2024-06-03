use chrono::Utc;
use editoast_schemas::primitives::OSRDObject;

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
