//! Defines the route [search] that can efficiently search all objects declared
//! in `search.yml` in a generic way
//!
//! # Example
//!
//! We can search all operational points around le Mont St-Michel and the railway
//! station `PNO` in the infra with id #2 with a POST query with the following body:
//!
//! ```yaml
//! {
//!     "object": "operationalpoint",
//!     "query": ["and",
//!                 ["or",
//!                     ["search", ["name"], "mich st"],
//!                     ["search", ["trigram"], "PNO"]],
//!                 ["=", ["infra_id"], 2]]
//! }
//! ```
//!
//! The query will be deserialized, type-checked and converted to a bunch of
//! constraints that will apply to the SQL request that produces the response.
//!
//! The next sections show how the request is processed.
//!
//! # Schema
//!
//! ```text
//!        JSON query from /search payload
//!
//!                     │
//!                     │                   Functions     Trusted columns     Search table
//!                     │                   ────┬────     ───────┬───────     ──────┬─────
//!                     ▼                       │                │                  │
//!                                             │                │                  │
//!         ┌───────────────────────┐           │                │                  │
//!         │Conversion to SearchAst│           │                │                  │
//!         └───────────────────────┘           └────────┐       │      ┌───────────┘
//!                                                      │       │      │
//!                     │                                │       │      │
//!                     ▼                                │       │      │
//!                                                      ▼       ▼      ▼
//!              ┌─────────────┐
//!              │Type checking│ ◄───────────────┬────  Evaluation context
//!              └─────────────┘                 │
//!                                              │
//!                     │                        │
//!                     ▼                        │
//!                                              │
//!            ┌───────────────────┐             │
//!            │Query evaluation   │             │
//!            │- function calls   │ ◄───────────┘
//!            │- SQL AST building │
//!            └───────────────────┘
//!
//!                     │
//!                     ▼
//!     ┌────────────────────────────────┐
//!     │    Conversion to SQL code      │
//!     │(in our case, a where statement)│
//!     └────────────────────────────────┘
//!
//!                     │
//!                     ▼
//!
//! ┌─────────────────────────────────────────┐
//! │String binding to prevent SQL injections │
//! └─────────────────────────────────────────┘
//!
//!                     │
//!                     ▼
//!
//!       ┌────────────────────────────┐
//!       │    Query execution and     │
//!       │endpoint response generation│
//!       └────────────────────────────┘
//!
//!                     │
//!                     │
//!                     │
//!                     ▼
//!
//!       HTTP response w/ search results
//! ```
//!
//! # Configuration file
//!
//! The config file `search.yml` defines:
//!
//! - the name of the searchable objects
//! - the columns that can be used as a search criteria alongside their type
//! - the table with these columns to search into
//! - the data returned for each object that matches the query
//!
//! Example:
//!
//! ```yaml
//! operationalpoint:
//!   table: search_operational_point
//!   columns:
//!     obj_id: string
//!     infra_id: integer
//!     name: string
//!     uic: integer
//!     trigram: string
//!   result:
//!     joins: |
//!       INNER JOIN infra_object_operational_point AS opm ON opm.id = search_operational_point.id
//!       INNER JOIN infra_layer_operational_point AS opl ON opm.obj_id = opl.obj_id AND opm.infra_id = opl.infra_id
//!     columns:
//!       obj_id: opm.obj_id
//!       infra_id: opm.infra_id
//!       uic: opm.data#>>'{extensions,identifier,uic}'
//!       name: opm.data#>>'{extensions,identifier,name}'
//!       trigram: opm.data#>>'{extensions,sncf,trigram}'
//!       ch: opm.data#>>'{extensions,sncf,ch}'
//!       geographic: ST_AsGeoJSON(ST_Transform(opl.geographic, 4326))::json
//! ```
//!
//! In order to create the aforementioned search table (or materialized views), check
//! out the function `run_sql_create_infra_search_table` in API's Django migrations.
//!
//! # Query parsing
//!
//! The query in the payload is a JSON value that represent a boolean expression
//! with operators and function calls in prefix notation. It is first checked
//! and converted to a [SearchAst] which is a formalization of the AST.
//!
//! See [searchast].
//!
//! # Type checking
//!
//! Before turning the query into SQL code, we need to make sure of two things:
//!
//! 1. The query needs to typecheck. For instance, we disallow using the AND
//!     operator with an operand that is not either a boolean of `null`.
//!     The same goes for the LIKE operator that expects as a second operand
//!     only `null` or a string.
//! 2. The query needs to represent a constraint that can be inserted as a WHERE
//!     clause in the final SQL query. Therefore, the type of the whole query
//!     needs to be a boolean, or `null`.
//!
//! However, to accurately determine the type of every part of the request, we
//! need some extra information:
//!
//! - The type of each column involved in the request: `["=", ["col"], 12]` only
//!     makes sense if the column `col` represents an integer.
//! - The signature of each function in the query: `["like", ["name"], 12]` doesn't
//!     makes sense because the SQL LIKE operator expects a string pattern and
//!     not an integer.
//!
//! The structure that represents that context is [QueryContext] which provides
//! the function [QueryContext::typecheck_search_query()]. The functions the
//! route [search] uses are defined by [create_processing_context()] and
//! the columns defined in the `search.yml` configuration file are added to
//! that context.
//!
//! If the query typechecks in that particular context, it can be evaluated.
//!
//! # Evaluation
//!
//! In order to turn the ✨typechecked✨ query into an SQL statement, it is "evaluated"
//! within a [QueryContext] ; which contains several things:
//!
//! - The list of expected columns and their type. That data is extracted from `search.yml`.
//! - The name of the search table (e.g.: `search_operational_point`). That
//!     information is useful to prevent ambiguities in the SQL query because of
//!     column name conflicts.
//! - The list of functions (or operators) the query can use, their type signatures
//!   (with possible overloads) and their definition.
//!
//! The transformation of the search expression into a valid SQL query occurs
//! in [QueryContext::search_ast_to_sql()], which will evaluate every function call,
//! each one using the input arguments to build an SQL expression that will
//! be part of the final SQL query.
//!
//! # SQL query construction and execution
//!
//! The evaluation step produces an [sqlquery::SqlQuery] object that can
//! be converted to a string containing valid PostgreSQL code ready to be inserted
//! into the search query's WHERE statement.
//!
//! Now, with the WHERE statement representing all the constraints expressed by our
//! search query ready, we build the rest of the SQL query that will produce
//! the search result to return. To do that the `result:` section
//! of `search.yml` is used. It contains all the data to be returned alongside the SQL
//! code to compute their value. It is also possible to join other tables.
//!
//! The last step is to bind all user strings to the SQL query in order to
//! prevent any SQL injection. That way, no malicious search query can be forged.
//!
//! The SQL request is now complete and ready to be executed in Postgres.
//! The resulting table of the request will then be converted to a JSON array of
//! mappings that constitutes the payload of the HTTP response.

// TODO: the documentation of this file needs to be updated (no more search.yml)

pub mod context;
pub mod dsl;
mod objects;
pub mod process;
mod search_object;
pub mod searchast;
pub mod sqlquery;
pub mod typing;

use actix_web::post;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Query;
use actix_web::HttpResponse;
use actix_web::Responder;
use diesel::pg::Pg;
use diesel::query_builder::BoxedSqlQuery;
use diesel::sql_query;
use diesel::sql_types::Jsonb;
use diesel::sql_types::Text;
use diesel::QueryableByName;
use diesel_async::RunQueryDsl;
use editoast_derive::EditoastError;
pub use objects::SearchConfigFinder;
use serde::Deserialize;
use serde::Serialize;
use serde_json::value::Value as JsonValue;
use thiserror::Error;
use utoipa::ToSchema;

use self::context::QueryContext;
use self::context::TypedAst;
use self::process::create_processing_context;
pub use self::search_object::*;
use self::searchast::SearchAst;
use self::typing::AstType;
use self::typing::TypeSpec;
use crate::error::Result;
use crate::views::pagination::PaginationQueryParam;
use editoast_models::DbConnectionPool;

crate::routes! {
    search
}

editoast_common::schemas! {
    SearchPayload,
    SearchQuery,
    objects::SearchResultItem::schemas(),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "search")]
enum SearchError {
    #[error("object type '{object_type}' is invalid")]
    ObjectType { object_type: String },
    #[error("query has type '{query_type}' but Boolean is expected")]
    QueryAst { query_type: String },
}

impl SearchConfig {
    fn result_columns(&self) -> String {
        self.properties
            .iter()
            .map(|Property { name, sql, .. }| format!("({sql}) AS \"{name}\""))
            .collect::<Vec<_>>()
            .join(", ")
    }

    fn create_context(&self) -> QueryContext {
        let mut context = create_processing_context();
        context.search_table_name = Some(self.table.to_owned());
        // Register known columns with their expected type
        for Criteria {
            name, data_type, ..
        } in self.criterias.iter()
        {
            context
                .columns_type
                .insert(name.to_string(), data_type.clone());
        }
        context
    }
}

/// A search query
#[derive(ToSchema, Serialize)]
#[schema(example = json!(["and", ["=", ["infra_id"], 2], ["search", ["name"], "plop"]]))]
#[serde(untagged)]
#[allow(unused)] // only used as an OpenAPI schema
enum SearchQuery {
    Boolean(bool),
    Number(f64),
    Int(i64),
    String(String),
    Array(Vec<Option<SearchQuery>>),
}

/// The payload of a search request
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[schema(example = json!({
    "object": "operationalpoint",
    "query": ["and", ["=", ["infra_id"], 2], ["search", ["name"], "plop"]]
}))]
pub struct SearchPayload {
    /// The object kind to query - run `editoast search list` to get all possible values
    object: String,
    /// The query to run
    #[schema(value_type = SearchQuery)]
    query: JsonValue,
    /// Whether to return the SQL query instead of executing it
    #[serde(default)]
    dry: bool,
}

fn create_sql_query(
    query: JsonValue,
    search_config: &SearchConfig,
    limit: i64,
    offset: i64,
) -> Result<BoxedSqlQuery<'static, Pg, diesel::query_builder::SqlQuery>> {
    let ast = SearchAst::build_ast(query)?;
    let context = search_config.create_context();
    let search_ast_expression_type = context.typecheck_search_query(&ast)?;
    if !AstType::Boolean.is_supertype_spec(&search_ast_expression_type) {
        return Err(SearchError::QueryAst {
            query_type: search_ast_expression_type.to_string(),
        }
        .into());
    }
    let where_expression = context.search_ast_to_sql(&ast)?;
    let table = &search_config.table;
    let joins = search_config.joins.as_ref().cloned().unwrap_or_default();
    let result_columns = search_config.result_columns();
    let mut bindings = Default::default();
    let constraints = where_expression.to_sql(&mut bindings);
    let sql_code = format!(
        "WITH _RESULT AS (
            SELECT {result_columns}
            FROM {table}
            {joins}
            WHERE {constraints}
            LIMIT {limit} OFFSET {offset}
        )
        SELECT to_jsonb(_RESULT) AS result
        FROM _RESULT"
    );
    let mut sql_query = sql_query(sql_code).into_boxed();
    for string in bindings {
        sql_query = sql_query.bind::<Text, _>(string.to_owned());
    }
    Ok(sql_query)
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
struct SearchDBResult {
    #[diesel(sql_type = Jsonb)]
    result: JsonValue,
}

/// Returns all infra objects of some type according to a hierarchical query.
///
/// # Payload
///
///     {
///         "object": string,
///         "query": query,
///         "dry": boolean, # default: false
///     }
///
/// Where:
/// - `object` can be any search object declared in `search.yml`
/// - `query` is a JSON document which can be deserialized into a [SearchAst].
///   Check out examples below.
///
/// # Response
///
/// The response structure depends on the `object`.
///
/// # Query language
///
/// The query itself is defined using a language made up of nested JSON arrays.
/// It will be parsed and transformed into a PostgreSQL WHERE statement.
/// The language consist of a single boolean expression of comparison statements
/// in prefix notation. For example, the query `["like", ["name"], "%ari%"]`
/// will generate a WHERE statement like `WHERE "name" LIKE '%ari%'`.
/// For more information on the query language itself, check out examples below.
///
/// # Available functions
///
/// See [create_processing_context()].
///
/// # A few query examples
///
/// * The railway station PNO: `["=", ["trigram"], "pno"]`
/// * The railway stations with either "Paris" or "Lyon" (or both) in their name:
///   `["or", ["search", ["name"], "Paris"], ["search", ["name"], "Lyon"]]`
/// * All railway stations with "Paris" in their name but not PNO :
///   `["and", ["search", ["name"], "Paris"], ["not", ["=", ["trigram"], "pno"]]]`
///
/// See [SearchAst] for a more detailed view of the query language.
#[utoipa::path(
    tag = "search",
    params(PaginationQueryParam),
    request_body = SearchPayload,
    responses(
        (status = 200, body = Vec<SearchResultItem>, description = "The search results"),
    )
)]
#[post("/search")]
pub async fn search(
    query_params: Query<PaginationQueryParam>,
    payload: Json<SearchPayload>,
    db_pool: Data<DbConnectionPool>,
) -> Result<impl Responder> {
    let (page, per_page) = query_params.validate(1000)?.warn_page_size(100).unpack();
    let Json(SearchPayload { object, query, dry }) = payload;
    let search_config =
        SearchConfigFinder::find(&object).ok_or_else(|| SearchError::ObjectType {
            object_type: object.to_owned(),
        })?;
    let offset = (page - 1) * per_page;
    let sql = create_sql_query(query, &search_config, per_page, offset)?;

    if dry {
        let query = diesel::debug_query::<Pg, _>(&sql).to_string();
        return Ok(HttpResponse::Ok().body(query));
    }

    let mut conn = db_pool.get().await?;
    let objects: Vec<SearchDBResult> = sql.load(&mut conn).await?;
    let results: Vec<_> = objects.into_iter().map(|r| r.result).collect();
    Ok(HttpResponse::Ok().json(results))
}
