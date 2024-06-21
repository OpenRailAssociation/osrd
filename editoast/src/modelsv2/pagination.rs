use diesel::pg::Pg;
use diesel::query_builder::{AstPass, Query, QueryFragment, QueryId};
use diesel::sql_types::{BigInt, Untyped};
use diesel::{QueryResult, QueryableByName};
use diesel_async::RunQueryDsl;
use editoast_models::DbConnection;

use crate::error::Result;

#[derive(QueryId)]
struct PaginatedQuery<Q> {
    query: Q,
    limit: i64,
    offset: i64,
}

#[derive(QueryableByName)]
struct RowWithCount<T: QueryableByName<Pg>> {
    #[diesel(sql_type = BigInt)]
    count: i64,
    #[diesel(embed)]
    item: T,
}

/// `load`s and returns the content of a diesel query, along with the total count of items that would
/// be returned if the query was not paginated
pub async fn load_for_pagination<Q, T>(
    conn: &mut DbConnection,
    query: Q,
    page: u64,
    page_size: u64,
) -> Result<(Vec<T>, u64)>
where
    Q: Query + QueryId + QueryFragment<Pg> + Send,
    T: QueryableByName<Pg> + Send + 'static,
{
    let query = PaginatedQuery {
        query,
        limit: page_size as i64,
        offset: ((page - 1) * page_size) as i64,
    };

    let results = query.load::<RowWithCount<T>>(conn).await?;

    if results.is_empty() {
        return Ok((vec![], 0));
    }
    let count = results[0].count as u64;
    let items = results.into_iter().map(|row| row.item).collect();
    Ok((items, count))
}

impl<Q> QueryFragment<Pg> for PaginatedQuery<Q>
where
    Q: QueryFragment<Pg>,
{
    fn walk_ast<'b>(&'b self, mut out: AstPass<'_, 'b, Pg>) -> QueryResult<()> {
        out.push_sql("SELECT *, COUNT(*) OVER () FROM (");
        self.query.walk_ast(out.reborrow())?;
        out.push_sql(") as paged_query_with LIMIT ");
        out.push_bind_param::<BigInt, _>(&self.limit)?;
        out.push_sql(" OFFSET ");
        out.push_bind_param::<BigInt, _>(&self.offset)?;
        Ok(())
    }
}

impl<Q: Query> Query for PaginatedQuery<Q> {
    type SqlType = Untyped;
}
