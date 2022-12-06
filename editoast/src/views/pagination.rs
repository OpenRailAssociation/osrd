use diesel::query_builder::*;
use diesel::sql_query;
use rocket::http::Status;
use std::error::Error;
use std::fmt::Display;

use crate::api_error::ApiError;

/// Simple pagination error
#[derive(Debug)]
pub struct PaginationError;
impl Error for PaginationError {}

impl Display for PaginationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Invalid page")
    }
}

impl ApiError for PaginationError {
    fn get_status(&self) -> Status {
        Status::NotFound
    }

    fn get_type(&self) -> &'static str {
        "editoast:pagination:Invalid"
    }
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
