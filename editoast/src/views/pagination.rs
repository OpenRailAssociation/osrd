use diesel::query_builder::*;
use diesel::sql_query;

pub fn paginate(query: String, page: i64, per_page: i64) -> SqlQuery {
    assert!(per_page > 0);
    let offset = (page - 1) * per_page;
    sql_query(format!(
        "SELECT *, COUNT(*) OVER () FROM ({}) t LIMIT {} OFFSET {}",
        query, per_page, offset
    ))
}
