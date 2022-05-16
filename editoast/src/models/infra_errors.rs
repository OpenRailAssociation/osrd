use diesel::sql_types::{BigInt, Integer, Json, Text};
use diesel::{PgConnection, QueryResult, RunQueryDsl};
use serde::Serialize;
use serde_json::Value;

use crate::views::pagination::paginate;

#[derive(QueryableByName, Debug, Clone)]
struct InfraErrorQueryable {
    #[sql_type = "BigInt"]
    pub count: i64,
    #[sql_type = "Text"]
    pub obj_id: String,
    #[sql_type = "Text"]
    pub obj_type: String,
    #[sql_type = "Json"]
    pub information: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(deny_unknown_fields)]
pub struct InfraError {
    pub obj_id: String,
    pub obj_type: String,
    pub information: Value,
}

impl From<InfraErrorQueryable> for InfraError {
    fn from(error: InfraErrorQueryable) -> Self {
        Self {
            obj_id: error.obj_id,
            obj_type: error.obj_type,
            information: error.information,
        }
    }
}

pub fn get_paginated_infra_errors(
    conn: &PgConnection,
    infra: i32,
    page: i64,
    exclude_warnings: bool,
) -> QueryResult<(Vec<InfraError>, i64)> {
    let per_page = 10;

    let mut query = String::from(
        "SELECT obj_id, obj_type, information::text FROM osrd_infra_errorlayer WHERE infra_id = $1",
    );
    if exclude_warnings {
        query += " AND information->>'is_warning' = 'false'"
    }
    let infra_errors = paginate(query, page, per_page)
        .bind::<Integer, _>(infra)
        .load::<InfraErrorQueryable>(conn)?;
    let count = infra_errors.first().map(|e| e.count).unwrap_or_default();
    let infra_errors = infra_errors.into_iter().map(|e| e.into()).collect();
    Ok((infra_errors, count))
}
