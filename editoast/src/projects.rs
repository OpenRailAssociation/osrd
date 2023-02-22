use crate::error::Result;
use crate::tables::osrd_infra_project;
use crate::tables::osrd_infra_project::dsl;
use actix_web::web::Json;
use chrono::NaiveDateTime;
use diesel::result::Error as DieselError;
use diesel::sql_types::{Array, Integer, Nullable, Text};
use diesel::ExpressionMethods;
use diesel::{delete, sql_query, PgConnection, QueryDsl, RunQueryDsl};
use editoast_derive::EditoastError;
use thiserror::Error;

use serde::{Deserialize, Serialize};

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra", context = "Self::context")]
pub enum ProjectError {
    /// Couldn't found the infra with the given id
    #[error("Project '{0}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound(i64),
}

#[derive(Clone, QueryableByName, Queryable, Debug, Serialize, Deserialize, Identifiable)]
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
    pub description: String,
    pub objectives: String,
    pub funders: Option<Vec<String>>,
    pub budget: Option<i32>,
    pub image: Option<Vec<u8>>,
    pub tags: Option<Vec<String>>,
}
impl Project {
    pub fn create(data: Json<ProjectData>, conn: &mut PgConnection) -> Result<Project> {
        match sql_query(
        "INSERT INTO osrd_infra_project (name, description, objectives, funders, budget, image, creation_date,last_modification, tags)
         VALUES ($1, $2, $3, $4, $5, NULL,CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,$6)
         RETURNING *",
    )
    .bind::<Text, _>(&data.name)
    .bind::<Nullable<Text>,_>(&data.description)
    .bind::<Nullable<Text>,_>(&data.objectives)
    .bind::<Nullable<Array<Text>>,_>(&data.funders)
    .bind::<Nullable<Integer>,_>(&data.budget)
    .bind::<Nullable<Array<Text>>,_>(&data.tags)
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
}
