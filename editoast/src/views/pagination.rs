use crate::error::Result;
use diesel::pg::Pg;
use diesel::query_builder::*;
use diesel::sql_types::BigInt;
use diesel::sql_types::Untyped;
use diesel::{QueryResult, QueryableByName};
use diesel_async::methods::LoadQuery;
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use log::warn;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;

use editoast_derive::EditoastError;
use utoipa::IntoParams;

const DEFAULT_PAGE_SIZE: i64 = 25;

/// Generates a specialized [PaginatedResponse], commented, annotated with `ToSchema`
///
/// We need to specialize manually PaginatedResponse with each
/// type we intend to use it with, otherwise utoipa will generate a $ref to T...
#[macro_export]
macro_rules! decl_paginated_response {
    ($name:ident, $item:ty) => {
        $crate::decl_paginated_response! {pub(self) $name, $item}
    };
    ($vis:vis $name:ident, $item:ty) => {
        /// A paginated response
        #[allow(unused)]
        #[allow(clippy::needless_pub_self)]
        #[derive(utoipa::ToSchema)]
        $vis struct $name {
            /// The total number of items
            pub count: i64,
            /// The previous page number
            #[schema(required)]
            pub previous: Option<i64>,
            /// The next page number
            #[schema(required)]
            pub next: Option<i64>,
            /// The list of results
            #[schema(required)]
            pub results: Vec<$item>,
        }
    };
}

/// A paginated response
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub count: i64,
    pub previous: Option<i64>,
    pub next: Option<i64>,
    pub results: Vec<T>,
}

#[derive(Debug, Clone, Copy, Deserialize, IntoParams)]
pub struct PaginationQueryParam {
    #[serde(default = "default_page")]
    #[param(minimum = 1, default = 1)]
    pub page: i64,
    #[param(minimum = 1, default = 25)]
    pub page_size: Option<i64>,
}

fn default_page() -> i64 {
    1
}

impl PaginationQueryParam {
    pub fn validate(self, max_page_size: i64) -> Result<PaginationQueryParam> {
        let page_size = self.page_size.unwrap_or(DEFAULT_PAGE_SIZE);
        if page_size > max_page_size || page_size < 1 || self.page < 1 {
            return Err(PaginationError::InvalidPageSize {
                provided_page_size: page_size,
                max_page_size,
            }
            .into());
        }
        Ok(self)
    }

    pub fn warn_page_size(self, warn_page_size: i64) -> PaginationQueryParam {
        let page_size = self.page_size.unwrap_or(DEFAULT_PAGE_SIZE);
        if page_size < warn_page_size {
            warn!(
                "Too many elements per page, should be lower or equal to {}.",
                warn_page_size
            );
        }
        self
    }

    pub fn unpack(self) -> (i64, i64) {
        let page_size = self.page_size.unwrap_or(DEFAULT_PAGE_SIZE);
        (self.page, page_size)
    }
}

/// Simple pagination error
#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "pagination")]
pub enum PaginationError {
    #[error("Invalid page number ({page})")]
    #[editoast_error(status = 404)]
    InvalidPage { page: i64 },
    #[error("Invalid page size ({provided_page_size}), expected an integer 0 < page_size <= {max_page_size}")]
    #[editoast_error(status = 400)]
    InvalidPageSize {
        provided_page_size: i64,
        max_page_size: i64,
    },
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
    pub async fn load_and_count<'a, R>(
        self,
        conn: &mut PgConnection,
    ) -> Result<PaginatedResponse<R>>
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
            return Err(PaginationError::InvalidPageSize {
                provided_page_size: page,
                max_page_size: 1000,
            }
            .into());
        }

        let results = self.load::<InternalPaginatedResult<R>>(conn).await?;

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
