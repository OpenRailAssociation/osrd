use itertools::Itertools;
use utoipa::ToSchema;

use super::typing::TypeSpec;

pub struct Criteria {
    pub name: String,
    pub data_type: TypeSpec,
    pub migration: Option<CriteriaMigration>,
}

pub struct Property {
    pub name: String,
    pub sql: String,
    #[allow(unused)]
    pub data_type: Option<TypeSpec>,
}

pub struct SearchConfig {
    pub name: String,
    pub table: String,
    pub criterias: Vec<Criteria>,
    pub properties: Vec<Property>,
    pub joins: Option<String>,
    pub migration: Option<Migration>,
}

pub struct Migration {
    pub src_table: String,
    pub src_primary_key: String,
    pub query_joins: String,
    pub prepend_sql: Option<(String, String)>,
    pub append_sql: Option<(String, String)>,
}

pub struct CriteriaMigration {
    pub sql_type: String,
    pub sql: String,
    pub index: Option<Index>,
    pub search_type: SearchType,
}

pub enum Index {
    Default,
    GinTrgm,
}

pub enum SearchType {
    None,
    Textual,
}

pub trait SearchObject: ToSchema<'static> {
    fn search_config() -> SearchConfig;
}

pub trait SearchConfigStore {
    /// Returns the search object configuration for the given object name
    ///
    /// See derive macro `SearchConfigStore` for more information.
    fn find<S: AsRef<str>>(object_name: S) -> Option<SearchConfig>;

    /// Returns the search object configurations of all objects in the store
    fn all() -> Vec<SearchConfig>;
}

impl SearchConfig {
    pub fn make_up_down(&self) -> (String, String) {
        let Migration {
            src_table,
            src_primary_key: pk,
            query_joins,
            prepend_sql,
            append_sql,
        } = self
            .migration
            .as_ref()
            .expect("no migration for search config");
        let table = &self.table;
        let (columns, create_columns, select_terms, set_columns, indexes) = {
            let mut columns = Vec::new();
            let mut create_columns = Vec::new();
            let mut select_terms = Vec::new();
            let mut set_columns = Vec::new();
            let mut indexes = Vec::new();
            for criteria in &self.criterias {
                if let Some(migration) = &criteria.migration {
                    columns.push(criteria.name.clone());
                    create_columns.push(format!("\"{}\" {}", criteria.name, migration.sql_type));
                    let sql = match migration.search_type {
                        SearchType::None => format!("({})", migration.sql),
                        SearchType::Textual => {
                            format!("osrd_prepare_for_search({})", migration.sql)
                        }
                    };
                    select_terms.push(format!("{sql} AS {}", criteria.name));
                    set_columns.push(format!("\"{}\" = {sql}", criteria.name));
                    if let Some(index) = &migration.index {
                        indexes.push(index.make_decl(
                            &format!("{}_{}", table, criteria.name),
                            table,
                            &criteria.name,
                        ));
                    }
                }
            }
            (
                columns.join(", "),
                create_columns.join(",\n    "),
                select_terms.join(",\n    "),
                set_columns.join(",\n        "),
                indexes.join("\n"),
            )
        };
        let insert_trigger_name = format!("{table}__ins_trig");
        let update_trigger_name = format!("{table}__upd_trig");
        let insert_trigger_function = format!("{table}__ins_trig_fun");
        let update_trigger_function = format!("{table}__upd_trig_fun");
        let insert_trigger = format!(
            include_str!("sql/insert_trigger_template.sql"),
            trigger = insert_trigger_name,
            search_table = table,
            insert_columns = columns,
            select_columns = select_terms,
            joins = query_joins,
            source_table = src_table,
        );
        let update_trigger = format!(
            include_str!("sql/update_trigger_template.sql"),
            trigger = update_trigger_name,
            search_table = table,
            set_columns = set_columns,
            joins = query_joins,
            source_table = src_table,
        );
        let refresh_table = self.refresh_table_sql();
        let (prepend_up, prepend_down) = match prepend_sql {
            Some((up, down)) => (format!("{up}\n\n"), format!("{down}\n\n")),
            None => ("".to_string(), "".to_string()),
        };
        let (append_up, append_down) = match append_sql {
            Some((up, down)) => (format!("\n\n{up}"), format!("\n\n{down}")),
            None => ("".to_string(), "".to_string()),
        };
        let up = format!(
            r#"-- DO NOT EDIT THIS FILE MANUALLY!
-- To change the migration's content, use `editoast search make-migration`.
-- To add custom SQL code, check out `#[derive(Search)]` attributes `prepend_sql` and `append_sql`.
{prepend_up}
DROP TABLE IF EXISTS "{table}";

CREATE TABLE "{table}" (
    id BIGINT PRIMARY KEY REFERENCES "{src_table}"("{pk}") ON UPDATE CASCADE ON DELETE CASCADE,
    {create_columns}
);

{indexes}

{insert_trigger}

{update_trigger}

{refresh_table}
{append_up}"#
        );
        let down = format!(
            r#"-- DO NOT EDIT THIS FILE MANUALLY!
{prepend_down}
DROP TABLE IF EXISTS "{table}";
DROP TRIGGER IF EXISTS {insert_trigger_name} ON "{src_table}";
DROP TRIGGER IF EXISTS {update_trigger_name} ON "{src_table}";
DROP FUNCTION IF EXISTS {insert_trigger_function};
DROP FUNCTION IF EXISTS {update_trigger_function};
{append_down}"#
        );
        (up, down)
    }

    fn select_terms(&self) -> String {
        let mut terms = Vec::new();
        for criteria in &self.criterias {
            if let Some(migration) = &criteria.migration {
                let sql = match migration.search_type {
                    SearchType::None => format!("({})", migration.sql),
                    SearchType::Textual => {
                        format!("osrd_prepare_for_search({})", migration.sql)
                    }
                };
                terms.push(format!("{sql} AS {}", criteria.name));
            }
        }
        terms.join("\n,    ")
    }

    pub fn has_migration(&self) -> bool {
        self.migration.is_some()
    }

    pub fn clear_sql(&self) -> String {
        format!("DELETE FROM \"{table}\";", table = self.table)
    }

    pub fn refresh_table_sql(&self) -> String {
        let Migration {
            src_table,
            src_primary_key: pk,
            query_joins,
            ..
        } = self
            .migration
            .as_ref()
            .expect("no migration for search config");
        let table = &self.table;
        let cache_columns = self
            .criterias
            .iter()
            .map(|c| format!("\"{}\"", c.name))
            .collect_vec()
            .join(", ");
        let select_terms = self.select_terms();
        format!(
            r#"
INSERT INTO "{table}" (id, {cache_columns})
SELECT
    "{src_table}"."{pk}" AS id,
    {select_terms}
FROM "{src_table}"
    {query_joins};"#
        )
    }
}

impl Index {
    fn make_decl(&self, name: &str, table: &str, column: &str) -> String {
        match self {
            Index::Default => format!("CREATE INDEX \"{name}\" ON \"{table}\" (\"{column}\");"),
            Index::GinTrgm => {
                format!(
                    "CREATE INDEX \"{name}\" ON \"{table}\" USING gin (\"{column}\" gin_trgm_ops);"
                )
            }
        }
    }
}