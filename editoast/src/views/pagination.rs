use diesel::query_builder::*;
use diesel::sql_query;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;

use editoast_derive::EditoastError;

/// A paginated response
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub count: u64,
    pub previous: Option<i64>,
    pub next: Option<i64>,
    pub results: Vec<T>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct PaginationQueryParam {
    #[serde(default = "default_page")]
    pub page: i64,
    pub page_size: Option<i64>,
}

fn default_page() -> i64 {
    1
}

/// Simple pagination error
#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pagination")]
pub enum PaginationError {
    #[error("Invalid page number")]
    #[editoast_error(status = 404)]
    InvalidPage,
}

/// Transform a query into a paginated sql query.
///
/// - `query`: the sql query (listing elements)
/// - `page`: the page number queried
/// - `per_page`: the number of items allowed by page
pub fn paginate(query: String, page: i64, per_page: i64) -> SqlQuery {
    assert!(per_page > 0);
    let offset = (page - 1) * per_page;
    sql_query(format!(
        "SELECT *, COUNT(*) OVER () FROM ({query}) t LIMIT {per_page} OFFSET {offset}"
    ))
}
