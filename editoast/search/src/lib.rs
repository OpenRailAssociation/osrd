pub mod context;
pub mod dsl;
pub mod process;
pub mod search_object;
pub mod searchast;
pub mod sqlquery;
pub mod typing;

// TODO: figure out public api, such visibility is not needed, much wow

pub use context::*;
pub use process::*;
pub use search_object::*;
pub use searchast::*;
pub use sqlquery::*;
pub use typing::*;

#[derive(Debug, thiserror::Error)]
pub enum SearchError {
    #[error("object type '{object_type}' is invalid")]
    ObjectType { object_type: String },
    #[error("query has type '{query_type}' but Boolean is expected")]
    QueryAst { query_type: String },
    #[error(transparent)]
    TypeCheckError(#[from] TypeCheckError),
    #[error(transparent)]
    ProcessingError(#[from] ProcessingError),
    #[error(transparent)]
    SearchAstError(#[from] SearchAstError),
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

pub fn query_into_sql(
    query: serde_json::Value,
    search_config: &SearchConfig,
    limit: i64,
    offset: i64,
    column_name: &'static str,
) -> Result<(String, Vec<String>), SearchError> {
    let ast = SearchAst::build_ast(query)?;
    let context = search_config.create_context();
    let search_ast_expression_type = context.typecheck_search_query(&ast)?;
    if !AstType::Boolean.is_supertype_spec(&search_ast_expression_type) {
        return Err(SearchError::QueryAst {
            query_type: search_ast_expression_type.to_string(),
        });
    }
    let where_expression = context.search_ast_to_sql(&ast)?;
    let table = &search_config.table;
    let select = search_config.distinct_on.as_ref().map_or_else(
        || "SELECT".to_owned(),
        |columns| format!("SELECT DISTINCT ON {columns}"),
    );
    let joins = search_config.joins.as_ref().cloned().unwrap_or_default();
    let result_columns = search_config.result_columns();
    let mut bindings = Default::default();
    let constraints = where_expression.to_sql(&mut bindings);
    let sql_code = format!(
        "WITH _RESULT AS (
            {select} {result_columns}
            FROM {table}
            {joins}
            WHERE {constraints}
            LIMIT {limit} OFFSET {offset}
        )
        SELECT to_jsonb(_RESULT) AS {column_name}
        FROM _RESULT"
    );
    Ok((sql_code, bindings))
}
