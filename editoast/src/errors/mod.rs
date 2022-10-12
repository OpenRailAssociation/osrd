pub mod buffer_stops;
pub mod detectors;
pub mod graph;
pub mod operational_points;
pub mod routes;
pub mod signals;
pub mod speed_sections;
pub mod switch_types;
pub mod switches;
pub mod track_section_links;
pub mod track_sections;

use diesel::result::Error as DieselError;
use diesel::sql_types::{BigInt, Integer, Json};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use serde::Serialize;
use serde_json::Value;

use crate::api_error::ApiError;
use crate::client::ChartosConfig;
use crate::infra_cache::InfraCache;
use crate::layer::invalidate_chartos_layer;
use crate::views::pagination::{paginate, PaginationError};

use graph::Graph;

/// This function regenerate the errors and warnings of the infra
pub fn generate_errors(
    conn: &PgConnection,
    infra: i32,
    infra_cache: &InfraCache,
    chartos_config: &ChartosConfig,
) -> Result<(), DieselError> {
    // Clear the whole layer
    sql_query("DELETE FROM osrd_infra_errorlayer WHERE infra_id = $1")
        .bind::<Integer, _>(infra)
        .execute(conn)?;

    // Create a graph for topological errors
    let graph = Graph::load(infra_cache);

    // Generate the errors
    track_sections::insert_errors(conn, infra, infra_cache, &graph)?;
    signals::insert_errors(conn, infra, infra_cache)?;
    speed_sections::insert_errors(conn, infra, infra_cache)?;
    track_section_links::insert_errors(conn, infra, infra_cache)?;
    switch_types::insert_errors(conn, infra, infra_cache)?;
    switches::insert_errors(conn, infra, infra_cache)?;
    detectors::insert_errors(conn, infra, infra_cache)?;
    buffer_stops::insert_errors(conn, infra, infra_cache)?;
    routes::insert_errors(conn, infra, infra_cache, &graph)?;
    operational_points::insert_errors(conn, infra, infra_cache)?;

    // Invalidate chartos cache
    invalidate_chartos_layer(infra, "errors", chartos_config);
    Ok(())
}

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
