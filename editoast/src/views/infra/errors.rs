use diesel::sql_types::{BigInt, Integer, Json};
use diesel::{PgConnection, RunQueryDsl};
use serde::Serialize;
use serde_json::Value;

use crate::api_error::ApiError;

use crate::views::pagination::{paginate, PaginationError};

#[derive(QueryableByName, Debug, Clone)]
struct InfraErrorQueryable {
    #[sql_type = "BigInt"]
    pub count: i64,
    #[sql_type = "Json"]
    pub information: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(deny_unknown_fields)]
pub struct InfraErrorModel {
    pub information: Value,
}

impl From<InfraErrorQueryable> for InfraErrorModel {
    fn from(error: InfraErrorQueryable) -> Self {
        Self {
            information: error.information,
        }
    }
}

pub fn get_paginated_infra_errors(
    conn: &PgConnection,
    infra: i32,
    page: i64,
    per_page: i64,
    exclude_warnings: bool,
) -> Result<(Vec<InfraErrorModel>, i64), Box<dyn ApiError>> {
    let mut query =
        String::from("SELECT information::text FROM osrd_infra_errorlayer WHERE infra_id = $1");
    if exclude_warnings {
        query += " AND information->>'is_warning' = 'false'"
    }
    let infra_errors = paginate(query, page, per_page)
        .bind::<Integer, _>(infra)
        .load::<InfraErrorQueryable>(conn)?;
    let count = infra_errors.first().map(|e| e.count).unwrap_or_default();
    let infra_errors: Vec<InfraErrorModel> = infra_errors.into_iter().map(|e| e.into()).collect();
    if infra_errors.is_empty() && page > 1 {
        return Err(Box::new(PaginationError));
    }
    Ok((infra_errors, count))
}
