// Clippy doesn't seem to understand the `Search` derive macro
#![allow(clippy::duplicated_attributes)]

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
//! and converted to a [editoast_search::SearchAst] which is a formalization of the AST.
//!
//! See [editoast_search::searchast].
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
//! The structure that represents that context is [editoast_search::QueryContext] which provides
//! the function [editoast_search::QueryContext::typecheck_search_query()]. The functions the
//! route [search] uses are defined by [editoast_search::create_processing_context()] and
//! the columns defined in the `search.yml` configuration file are added to
//! that context.
//!
//! If the query typechecks in that particular context, it can be evaluated.
//!
//! # Evaluation
//!
//! In order to turn the ✨typechecked✨ query into an SQL statement, it is "evaluated"
//! within a [editoast_search::QueryContext] ; which contains several things:
//!
//! - The list of expected columns and their type. That data is extracted from `search.yml`.
//! - The name of the search table (e.g.: `search_operational_point`). That
//!     information is useful to prevent ambiguities in the SQL query because of
//!     column name conflicts.
//! - The list of functions (or operators) the query can use, their type signatures
//!   (with possible overloads) and their definition.
//!
//! The transformation of the search expression into a valid SQL query occurs
//! in [editoast_search::QueryContext::search_ast_to_sql()], which will evaluate every function call,
//! each one using the input arguments to build an SQL expression that will
//! be part of the final SQL query.
//!
//! # SQL query construction and execution
//!
//! The evaluation step produces an [editoast_search::sqlquery::SqlQuery] object that can
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

use std::ops::DerefMut;

use axum::extract::Json;
use axum::extract::Query;
use axum::extract::State;
use axum::Extension;
use chrono::NaiveDateTime;
use diesel::pg::Pg;
use diesel::sql_query;
use diesel::sql_types::Jsonb;
use diesel::sql_types::Text;
use diesel::QueryableByName;
use diesel_async::RunQueryDsl;
use editoast_authz::BuiltinRole;
use editoast_common::geometry::GeoJsonPoint;
use editoast_derive::EditoastError;
use editoast_derive::Search;
use editoast_derive::SearchConfigStore;
use editoast_search::query_into_sql;
use editoast_search::SearchConfigStore as _;
use editoast_search::SearchError;
use serde::Deserialize;
use serde::Serialize;
use serde_json::value::Value as JsonValue;
use std::collections::HashSet;
use utoipa::ToSchema;

use crate::error::Result;
use crate::views::pagination::PaginationQueryParam;
use crate::views::AuthorizationError;
use crate::views::AuthorizerExt;
use editoast_models::DbConnectionPoolV2;

crate::routes! {
    "/search" => search,
}

editoast_common::schemas! {
    SearchPayload,
    SearchQuery,
    SearchResultItem::schemas(),
}

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "search")]
enum SearchApiError {
    #[error("object type '{object_type}' is invalid")]
    ObjectType { object_type: String },
    #[error(transparent)]
    SearchEngineError(#[from] SearchError),
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
    ///
    /// Only available in debug builds.
    #[serde(default)]
    dry: bool,
}

#[derive(QueryableByName)]
struct SearchDBResult {
    #[diesel(sql_type = Jsonb)]
    result: diesel_json::Json<serde_json::Value>,
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
/// - `query` is a JSON document which can be deserialized into a [editoast_search::SearchAst].
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
/// See [editoast_search::create_processing_context()].
///
/// # A few query examples
///
/// * The railway station PNO: `["=", ["trigram"], "pno"]`
/// * The railway stations with either "Paris" or "Lyon" (or both) in their name:
///   `["or", ["search", ["name"], "Paris"], ["search", ["name"], "Lyon"]]`
/// * All railway stations with "Paris" in their name but not PNO :
///   `["and", ["search", ["name"], "Paris"], ["not", ["=", ["trigram"], "pno"]]]`
///
/// See [editoast_search::SearchAst] for a more detailed view of the query language.
#[utoipa::path(
    post, path = "",
    tag = "search",
    params(PaginationQueryParam),
    request_body = SearchPayload,
    responses(
        (status = 200, body = Vec<SearchResultItem>, description = "The search results"),
    )
)]
async fn search(
    State(db_pool): State<DbConnectionPoolV2>,
    Extension(authorizer): AuthorizerExt,
    Query(query_params): Query<PaginationQueryParam>,
    Json(SearchPayload { object, query, dry }): Json<SearchPayload>,
) -> Result<Json<serde_json::Value>> {
    let roles: HashSet<BuiltinRole> = match object.as_str() {
        "track" | "operationalpoint" | "signal" => HashSet::from([BuiltinRole::InfraRead]),
        "project" | "study" | "scenario" => HashSet::from([BuiltinRole::OpsRead]),
        _ => {
            return Err(SearchApiError::ObjectType {
                object_type: object.to_owned(),
            }
            .into())
        }
    };

    let authorized = authorizer
        .check_roles(roles)
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let (page, per_page) = query_params.validate(1000)?.warn_page_size(100).unpack();
    let search_config =
        SearchConfigFinder::find(&object).ok_or_else(|| SearchApiError::ObjectType {
            object_type: object.to_owned(),
        })?;
    let offset = (page - 1) * per_page;
    let (sql, bindings) = query_into_sql(query, &search_config, per_page, offset, "result")
        .map_err(SearchApiError::from)?;

    let mut query = sql_query(sql).into_boxed();
    for string in bindings {
        query = query.bind::<Text, _>(string.to_owned());
    }

    if cfg!(debug_assertions) && dry {
        tracing::debug!("not running query");
        let query = diesel::debug_query::<Pg, _>(&query).to_string();
        return Ok(Json(serde_json::to_value(query).unwrap()));
    }

    let objects = query
        .load::<SearchDBResult>(&mut db_pool.get().await?.write().await.deref_mut())
        .await?;
    let results: Vec<_> = objects.into_iter().map(|r| r.result).collect();
    Ok(Json(serde_json::to_value(results).unwrap()))
}

// NOTE: every structure deriving `Search` here might have to `#[allow(unused)]`
// because while the name and type information of the fields are read by the macro,
// they might not be explicitly used in the code. (Their JSON representation extracted
// from the DB query is direcly forwarded into the endpoint response, so these
// structs are never deserialized, hence their "non-usage".)
//
// These structs also derive Serialize because utoipa reads some `#[serde(...)]`
// annotations to alter the schema. That's not ideal since none of them are ever
// serialized, but that's life.

#[derive(Search, Serialize, ToSchema)]
#[search(
    table = "search_track",
    column(name = "infra_id", data_type = "INT"),
    column(name = "line_code", data_type = "INT"),
    column(name = "line_name", data_type = "TEXT")
)]
#[allow(unused)]
/// A search result item for a query with `object = "track"`
///
// **IMPORTANT**: Please note that any modification to this struct should be reflected in [crate::models::infra::Infra::clone]
pub(super) struct SearchResultItemTrack {
    #[search(sql = "search_track.infra_id")]
    infra_id: i64,
    #[search(sql = "search_track.unprocessed_line_name")]
    line_name: String,
    #[search(sql = "search_track.line_code")]
    line_code: i64,
}

#[derive(Search, Serialize, ToSchema)]
#[search(
    table = "search_operational_point",
    migration(src_table = "infra_object_operational_point"),
    joins = "
        INNER JOIN infra_object_operational_point AS OP ON OP.id = search_operational_point.id
        INNER JOIN (SELECT DISTINCT ON (infra_id, obj_id) * FROM infra_layer_operational_point)
            AS lay ON OP.obj_id = lay.obj_id AND OP.infra_id = lay.infra_id",
    column(
        name = "obj_id",
        data_type = "varchar(255)",
        sql = "infra_object_operational_point.obj_id",
    ),
    column(
        name = "infra_id",
        data_type = "integer",
        sql = "infra_object_operational_point.infra_id",
    ),
    column(
        name = "uic",
        data_type = "integer",
        sql = "(infra_object_operational_point.data->'extensions'->'identifier'->>'uic')::integer",
    ),
    column(
        name = "trigram",
        data_type = "varchar(3)",
        sql = "infra_object_operational_point.data->'extensions'->'sncf'->>'trigram'",
    ),
    column(
        name = "ci",
        data_type = "integer",
        sql = "(infra_object_operational_point.data->'extensions'->'sncf'->>'ci')::integer",
    ),
    column(
        name = "ch",
        data_type = "text",
        sql = "infra_object_operational_point.data->'extensions'->'sncf'->>'ch'",
    ),
    column(
        name = "name",
        data_type = "text",
        sql = "infra_object_operational_point.data->'extensions'->'identifier'->>'name'",
        textual_search,
    )
)]
#[allow(unused)]
/// A search result item for a query with `object = "operationalpoint"`
///
// **IMPORTANT**: Please note that any modification to this struct should be reflected in [crate::models::infra::Infra::clone]
pub(super) struct SearchResultItemOperationalPoint {
    #[search(sql = "OP.obj_id")]
    obj_id: String,
    #[search(sql = "OP.infra_id")]
    infra_id: i64,
    #[search(sql = "OP.data->'extensions'->'identifier'->'uic'")]
    uic: i64,
    #[search(sql = "OP.data#>>'{extensions,identifier,name}'")]
    name: String,
    #[search(sql = "OP.data#>>'{extensions,sncf,trigram}'")]
    trigram: String,
    #[search(sql = "OP.data#>>'{extensions,sncf,ch}'")]
    ch: String,
    #[search(sql = "OP.data#>>'{extensions,sncf,ci}'")]
    ci: u64,
    #[search(sql = "ST_AsGeoJSON(ST_Transform(lay.geographic, 4326))::json")]
    geographic: GeoJsonPoint,
    #[search(sql = "OP.data->'parts'")]
    #[schema(inline)]
    track_sections: Vec<SearchResultItemOperationalPointTrackSections>,
}
#[derive(Serialize, ToSchema)]
#[allow(unused)]
pub(super) struct SearchResultItemOperationalPointTrackSections {
    track: String,
    position: f64,
}

#[derive(Search, Serialize, ToSchema)]
#[search(
    table = "search_signal",
    migration(
        src_table = "infra_object_signal",
        query_joins = "
            INNER JOIN infra_object_track_section AS track_section
            ON track_section.infra_id = infra_object_signal.infra_id
                AND track_section.obj_id = infra_object_signal.data->>'track'",
    ),
    column(
        name = "label",
        data_type = "text",
        sql = "infra_object_signal.data->'extensions'->'sncf'->>'label'",
        textual_search
    ),
    column(
        name = "line_name",
        data_type = "text",
        sql = "track_section.data->'extensions'->'sncf'->>'line_name'",
        textual_search
    ),
    column(
        name = "infra_id",
        data_type = "integer",
        sql = "infra_object_signal.infra_id"
    ),
    column(
        name = "obj_id",
        data_type = "VARCHAR(255)",
        sql = "infra_object_signal.obj_id"
    ),
    column(
        name = "signaling_systems",
        data_type = "TEXT[]",
        sql = "ARRAY(SELECT jsonb_path_query(infra_object_signal.data, '$.logical_signals[*].signaling_system')->>0)"
    ),
    column(
        name = "settings",
        data_type = "TEXT[]",
        sql = "ARRAY(SELECT jsonb_path_query(infra_object_signal.data, '$.logical_signals[*].settings.keyvalue().key')->>0)"
    ),
    column(
        name = "line_code",
        data_type = "integer",
        sql = "(track_section.data->'extensions'->'sncf'->>'line_code')::integer"
    ),
    joins = "
        INNER JOIN infra_object_signal AS sig ON sig.id = search_signal.id
        INNER JOIN infra_object_track_section AS track_section ON track_section.obj_id = sig.data->>'track' AND track_section.infra_id = sig.infra_id
        INNER JOIN infra_layer_signal AS lay ON lay.infra_id = sig.infra_id AND lay.obj_id = sig.obj_id"
)]
#[allow(unused)]
/// A search result item for a query with `object = "signal"`
///
// **IMPORTANT**: Please note that any modification to this struct should be reflected in [crate::models::infra::Infra::clone]
pub(super) struct SearchResultItemSignal {
    #[search(sql = "sig.infra_id")]
    infra_id: i64,
    #[search(sql = "sig.data->'extensions'->'sncf'->>'label'")]
    label: String,
    #[search(sql = "search_signal.signaling_systems")]
    signaling_systems: Vec<String>,
    #[search(sql = "search_signal.settings")]
    settings: Vec<String>,
    #[search(sql = "search_signal.line_code")]
    line_code: u64,
    #[search(sql = "track_section.data->'extensions'->'sncf'->>'line_name'")]
    line_name: String,
    #[search(sql = "ST_AsGeoJSON(ST_Transform(lay.geographic, 4326))::json")]
    geographic: GeoJsonPoint,
    #[search(sql = "lay.signaling_system")]
    sprite_signaling_system: Option<String>,
    #[search(sql = "lay.sprite")]
    sprite: Option<String>,
}

#[derive(Search, Serialize, ToSchema)]
#[search(
    table = "search_project",
    joins = "INNER JOIN project ON project.id = search_project.id",
    column(name = "id", data_type = "integer"),
    column(name = "name", data_type = "string"),
    column(name = "description", data_type = "string"),
    column(name = "tags", data_type = "string")
)]
#[allow(unused)]
/// A search result item for a query with `object = "project"`
pub(super) struct SearchResultItemProject {
    #[search(sql = "project.id")]
    id: u64,
    #[search(sql = "project.image_id")]
    #[schema(required)]
    image: Option<u64>,
    #[search(sql = "project.name")]
    name: String,
    #[search(
        sql = "(SELECT COUNT(study.id) FROM study WHERE search_project.id = study.project_id)"
    )]
    studies_count: u64,
    #[search(sql = "project.description")]
    description: String,
    #[search(sql = "project.last_modification")]
    last_modification: NaiveDateTime,
    #[search(sql = "project.tags")]
    tags: Vec<String>,
}

#[derive(Search, Serialize, ToSchema)]
#[search(
    table = "search_study",
    migration(src_table = "study"),
    joins = "INNER JOIN study ON study.id = search_study.id",
    column(name = "name", data_type = "TEXT", sql = "study.name"),
    column(name = "description", data_type = "TEXT", sql = "study.description"),
    column(
        name = "tags",
        data_type = "TEXT",
        sql = "osrd_prepare_for_search_tags(study.tags)"
    ),
    column(name = "project_id", data_type = "INTEGER", sql = "study.project_id")
)]
#[allow(unused)]
/// A search result item for a query with `object = "study"`
pub(super) struct SearchResultItemStudy {
    #[search(sql = "study.id")]
    id: u64,
    #[search(sql = "study.project_id")]
    project_id: u64,
    #[search(sql = "study.name")]
    name: String,
    #[search(
        sql = "(SELECT COUNT(scenario.id) FROM scenario WHERE search_study.id = scenario.study_id)"
    )]
    scenarios_count: u64,
    #[search(sql = "study.description")]
    #[schema(required)]
    description: Option<String>,
    #[search(sql = "study.last_modification")]
    last_modification: NaiveDateTime,
    #[search(sql = "study.tags")]
    tags: Vec<String>,
    #[search(sql = "study.budget")]
    #[schema(required)]
    budget: Option<u32>,
}

#[derive(Search, Serialize, ToSchema)]
#[search(
    table = "search_scenario",
    joins = "
        INNER JOIN scenario ON scenario.id = search_scenario.id
        INNER JOIN infra ON infra.id = scenario.infra_id",
    column(name = "id", data_type = "integer"),
    column(name = "name", data_type = "string"),
    column(name = "description", data_type = "string"),
    column(name = "tags", data_type = "string"),
    column(name = "study_id", data_type = "integer")
)]
#[allow(unused)]
/// A search result item for a query with `object = "scenario"`
pub(super) struct SearchResultItemScenario {
    #[search(sql = "scenario.id")]
    id: u64,
    #[search(sql = "scenario.study_id")]
    study_id: u64,
    #[search(sql = "scenario.name")]
    name: String,
    #[search(sql = "scenario.electrical_profile_set_id")]
    #[schema(required)]
    electrical_profile_set_id: Option<u64>,
    #[search(sql = "scenario.infra_id")]
    infra_id: u64,
    #[search(sql = "infra.name")]
    infra_name: String,
    #[search(
        sql = "(SELECT COUNT(trains.id) FROM train_schedule AS trains WHERE scenario.timetable_id = trains.timetable_id)"
    )]
    trains_count: u64,
    #[search(sql = "scenario.description")]
    description: String,
    #[search(sql = "scenario.last_modification")]
    last_modification: NaiveDateTime,
    #[search(sql = "scenario.tags")]
    tags: Vec<String>,
}

/// See [editoast_search::SearchConfigStore::find]
#[derive(SearchConfigStore)]
#[search_config_store(
    object(name = "track", config = SearchResultItemTrack),
    object(name = "operationalpoint", config = SearchResultItemOperationalPoint),
    object(name = "signal", config = SearchResultItemSignal),
    object(name = "project", config = SearchResultItemProject),
    object(name = "study", config = SearchResultItemStudy),
    object(name = "scenario", config = SearchResultItemScenario),
)]
pub struct SearchConfigFinder;
