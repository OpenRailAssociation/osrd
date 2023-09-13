use crate::error::Result;
use crate::schema::InfraError;
use crate::schemas;
use crate::views::infra::InfraWithState;
use diesel::pg::Pg;
use diesel::query_builder::*;
use diesel::sql_types::BigInt;
use diesel::sql_types::Untyped;
use diesel::{QueryResult, QueryableByName};
use diesel_async::methods::LoadQuery;
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::{IntoParams, ToSchema};

use editoast_derive::EditoastError;

schemas! {
    PaginatedInfras,
    PaginatedInfraWithState,
    PaginatedInfraErrors,
}

macro_rules! decl_paginated_response {
    ($name:ident, $item:ty) => {
        /// A paginated response
        #[derive(ToSchema)]
        pub struct $name {
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
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub count: i64,
    pub previous: Option<i64>,
    pub next: Option<i64>,
    pub results: Vec<T>,
}

// HACK: We need to specialize manually PaginatedResponse with each
// type we intend to use it with, otherwise utoipa will generate a $ref to T...
decl_paginated_response!(PaginatedInfras, InfraWithState);
decl_paginated_response!(PaginatedInfraWithState, InfraWithState);
decl_paginated_response!(PaginatedInfraErrors, InfraError);

#[derive(Debug, Clone, Copy, Deserialize, IntoParams)]
pub struct PaginationQueryParam {
    /// Page number
    #[serde(default = "default_page")]
    #[param(minimum = 1, default = 1)]
    pub page: i64,
    /// Number of elements by page
    #[param(minimum = 1, maximum = 10000, default = 25)]
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
            return Err(PaginationError::InvalidPageSize { page_size }.into());
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
