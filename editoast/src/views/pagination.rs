use diesel::pg::Pg;
use diesel::query_builder::*;
use diesel::sql_types::BigInt;
use diesel::sql_types::Untyped;
use diesel::QueryResult;
use diesel::QueryableByName;
use diesel_async::methods::LoadQuery;
use editoast_derive::EditoastError;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use tracing::warn;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::error::Result;
use crate::modelsv2::DbConnection;
use crate::ListAndCount;
use crate::Model;
use crate::SelectionSettings;

editoast_common::schemas! {
    PaginationStats,
}

const DEFAULT_PAGE_SIZE: u64 = 25;

/// Statistics about a paginated editoast response
///
/// Provides the pagination settings issued in the request alongside
/// a few convenience fields useful to navigate the paginated results.
///
/// # Expected usage
///
/// This struct is meant to be used and flattened in the response of a paginated query.
///
/// ```
/// #[derive(Serialize, ToSchema)]
/// struct MyPaginatedResponse {
///     #[schema(flatten)]
///     pagination: PaginationStats,
///     result: Vec<MyData>,
///     // any other field that makes sense in a paginated response
/// }
/// ```
///
/// We named the data field `result` to cope with the old pagination schema which
/// enforced this name. For new paginated responses, the field name is up to your imagination :)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub struct PaginationStats {
    /// The total number of items
    #[schema(minimum = 0)]
    pub count: u64,

    /// The number of items per page
    #[schema(minimum = 1)]
    pub page_size: u64,

    /// The total number of pages
    #[schema(minimum = 0)]
    pub page_count: u64,

    /// The current page number
    #[schema(minimum = 1)]
    pub current: u64,

    /// The previous page number, if any
    #[schema(required, minimum = 1)]
    pub previous: Option<u64>,

    /// The next page number, if any
    #[schema(required, minimum = 1)]
    pub next: Option<u64>,
}

impl PaginationStats {
    /// Computes a new [PaginationStats] from pagination settings and query result count
    ///
    /// # Panics
    ///
    /// - If the page or the page_size are null
    /// - If `(page - 1) * page_size + current_page_count <= total_count`. In other words if
    ///   the `current_page_count` is inconsistent with the pagination settings and the `total_count`.
    pub fn new(current_page_count: u64, total_count: u64, page: u64, page_size: u64) -> Self {
        assert!(page > 0);
        assert!(page_size > 0);
        assert!((page - 1) * page_size + current_page_count <= total_count);
        let page_count = total_count.div_ceil(page_size);
        let previous = (page > 1 && total_count > 0).then_some(page - 1);
        let next = ((page - 1) * page_size + current_page_count < total_count).then_some(page + 1);
        Self {
            count: total_count,
            page_size,
            page_count,
            current: page,
            previous,
            next,
        }
    }
}

#[async_trait::async_trait]
pub trait PaginatedList: ListAndCount + 'static {
    /// Lists the models and compute [PaginationStats]
    ///
    /// See [ListAndCount::list_and_count] for more details.
    ///
    /// # On verifications
    ///
    /// 1. The pagination soundness of the `settings` should have been verified
    ///    before this function is called (e.g.: non-null page size).
    /// 2. Panics if the limit or the offset of the `settings` are not set, so be
    ///    sure to call [SelectionSettings::from_pagination_settings] or [SelectionSettings::limit]
    ///    and [SelectionSettings::offset] beforehand. [PaginationQueryParam::into_selection_settings]
    ///    works as well.
    async fn list_paginated(
        conn: &mut DbConnection,
        settings: SelectionSettings<Self>,
    ) -> Result<(Vec<Self>, PaginationStats)> {
        let (page, page_size) = settings
            .get_pagination_settings()
            .expect("the limit and the offset must be set in order to call list_paginated");
        let (results, count) = Self::list_and_count(conn, settings).await?;
        let stats = PaginationStats::new(results.len() as u64, count, page, page_size);
        Ok((results, stats))
    }
}

impl<T> PaginatedList for T where T: ListAndCount + 'static {}

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
#[derive(Debug, PartialEq, Serialize, Deserialize)]
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
    pub page: u64,
    #[param(minimum = 1, default = 25)]
    pub page_size: Option<u64>,
}

const fn default_page() -> u64 {
    1
}

impl PaginationQueryParam {
    /// Returns a pre-filled [SelectionSettings] from the pagination settings
    /// that can then be used to list or count models
    pub fn into_selection_settings<M: Model + 'static>(self) -> SelectionSettings<M> {
        self.into()
    }

    pub fn validate(self, max_page_size: i64) -> Result<PaginationQueryParam> {
        let (page, page_size) = self.unpack();
        if page_size > max_page_size || page_size < 1 || page < 1 {
            return Err(PaginationError::InvalidPageSize {
                provided_page_size: page_size,
                max_page_size,
            }
            .into());
        }
        Ok(self)
    }

    pub fn warn_page_size(self, warn_page_size: i64) -> PaginationQueryParam {
        let (_, page_size) = self.unpack();
        if page_size > warn_page_size {
            warn!(
                "Too many elements per page, should be lower or equal to {}.",
                warn_page_size
            );
        }
        self
    }

    pub fn unpack(&self) -> (i64, i64) {
        let page_size = self.page_size.unwrap_or(DEFAULT_PAGE_SIZE);
        (self.page as i64, page_size as i64)
    }
}

impl<M: Model + 'static> From<PaginationQueryParam> for SelectionSettings<M> {
    fn from(PaginationQueryParam { page, page_size }: PaginationQueryParam) -> Self {
        let page_size = page_size.unwrap_or(DEFAULT_PAGE_SIZE);
        SelectionSettings::from_pagination_settings(page, page_size)
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
        conn: &mut DbConnection,
    ) -> Result<PaginatedResponse<R>>
    where
        Self: LoadQuery<'a, DbConnection, InternalPaginatedResult<R>>,
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

        let results = {
            use diesel_async::RunQueryDsl;
            self.load::<InternalPaginatedResult<R>>(conn).await?
        };

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

        let count = results.first().unwrap().count;
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

impl<T> PaginatedResponse<T> {
    pub fn into<A: From<T>>(self) -> PaginatedResponse<A> {
        PaginatedResponse {
            count: self.count,
            previous: self.previous,
            next: self.next,
            results: self.results.into_iter().map_into().collect(),
        }
    }
}

#[cfg(test)]
mod pagination_stats_tests {
    use super::PaginationStats;

    #[test]
    fn no_results() {
        assert_eq!(
            PaginationStats::new(0, 0, 1, 25),
            PaginationStats {
                count: 0,
                page_size: 25,
                page_count: 0,
                current: 1,
                previous: None,
                next: None,
            }
        );
    }

    #[test]
    fn single_result() {
        assert_eq!(
            PaginationStats::new(1, 1, 1, 25),
            PaginationStats {
                count: 1,
                page_size: 25,
                page_count: 1,
                current: 1,
                previous: None,
                next: None,
            }
        );
    }

    #[test]
    fn first_page() {
        assert_eq!(
            PaginationStats::new(25, 26, 1, 25),
            PaginationStats {
                count: 26,
                page_size: 25,
                page_count: 2,
                current: 1,
                previous: None,
                next: Some(2),
            }
        );
    }

    #[test]
    fn second_page() {
        assert_eq!(
            PaginationStats::new(1, 26, 2, 25),
            PaginationStats {
                count: 26,
                page_size: 25,
                page_count: 2,
                current: 2,
                previous: Some(1),
                next: None,
            }
        );
    }
}
