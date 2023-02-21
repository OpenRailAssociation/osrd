use crate::error::Result;
use crate::tables::osrd_infra_project;
use crate::tables::osrd_infra_project::dsl;
use actix_web::web::Json;
use chrono::NaiveDateTime;
use diesel::sql_types::{Array, Integer, Nullable, Text};
use diesel::{sql_query, PgConnection, RunQueryDsl};

use serde::{Deserialize, Serialize};

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
}
