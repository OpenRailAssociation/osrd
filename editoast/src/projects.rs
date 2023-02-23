use crate::error::Result;
use crate::tables::osrd_infra_project;
use crate::tables::osrd_infra_project::dsl;
use chrono::NaiveDateTime;
use diesel::result::Error as DieselError;
use diesel::sql_types::{Array, Integer, Nullable, Text};
use diesel::ExpressionMethods;
use diesel::{delete, sql_query, update, PgConnection, QueryDsl, RunQueryDsl};
use editoast_derive::EditoastError;
use thiserror::Error;

use serde::{Deserialize, Serialize};

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "project", context = "Self::context")]
pub enum ProjectError {
    /// Couldn't found the infra with the given id
    #[error("Project '{0}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound(i64),
}

#[derive(
    Clone, QueryableByName, Queryable, Debug, Serialize, Deserialize, AsChangeset, Identifiable,
)]
#[diesel(table_name = osrd_infra_project)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub objectives: Option<String>,
    pub funders: Option<Vec<String>>,
    pub budget: Option<i32>,
    pub image: Option<Vec<u8>>,
    pub creation_date: NaiveDateTime,
    pub last_modification: NaiveDateTime,
    pub tags: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize)]
pub struct ProjectData {
    pub name: String,
    pub description: Option<String>,
    pub objectives: Option<String>,
    pub funders: Option<Vec<String>>,
    pub budget: Option<i32>,
    pub image: Option<Vec<u8>>,
    pub tags: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize)]
pub struct ProjectPatch {
    pub name: Option<String>,
    pub description: Option<String>,
    pub objectives: Option<String>,
    pub funders: Option<Vec<String>>,
    pub budget: Option<i32>,
    pub image: Option<Vec<u8>>,
    pub tags: Option<Vec<String>>,
}

impl Project {
    pub fn create(data: ProjectData, conn: &mut PgConnection) -> Result<Project> {
        match sql_query(
        "INSERT INTO osrd_infra_project (name, description, objectives, funders, budget, image, creation_date,last_modification, tags)
         VALUES ($1, $2, $3, $4, $5, NULL,CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,$6)
         RETURNING *",
    )
    .bind::<Text, _>(data.name)
    .bind::<Nullable<Text>,_>(data.description)
    .bind::<Nullable<Text>,_>(data.objectives)
    .bind::<Nullable<Array<Text>>,_>(data.funders)
    .bind::<Nullable<Integer>,_>(data.budget)
    .bind::<Nullable<Array<Text>>,_>(data.tags)
    .get_result::<Project>(conn)
    {
        Ok(project) => Ok(project),
        Err(err) => Err(err.into()),
    }
    }

    pub fn list(conn: &mut PgConnection) -> Vec<Project> {
        dsl::osrd_infra_project
            .load(conn)
            .expect("List project query failed")
    }

    pub fn retrieve(conn: &mut PgConnection, project_id: i64) -> Result<Project> {
        match dsl::osrd_infra_project.find(project_id).first(conn) {
            Ok(project) => Ok(project),
            Err(DieselError::NotFound) => Err(ProjectError::NotFound(project_id).into()),
            Err(e) => Err(e.into()),
        }
    }

    pub fn delete(project_id: i64, conn: &mut PgConnection) -> Result<()> {
        match delete(dsl::osrd_infra_project.filter(dsl::id.eq(project_id))).execute(conn) {
            Ok(1) => Ok(()),
            Ok(_) => Err(ProjectError::NotFound(project_id).into()),
            Err(err) => Err(err.into()),
        }
    }

    pub fn update(data: ProjectPatch, conn: &mut PgConnection, project_id: i64) -> Result<Project> {
        let project: Project = dsl::osrd_infra_project
            .filter(dsl::id.eq(project_id))
            .first(conn)?;
        let update_project = update(dsl::osrd_infra_project.find(project_id))
            .set((
                dsl::name.eq(data.name.unwrap_or(project.name)),
                dsl::description.eq(data.description.or(project.description)),
                dsl::objectives.eq(data.objectives.or(project.objectives)),
                dsl::funders.eq(data.funders.or(project.funders)),
                dsl::budget.eq(data.budget.or(project.budget)),
                dsl::image.eq(data.image.or(project.image)),
                dsl::tags.eq(data.tags.or(project.tags)),
                dsl::last_modification.eq(chrono::Utc::now().naive_utc()),
            ))
            .get_result::<Project>(conn)?;
        Ok(update_project)
    }
}

#[cfg(test)]

pub mod test {

    use super::{Project, ProjectData};
    use crate::client::PostgresConfig;
    use actix_web::http::StatusCode;
    use actix_web::ResponseError;
    use diesel::result::Error;
    use diesel::{Connection, PgConnection};

    pub fn test_project_transaction(fn_test: fn(&mut PgConnection, Project)) {
        let mut conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        let project_data: ProjectData = ProjectData {
            name: "test".into(),
            description: Some("description".into()),
            objectives: Some("objectives".into()),
            funders: None,
            budget: None,
            image: None,
            tags: None,
        };
        conn.test_transaction::<_, Error, _>(|conn| {
            let infra = Project::create(project_data, conn).unwrap();

            fn_test(conn, infra);
            Ok(())
        });
    }

    #[test]
    fn create_project() {
        test_project_transaction(|_, project| {
            assert_eq!("test", project.name);
        });
    }

    #[test]
    fn delete_project() {
        test_project_transaction(|conn, project| {
            assert!(Project::delete(project.id, conn).is_ok());
            let err = Project::delete(project.id, conn).unwrap_err();
            assert_eq!(err.status_code(), StatusCode::NOT_FOUND);
        });
    }
}
