use chrono::Utc;

use crate::modelsv2::prelude::*;
use crate::modelsv2::DbConnection;
use crate::modelsv2::Project;
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
