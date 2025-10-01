use database::DbConnection;
use itertools::Either;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;

use utoipa::ToSchema;

use crate::error::Result;
use editoast_models::prelude::*;

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

pub trait PaginatedList: ListAndCount + 'static
where
    <Self as List>::Error: From<<Self as Count>::Error>,
{
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
    ///    and [SelectionSettings::offset] beforehand. [PaginationQueryParams::into_selection_settings]
    ///    works as well.
    async fn list_paginated(
        conn: &mut DbConnection,
        settings: SelectionSettings<Self>,
    ) -> Result<(Vec<Self>, PaginationStats), <Self as List>::Error> {
        let (page, page_size) = settings
            .get_pagination_settings()
            .expect("the limit and the offset must be set in order to call list_paginated");
        let (results, count) = Self::list_and_count(conn, settings).await?;
        let stats = PaginationStats::new(results.len() as u64, count, page, page_size);
        Ok((results, stats))
    }
}

impl<T> PaginatedList for T
where
    T: ListAndCount + 'static,
    <Self as List>::Error: From<<Self as Count>::Error>,
{
}

pub trait ConcatenatedPaginatedList: Sized {
    type Item;
    type Settings;
    type Error;

    async fn list_concatenated(
        conn: &mut DbConnection,
        settings: Self::Settings,
    ) -> Result<(impl Iterator<Item = Self::Item>, PaginationStats), Self::Error>;
}

impl<T, U> ConcatenatedPaginatedList for (T, U)
where
    T: ListAndCount + 'static,
    <T as List>::Error: From<<T as Count>::Error> + From<<U as List>::Error>,
    U: ListAndCount + 'static,
    <U as List>::Error: From<<U as Count>::Error>,
{
    type Item = Either<T, U>;
    type Settings = (SelectionSettings<T>, SelectionSettings<U>);
    type Error = <T as List>::Error;

    async fn list_concatenated(
        conn: &mut DbConnection,
        (ts, us): Self::Settings,
    ) -> Result<(impl Iterator<Item = Self::Item>, PaginationStats), Self::Error> {
        let ((t_page, t_page_size), (u_page, u_page_size)) = ts
            .get_pagination_settings()
            .zip(us.get_pagination_settings())
            .unwrap();
        assert_eq!((t_page, t_page_size), (u_page, u_page_size));
        let (t_results, t_count) = T::list_and_count(conn, ts).await?;
        let (u_results, u_count) = U::list_and_count(
            conn,
            // in case some Ts are missing to reach t_page_size, we need to fetch more Us to reach the target page size
            us.limit(t_page_size - t_results.len() as u64),
        )
        .await?;

        let current_page_count = t_results.len() as u64 + u_results.len() as u64;
        let total_count = t_count + u_count;

        let stats = PaginationStats::new(current_page_count, total_count, t_page, t_page_size);
        Ok((
            t_results
                .into_iter()
                .map(Either::Left)
                .interleave(u_results.into_iter().map(Either::Right)),
            stats,
        ))
    }
}

#[derive(Debug, Clone, Copy)]
pub struct PaginationQueryParams<const MAX_PAGE_SIZE: u64 = 25> {
    pub page: u64,
    pub page_size: u64,
}

impl<'de, const MAX_PAGE_SIZE: u64> serde::de::Deserialize<'de>
    for PaginationQueryParams<MAX_PAGE_SIZE>
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Schema {
            page: Option<u64>,
            page_size: Option<u64>,
        }
        let Schema { page, page_size } = Schema::deserialize(deserializer)?;
        let page = page.unwrap_or(1);
        if page == 0 {
            return Err(serde::de::Error::custom("invalid page 0, pages start at 1"));
        }
        if let Some(size) = page_size
            && !(0 < size && size <= MAX_PAGE_SIZE)
        {
            return Err(serde::de::Error::custom(format!(
                "invalid page size ({size}), expected an integer 0 < page_size <= {MAX_PAGE_SIZE}",
            )));
        }
        Ok(Self {
            page,
            page_size: page_size.unwrap_or(MAX_PAGE_SIZE),
        })
    }
}

impl<const MAX_PAGE_SIZE: u64> utoipa::IntoParams for PaginationQueryParams<MAX_PAGE_SIZE> {
    fn into_params(
        _parameter_in_provider: impl Fn() -> Option<utoipa::openapi::path::ParameterIn>,
    ) -> Vec<utoipa::openapi::path::Parameter> {
        use serde_json::json;
        use utoipa::openapi::KnownFormat;
        use utoipa::openapi::ObjectBuilder;
        use utoipa::openapi::Required;
        use utoipa::openapi::SchemaFormat;
        use utoipa::openapi::path::ParameterBuilder;
        use utoipa::openapi::path::ParameterIn;
        use utoipa::openapi::schema::SchemaType;
        use utoipa::openapi::schema::Type;

        [
            ParameterBuilder::new()
                .name("page")
                .parameter_in(ParameterIn::Query)
                .required(Required::False)
                .schema(Some(
                    ObjectBuilder::new()
                        .schema_type(SchemaType::Type(Type::Integer))
                        .format(Some(SchemaFormat::KnownFormat(KnownFormat::Int64)))
                        .minimum(Some(1f64))
                        .default(Some(json!(1))),
                ))
                .build(),
            ParameterBuilder::new()
                .name("page_size")
                .parameter_in(ParameterIn::Query)
                .required(Required::False)
                .schema(Some(
                    ObjectBuilder::new()
                        .schema_type(SchemaType::Type(Type::Integer))
                        .format(Some(SchemaFormat::KnownFormat(KnownFormat::Int64)))
                        .minimum(Some(1f64))
                        .maximum(Some(MAX_PAGE_SIZE as f64))
                        .default(Some(json!(MAX_PAGE_SIZE))),
                ))
                .build(),
        ]
        .to_vec()
    }
}

impl<const MAX_PAGE_SIZE: u64> PaginationQueryParams<MAX_PAGE_SIZE> {
    /// Returns a pre-filled [SelectionSettings] from the pagination settings
    /// that can then be used to list or count models
    pub fn into_selection_settings<M: Model + 'static>(self) -> SelectionSettings<M> {
        self.into()
    }
}

impl<M: Model + 'static, const MAX_PAGE_SIZE: u64> From<PaginationQueryParams<MAX_PAGE_SIZE>>
    for SelectionSettings<M>
{
    fn from(
        PaginationQueryParams { page, page_size }: PaginationQueryParams<MAX_PAGE_SIZE>,
    ) -> Self {
        SelectionSettings::from_pagination_settings(page, page_size)
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
