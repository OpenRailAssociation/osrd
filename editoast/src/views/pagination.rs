use crate::error::Result;
use diesel::pg::Pg;
use diesel::query_builder::*;
use diesel::query_dsl::LoadQuery;
use diesel::sql_types::BigInt;
use diesel::sql_types::Untyped;
use diesel::PgConnection;
use diesel::QueryResult;
use diesel::QueryableByName;
use diesel::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;

use editoast_derive::EditoastError;

/// A paginated response
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub count: i64,
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
    #[error("Invalid page number ({page})")]
    #[editoast_error(status = 404)]
    InvalidPage { page: i64 },
    #[error("Invalid page size ({page_size}), expected an integer strictly greater than 0")]
    #[editoast_error(status = 400)]
    InvalidPageSize { page_size: i64 },
}

pub trait Paginate: Sized {
    fn paginate(self, page: i64, page_size: i64) -> Paginated<Self>;
}

impl<T> Paginate for T {
    fn paginate(self, page: i64, page_size: i64) -> Paginated<Self> {
        Paginated {
            query: self,
            page_size,
            page,
            offset: (page - 1) * page_size,
        }
    }
}

#[derive(Debug, Clone, Copy, QueryId)]
pub struct Paginated<T> {
    query: T,
    page: i64,
    page_size: i64,
    offset: i64,
}

#[derive(QueryableByName, Debug)]
pub struct InternalPaginatedResult<T: QueryableByName<Pg>> {
    #[diesel(sql_type = BigInt)]
    count: i64,
    #[diesel(embed)]
    item: T,
}

impl<T> Paginated<T> {
    pub fn load_and_count<'a, R>(self, conn: &mut PgConnection) -> Result<PaginatedResponse<R>>
    where
        Self: LoadQuery<'a, PgConnection, InternalPaginatedResult<R>>,
        R: QueryableByName<Pg> + Send + 'static,
        T: Send + 'static,
    {
        let page_size = self.page_size;
        let page = self.page;
        if page < 1 {
            return Err(PaginationError::InvalidPage { page }.into());
        } else if page_size < 1 {
            return Err(PaginationError::InvalidPageSize { page_size }.into());
        }

        let results = self.load::<InternalPaginatedResult<R>>(conn)?;

        // Check when no results
        if results.is_empty() {
            if page > 1 {
                return Err(PaginationError::InvalidPage { page }.into());
            } else {
                return Ok(PaginatedResponse {
                    count: 0,
                    previous: None,
                    next: None,
                    results: vec![],
                });
            }
        }

        let count = results.get(0).unwrap().count;
        let previous = if page > 1 { Some(page - 1) } else { None };
        let next = if count > page * page_size {
            Some(page + 1)
        } else {
            None
        };
        let results = results.into_iter().map(|r| r.item).collect();
        Ok(PaginatedResponse {
            count,
            previous,
            next,
            results,
        })
    }
}

impl<T> QueryFragment<Pg> for Paginated<T>
where
    T: QueryFragment<Pg>,
{
    fn walk_ast<'b>(&'b self, mut out: AstPass<'_, 'b, Pg>) -> QueryResult<()> {
        out.push_sql("SELECT *, COUNT(*) OVER () FROM (");
        self.query.walk_ast(out.reborrow())?;
        out.push_sql(") as paged_query_with LIMIT ");
        out.push_bind_param::<BigInt, _>(&self.page_size)?;
        out.push_sql(" OFFSET ");
        out.push_bind_param::<BigInt, _>(&self.offset)?;
        Ok(())
    }
}

impl<T: Query> Query for Paginated<T> {
    type SqlType = Untyped;
}

impl<T> RunQueryDsl<PgConnection> for Paginated<T> {}
