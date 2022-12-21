use crate::{api_error::ApiResult, db_connection::DBConnection};
use diesel::pg::types::sql_types::Jsonb;
use diesel::sql_types::{Integer, Text};
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use rocket::serde::json::{Error as JsonError, Json, Value as JsonValue};
use serde::{Deserialize, Serialize};
use serde_json::value::Value;

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "object", rename_all = "lowercase")]
pub enum SearchQuery {
    OperationalPoint { query: String },
    Signal { query: String, track: String },
}

const LIMIT_BIND_POS: i32 = 1;
const OFFSET_BIND_POS: i32 = 2;
const QUERY_BIND_POS: i32 = 3;

impl SearchQuery {
    fn query(&self) -> &String {
        match self {
            SearchQuery::OperationalPoint { query } => query,
            SearchQuery::Signal { query, .. } => query,
        }
    }
    fn build_sql(&self, infra: i32) -> String {
        let pagination = format!("LIMIT ${LIMIT_BIND_POS} OFFSET ${OFFSET_BIND_POS}");
        match self {
            SearchQuery::OperationalPoint { query } if query.len() == 0 => "SELECT NULL LIMIT 0".to_string() ,
            SearchQuery::OperationalPoint { query } if query.len() > 3 => format!(
                "SELECT search.result
                FROM osrd_search_operationalpoint AS search
                WHERE search.infra_id = {infra} AND search.name LIKE osrd_to_like_search(${QUERY_BIND_POS})
                {pagination}"
            ),
            SearchQuery::OperationalPoint { .. } => format!(
                "SELECT search.result
                FROM osrd_search_operationalpoint AS search
                WHERE search.infra_id = {infra} AND (
                    search.trigram LIKE osrd_to_like_search(${QUERY_BIND_POS})
                    OR search.name LIKE osrd_to_like_search(${QUERY_BIND_POS})
                )
                {pagination}"
            ),
            SearchQuery::Signal { query: _, track: _ } => todo!(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct SearchPayload {
    search: SearchQuery,
    page: Option<i32>,
    page_size: Option<i32>,
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
struct SearchDBResult {
    #[sql_type = "Jsonb"]
    result: Value,
}

#[post("/<infra>/search", data = "<payload>")]
pub async fn search(
    conn: DBConnection,
    infra: i32,
    payload: Result<Json<SearchPayload>, JsonError<'_>>,
) -> ApiResult<JsonValue> {
    let SearchPayload {
        search,
        page,
        page_size,
    } = payload?.into_inner();
    let page = page.unwrap_or_default().max(1);
    let per_page = page_size.unwrap_or(25).max(10);
    let offset = (page - 1) * per_page;
    let sql = sql_query(search.build_sql(infra))
        .bind::<Integer, _>(per_page)
        .bind::<Integer, _>(offset)
        .bind::<Text, _>(search.query().to_owned());
    let objects: Vec<SearchDBResult> = conn.run(move |conn| sql.load(conn)).await?;
    let results = objects
        .into_iter()
        .map(move |r| r.result)
        .collect::<Vec<Value>>();
    Ok(serde_json::to_value(results).unwrap())
}
