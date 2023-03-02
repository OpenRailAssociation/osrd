use crate::error::Result;
use crate::DbPool;
use actix_web::web::block;
use actix_web::web::Data;
use diesel::pg::Pg;
use diesel::query_builder::*;
use diesel::query_dsl::LoadQuery;
use diesel::sql_types::BigInt;
use diesel::sql_types::Untyped;
use diesel::PgConnection;
use diesel::QueryResult;
use diesel::QueryableByName;
use diesel::RunQueryDsl;
use serde::ser::SerializeStruct;
use serde::Deserialize;
use serde::Serialize;
use std::result::Result as StdResult;
use thiserror::Error;

use editoast_derive::EditoastError;

/// A paginated response
#[derive(Debug)]
pub struct PaginatedResponse<T> {
    pub count: i64,
    pub previous: Option<i64>,
    pub next: Option<i64>,
    pub results: Vec<T>,
}

impl<T: Serialize> Serialize for PaginatedResponse<T> {
    fn serialize<S>(&self, serializer: S) -> StdResult<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut s = serializer.serialize_struct("PaginatedResponse", 4)?;
        s.serialize_field("count", &self.count)?;
        s.serialize_field("previous", &self.previous)?;
        s.serialize_field("next", &self.next)?;
        s.serialize_field("result", &self.results)?;
        s.end()
    }
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

pub trait Paginate: Sized {
    fn paginate(self, page: i64) -> Paginated<Self>;
}

impl<T> Paginate for T {
    fn paginate(self, page: i64) -> Paginated<Self> {
        Paginated {
            query: self,
            per_page: DEFAULT_PER_PAGE,
            page,
            offset: (page - 1) * DEFAULT_PER_PAGE,
        }
    }
}

const DEFAULT_PER_PAGE: i64 = 25;

#[derive(Debug, Clone, Copy, QueryId)]
pub struct Paginated<T> {
    query: T,
    page: i64,
    per_page: i64,
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
    pub fn per_page(self, per_page: i64) -> Self {
        Paginated {
            per_page,
            offset: (self.page - 1) * per_page,
            ..self
        }
    }

    pub async fn load_and_count<'a, R>(self, db_pool: Data<DbPool>) -> Result<PaginatedResponse<R>>
    where
        Self: LoadQuery<'a, PgConnection, InternalPaginatedResult<R>>,
        R: QueryableByName<Pg> + Send + 'static,
        T: Send + 'static,
    {
        let per_page = self.per_page;
        let page = self.page;
        let results = block::<_, Result<_>>(move || {
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match self.load::<InternalPaginatedResult<R>>(&mut conn) {
                Ok(results) => Ok(results),
                Err(error) => Err(error.into()),
            }
        })
        .await
        .unwrap()?;

        // Check when no results
        if results.is_empty() {
            if page > 1 {
                return Err(PaginationError::InvalidPage.into());
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
        let next = if count > page * per_page {
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
        out.push_bind_param::<BigInt, _>(&self.per_page)?;
        out.push_sql(" OFFSET ");
        out.push_bind_param::<BigInt, _>(&self.offset)?;
        Ok(())
    }
}

impl<T: Query> Query for Paginated<T> {
    type SqlType = Untyped;
}

impl<T> RunQueryDsl<PgConnection> for Paginated<T> {}
