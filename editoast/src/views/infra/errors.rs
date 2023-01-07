use crate::api_error::ApiError;
use crate::views::pagination::{paginate, PaginationError};
use diesel::sql_types::{BigInt, Integer, Json, Nullable, Text};
use diesel::{PgConnection, RunQueryDsl};
use serde::Serialize;
use serde_json::Value;

#[derive(QueryableByName, Debug, Clone)]
struct InfraErrorQueryable {
    #[sql_type = "BigInt"]
    pub count: i64,
    #[sql_type = "Json"]
    pub information: Value,
    #[sql_type = "Nullable<Json>"]
    pub geographic: Option<Value>,
    #[sql_type = "Nullable<Json>"]
    pub schematic: Option<Value>,
}

#[derive(Default, Debug, PartialEq, Eq, FromFormField)]
pub enum Level {
    Warnings,
    Errors,
    #[default]
    All,
}

#[derive(Debug, Clone, Serialize)]
#[serde(deny_unknown_fields)]
pub struct InfraErrorModel {
    pub information: Value,
    pub geographic: Option<Value>,
    pub schematic: Option<Value>,
}

impl From<InfraErrorQueryable> for InfraErrorModel {
    fn from(error: InfraErrorQueryable) -> Self {
        Self {
            information: error.information,
            geographic: error.geographic,
            schematic: error.schematic,
        }
    }
}

pub fn get_paginated_infra_errors(
    conn: &PgConnection,
    infra: i32,
    page: i64,
    per_page: i64,
    level: Level,
    error_type: Option<String>,
    object_id: Option<String>,
) -> Result<(Vec<InfraErrorModel>, i64), Box<dyn ApiError>> {
    let mut query =
        String::from("SELECT information::text, ST_AsGeoJSON(ST_Transform(geographic, 4326))::json as geographic,
        ST_AsGeoJSON(ST_Transform(schematic, 4326))::json as schematic FROM osrd_infra_errorlayer WHERE infra_id = $1");
    if level == Level::Warnings {
        query += " AND information->>'is_warning' = 'true'"
    } else if level == Level::Errors {
        query += " AND information->>'is_warning' = 'false'"
    }
    if error_type.is_some() {
        query += " AND information->>'error_type' = $2"
    }
    if object_id.is_some() {
        query += " AND information->>'obj_id' = $3"
    }

    let infra_errors = paginate(query, page, per_page)
        .bind::<Integer, _>(infra)
        .bind::<Text, _>(&error_type.unwrap_or_default())
        .bind::<Text, _>(&object_id.unwrap_or_default())
        .load::<InfraErrorQueryable>(conn)?;
    let count = infra_errors.first().map(|e| e.count).unwrap_or_default();
    let infra_errors: Vec<InfraErrorModel> = infra_errors.into_iter().map(|e| e.into()).collect();
    if infra_errors.is_empty() && page > 1 {
        return Err(Box::new(PaginationError));
    }
    Ok((infra_errors, count))
}
