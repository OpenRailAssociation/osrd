use crate::error::Result;
use crate::models::Project;
use crate::tables::osrd_infra_study;
use crate::DbPool;
use actix_web::web::{block, Data};
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::sql_types::{Array, BigInt};
use diesel::Associations;
use diesel::ExpressionMethods;
use diesel::{QueryDsl, RunQueryDsl};
use editoast_derive::Model;
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
    Model,
)]
#[derivative(Default)]
#[diesel(belongs_to(Project))]
#[model(table = "osrd_infra_study")]
#[model(create)]
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

impl Study {
    pub async fn with_scenarios(self, db_pool: Data<DbPool>) -> Result<StudyWithScenarios> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_scenario::dsl as scenario_dsl;
            let mut conn = db_pool.get()?;
            let scenarios = scenario_dsl::osrd_infra_scenario
                .filter(scenario_dsl::study_id.eq(self.id.unwrap()))
                .select(scenario_dsl::id)
                .load(&mut conn)?;
            Ok(StudyWithScenarios {
                study: self,
                scenarios,
            })
        })
        .await
        .unwrap()
    }
}
