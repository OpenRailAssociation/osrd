#![allow(clippy::manual_unwrap_or_default)]

use darling::Error;
use darling::FromDeriveInput;
use darling::FromField;
use darling::FromMeta;
use darling::Result;
use darling::ast;
use darling::util;
use proc_macro2::TokenStream;
use quote::ToTokens;
use quote::quote;
use syn::DeriveInput;
use syn::punctuated::Punctuated;
use syn::token::Comma;

#[derive(FromDeriveInput)]
#[darling(
    attributes(search),
    forward_attrs(allow, doc, cfg),
    supports(struct_named)
)]
struct SearchParams {
    table: String,
    #[darling(default)]
    distinct_on: Option<String>,
    migration: Option<Migration>,
    #[darling(default)]
    joins: String,
    #[darling(multiple, rename = "column")]
    columns: Vec<SearchColumn>,
    // Magic fields
    data: ast::Data<util::Ignored, SearchField>,
}

#[derive(Debug, FromMeta)]
struct Migration {
    src_table: String,
    src_primary_key: Option<String>,
    #[darling(default)]
    query_joins: String,
    prepend_sql: Option<SubMigration>,
    append_sql: Option<SubMigration>,
}

#[derive(Debug, FromMeta)]
struct SubMigration {
    #[darling(default)]
    up: String,
    #[darling(default)]
    down: String,
}

#[derive(Debug, FromMeta)]
struct SearchColumn {
    name: String,
    data_type: String,
    sql: Option<String>, // some search objects may not have a migration
    index: Option<bool>,
    #[darling(default)]
    textual_search: bool,
}

#[derive(Debug, FromField)]
#[darling(attributes(search), forward_attrs(allow, doc, cfg))]
struct SearchField {
    // Magic fields
    // Get the ident of the field. For fields in tuple or newtype structs or
    // enum bodies, this can be `None`.
    ident: Option<syn::Ident>,
    // This magic field name pulls the type from the input.
    ty: syn::Type,

    // Actual custom options
    sql: String,
    #[darling(default)]
    rename: Option<String>,
}

#[derive(PartialEq)]
enum ColumnType {
    Integer,
    Float,
    String,
    TextualSearchString,
    Boolean,
    Null,
    Sequence(Box<ColumnType>),
}

impl SearchField {
    fn type_string(&self) -> String {
        self.ty
            .clone()
            .into_token_stream()
            .into_iter()
            .last()
            .unwrap()
            .to_string()
    }

    fn ident_string(&self) -> Option<String> {
        self.rename
            .clone()
            .or_else(|| self.ident.clone().map(|id| id.to_string()))
    }
}

impl ColumnType {
    fn from_sql_type(sql_type: &str) -> Option<Self> {
        match sql_type.to_lowercase().trim() {
            "bigint" | "int8" | "bigserial" | "serial8" | "integer" | "int" | "int4"
            | "smallint" | "int2" | "smallserial" | "serial2" | "serial" | "serial4" => {
                Some(ColumnType::Integer)
            }
            "float" | "double" | "double precision" | "float8" | "numeric" | "decimal" | "real"
            | "float4" => Some(ColumnType::Float),
            "text" | "string" | "str" | "character varying" | "varchar" | "character" | "char" => {
                Some(ColumnType::String)
            }
            "boolean" | "bool" => Some(ColumnType::Boolean),
            "null" => Some(ColumnType::Null),
            // handles VARCHAR(240), NUMERIC(4, 2), etc.
            prefix if prefix.contains('(') => {
                let (prefix, _) = prefix.split_once('(').unwrap();
                ColumnType::from_sql_type(prefix)
            }
            array if array.ends_with(']') => {
                let elt = array.split_once('[').unwrap().0;
                Some(ColumnType::Sequence(Box::new(ColumnType::from_sql_type(
                    elt,
                )?)))
            }
            _ => None,
        }
    }

    fn to_type_spec(&self) -> TokenStream {
        match self {
            ColumnType::Integer => {
                quote! { search::TypeSpec::Type(search::AstType::Integer) }
            }
            ColumnType::Float => {
                quote! { search::TypeSpec::Type(search::AstType::Float) }
            }
            ColumnType::String | ColumnType::TextualSearchString => {
                quote! { search::TypeSpec::Type(search::AstType::String) }
            }
            ColumnType::Boolean => {
                quote! { search::TypeSpec::Type(search::AstType::Boolean) }
            }
            ColumnType::Null => {
                quote! { search::TypeSpec::Type(search::AstType::Null) }
            }
            ColumnType::Sequence(ct) => {
                let ts = ct.to_type_spec();
                quote! { search::TypeSpec::Sequence(Box::new(#ts)) }
            }
        }
    }

    fn index(&self) -> TokenStream {
        match self {
            ColumnType::TextualSearchString => quote! { search::Index::GinTrgm },
            _ => quote! { search::Index::Default },
        }
    }
}

pub fn expand_search(input: &DeriveInput) -> Result<TokenStream> {
    let params = SearchParams::from_derive_input(input)?;
    let has_migration = params.migration.is_some();

    let struct_name = &input.ident;
    let table = params.table;
    let distinct_on = params
        .distinct_on
        .map_or_else(|| quote! { None }, |d| quote! { Some(#d.to_owned()) });
    let joins = match params.joins {
        ref joins if !joins.is_empty() => quote! { Some(#joins.to_owned()) },
        _ => quote! { None },
    };

    let mut criterias = Punctuated::<TokenStream, Comma>::new();
    for SearchColumn {
        name,
        data_type,
        sql,
        index,
        textual_search,
    } in params.columns.iter()
    {
        let mut st = ColumnType::from_sql_type(data_type).ok_or_else(|| {
            Error::custom(format!(
                "cannot translate SQL type '{data_type}' into a search engine-compatible type specifier"
            ))
        })?;
        let ts = st.to_type_spec();
        let migration = if has_migration {
            let search_type = if *textual_search {
                if st != ColumnType::String {
                    return Err(Error::custom(format!(
                        "cannot perform textual search on non-text column '{name}'"
                    )));
                }
                st = ColumnType::TextualSearchString;
                quote! { search::SearchType::Textual }
            } else {
                quote! { search::SearchType::None }
            };
            let Some(sql) = sql else {
                return Err(Error::custom(format!(
                    "missing SQL query for search criteria '{name}'"
                )));
            };
            let index = if index.unwrap_or(true) {
                let index = st.index();
                quote! { Some(#index) }
            } else {
                quote! { None }
            };
            quote! {
                Some(search::CriteriaMigration {
                    sql_type: #data_type.to_owned(),
                    sql: #sql.to_owned(),
                    index: #index,
                    search_type: #search_type,
                })
            }
        } else {
            quote! { None }
        };
        criterias.push(quote! {
            search::Criteria {
                name: #name.to_owned(),
                data_type: #ts,
                migration: #migration,
            }
        });
    }

    let mut properties = Punctuated::<TokenStream, Comma>::new();
    for prop in params
        .data
        .take_struct()
        .expect("search derive macro only works on named structs")
        .into_iter()
    {
        let name = prop
            .ident_string()
            .expect("search derive macro only works on named structs");
        let ts = match ColumnType::from_sql_type(&prop.type_string()).map(|t| t.to_type_spec()) {
            Some(ts) => quote! { Some(#ts) },
            None => quote! { None },
        };
        let sql = prop.sql;
        properties.push(quote! { search::Property {
            name: #name.to_owned(),
            sql: #sql.to_owned(),
            data_type: #ts,
        } });
    }

    let migration = if let Some(Migration {
        src_table,
        src_primary_key,
        query_joins,
        prepend_sql,
        append_sql,
    }) = params.migration
    {
        let src_primary_key = src_primary_key.unwrap_or_else(|| "id".to_owned());
        let prepend = match prepend_sql {
            Some(SubMigration { up, down }) => quote! { Some((#up.to_owned(), #down.to_owned())) },
            None => quote! { None },
        };
        let append = match append_sql {
            Some(SubMigration { up, down }) => quote! { Some((#up.to_owned(), #down.to_owned())) },
            None => quote! { None },
        };
        quote! {
            Some(search::Migration {
                src_table: #src_table.to_owned(),
                src_primary_key: #src_primary_key.to_owned(),
                query_joins: #query_joins.to_owned(),
                prepend_sql: #prepend,
                append_sql: #append,
            })
        }
    } else {
        quote! { None }
    };
    Ok(quote! {
        impl search::SearchObject for #struct_name {
            fn search_config() -> search::SearchConfig {
                search::SearchConfig {
                    table: #table.to_owned(),
                    distinct_on: #distinct_on,
                    joins: #joins,
                    criterias: Vec::from([#criterias]),
                    properties: Vec::from([#properties]),
                    migration: #migration,
                }
            }
        }
    })
}

#[derive(FromDeriveInput)]
#[darling(
    attributes(search_config_store),
    forward_attrs(allow, doc, cfg),
    supports(struct_unit)
)]
struct SearchStoreParams {
    #[darling(default, multiple, rename = "object")]
    objects: Vec<SearchStoreObject>,
}

#[derive(FromMeta)]
struct SearchStoreObject {
    name: String,
    config: syn::Path,
}

pub fn expand_store(input: &DeriveInput) -> Result<TokenStream> {
    let name = &input.ident;
    let SearchStoreParams { objects } = SearchStoreParams::from_derive_input(input)?;
    if objects.is_empty() {
        return Err(Error::custom(
            "no search objects configured — this is likely a mistake",
        ));
    }
    let (object_name, ident): (Vec<_>, Vec<_>) = objects
        .iter()
        .map(|SearchStoreObject { name, config }| (name, config))
        .unzip();
    Ok(quote! {
        impl search::SearchConfigStore for #name {
            fn find<S: AsRef<str>>(object_name: S) -> Option<search::SearchConfig> {
                match object_name.as_ref() {
                    #(#object_name => Some(< #ident as search::SearchObject > :: search_config())),* ,
                    _ => None
                }
            }

            fn all() -> Vec<(&'static str, search::SearchConfig)> {
                Vec::from([#(
                    (
                        #object_name,
                        < #ident as search::SearchObject > :: search_config()
                    )
                ),*])
            }
        }

        #[derive(Serialize, ToSchema)]
        #[serde(untagged)]
        #[allow(unused, clippy::enum_variant_names)]
        /// A search result item that depends on the query's `object`
        pub(super) enum SearchResultItem {
            #(#ident(#ident)),*
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search_construction() {
        crate::assert_macro_expansion!(
            expand_search,
            syn::parse_quote! {
                #[search(
                    table = "search_track",
                    column(name = "infra_id", data_type = "INT"),
                    column(name = "line_code", data_type = "INT"),
                    column(name = "line_name", data_type = "TEXT")
                )]
                pub struct Track {
                    #[search(sql = "search_track.infra_id")]
                    infra_id: i64,
                    #[search(sql = "search_track.unprocessed_line_name")]
                    line_name: std::string::String,
                    #[search(sql = "search_track.line_code", rename = "code")]
                    line_code: i64,
                }
            }
        );
    }

    #[test]
    fn test_store_construction() {
        crate::assert_macro_expansion!(
            expand_store,
            syn::parse_quote! {
                #[derive(SearchConfigStore)]
                #[search_config_store(
                    object(name = "track", config = SearchResultItemTrack),
                    object(name = "operationalpoint", config = SearchResultItemOperationalPoint),
                    object(name = "signal", config = SearchResultItemSignal),
                    object(name = "project", config = SearchResultItemProject),
                    object(name = "study", config = SearchResultItemStudy),
                    object(name = "scenario", config = SearchResultItemScenario),
                    object(name = "trainschedule", config = SearchResultItemTrainSchedule),
                )]
                pub struct SearchStore;
            }
        );
    }
}
