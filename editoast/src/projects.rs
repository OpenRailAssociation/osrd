use crate::error::Result;
use crate::tables::osrd_infra_project;
use crate::tables::osrd_infra_project::dsl;
use actix_web::web::Json;
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

    pub fn update(data: ProjectPatch, conn: &mut PgConnection, project_id: i64) -> Result<Project> {
        let project: Project = dsl::osrd_infra_project
            .filter(dsl::id.eq(project_id))
            .first(conn)?;
        let update_project = Project {
            id: project.id,
            name: match data.name {
                Some(t) => t,
                None => data.name.unwrap(),
            },
            description: match data.description {
                Some(t) => Some(t),
                None => data.description,
            },
            objectives: match data.objectives {
                Some(t) => Some(t),
                None => data.objectives,
            },
            funders: match data.funders {
                Some(t) => Some(t),
                None => data.funders,
            },
            budget: match data.budget {
                Some(t) => Some(t),
                None => data.budget,
            },
            image: match data.image {
                Some(t) => Some(t),
                None => data.image,
            },
            creation_date: project.creation_date,
            last_modification: chrono::Utc::now().naive_utc(),
            tags: match data.tags {
                Some(t) => Some(t),
                None => data.tags,
            },
        };
        let target = dsl::osrd_infra_project.find(project.id);
        update(target).set(&update_project).execute(conn)?;
        Ok(update_project)
    }
}
