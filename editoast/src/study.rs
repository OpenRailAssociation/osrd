use crate::error::Result;
use crate::models::Project;
use crate::tables::osrd_infra_study;

use crate::DbPool;
use actix_web::web::{block, Data};
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::insert_into;
use diesel::sql_types::{Array, BigInt};
use diesel::{Associations, RunQueryDsl};
use serde::{Deserialize, Serialize};

#[derive(
    Clone,
    Debug,
    Serialize,
    Deserialize,
    Insertable,
    Derivative,
    Queryable,
    QueryableByName,
    AsChangeset,
    Identifiable,
    Associations,
)]
#[derivative(Default)]
#[diesel(belongs_to(Project))]
#[diesel(table_name = osrd_infra_study)]
pub struct Study {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    pub project_id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
    #[diesel(deserialize_as = String)]
    pub description: Option<String>,
    #[diesel(deserialize_as = String)]
    pub business_code: Option<String>,
    #[diesel(deserialize_as = String)]
    pub service_code: Option<String>,
    #[diesel(deserialize_as = NaiveDateTime)]
    pub creation_date: Option<NaiveDateTime>,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub last_modification: NaiveDateTime,
    #[diesel(deserialize_as = Option<NaiveDateTime>)]
    pub start_date: Option<Option<NaiveDateTime>>,
    #[diesel(deserialize_as = Option<NaiveDateTime>)]
    pub expected_end_date: Option<Option<NaiveDateTime>>,
    #[diesel(deserialize_as = Option<NaiveDateTime>)]
    pub actual_end_date: Option<Option<NaiveDateTime>>,
    #[diesel(deserialize_as = i32)]
    pub budget: Option<i32>,
    #[diesel(deserialize_as = Vec<String>)]
    pub tags: Option<Vec<String>>,
    #[diesel(deserialize_as = String)]
    pub state: Option<String>,
    #[diesel(deserialize_as = String)]
    pub study_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, QueryableByName)]
pub struct StudyWithScenarios {
    #[serde(flatten)]
    #[diesel(embed)]
    pub study: Study,
    #[diesel(sql_type = Array<BigInt>)]
    pub scenarios: Vec<i64>,
}

/// This structure is used by the post endpoint to create a study
#[derive(Serialize, Deserialize, Derivative)]
#[derivative(Default)]
pub struct StudyCreateForm {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub start_date: Option<NaiveDateTime>,
    pub expected_end_date: Option<NaiveDateTime>,
    pub actual_end_date: Option<NaiveDateTime>,
    #[serde(default)]
    pub business_code: String,
    #[serde(default)]
    pub service_code: String,
    #[serde(default)]
    pub budget: i32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub study_type: String,
}

impl From<StudyCreateForm> for Study {
    fn from(study: StudyCreateForm) -> Self {
        Study {
            name: Some(study.name),
            description: Some(study.description),
            budget: Some(study.budget),
            tags: Some(study.tags),
            creation_date: Some(Utc::now().naive_utc()),
            business_code: Some(study.business_code),
            service_code: Some(study.service_code),
            state: Some(study.state),
            study_type: Some(study.study_type),
            start_date: Some(study.start_date),
            expected_end_date: Some(study.expected_end_date),
            actual_end_date: Some(study.actual_end_date),
            ..Default::default()
        }
    }
}

impl Study {
    pub async fn create(db_pool: Data<DbPool>, data: Study) -> Result<StudyWithScenarios> {
        let study = block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_study::dsl::*;
            let mut conn = db_pool.get().expect("Failed to get DB connection");

            let study = insert_into(osrd_infra_study)
                .values(&data)
                .get_result::<Study>(&mut conn)?;

            Ok(study)
        })
        .await
        .unwrap()?;

        Ok(StudyWithScenarios {
            study,
            scenarios: vec![],
        })
    }
}
