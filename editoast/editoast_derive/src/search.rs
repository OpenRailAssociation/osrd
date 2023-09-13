use std::sync::OnceLock;

use darling::{ast, util, Error, FromDeriveInput, FromField};
use darling::{FromMeta, Result};
use proc_macro2::TokenStream;
use quote::{quote, ToTokens};
use syn::punctuated::Punctuated;
use syn::token::Comma;
use syn::DeriveInput;

static mut SEARCH_STRUCTS: OnceLock<Vec<(String, String)>> = OnceLock::new();

#[derive(FromDeriveInput)]
#[darling(
    attributes(search),
    forward_attrs(allow, doc, cfg),
    supports(struct_named)
)]
struct SearchParams {
    table: String,
    #[darling(default)]
    name: Option<String>,
    #[darling(default)]
    joins: String,
    #[darling(multiple, rename = "column")]
    columns: Vec<SearchColumn>,

    // Magic fields
    data: ast::Data<util::Ignored, SearchField>,
}

#[derive(Debug, FromMeta)]
struct SearchColumn {
    name: String,
    data_type: String,
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

fn rust_or_sql_type_to_type_spec(rust_or_sql_type: &str) -> Option<TokenStream> {
    match rust_or_sql_type.to_lowercase().trim() {
        "bigint" | "int8" | "bigserial" | "serial8" | "integer" | "int" | "int4" | "smallint"
        | "int2" | "smallserial" | "serial2" | "serial" | "serial4" | "i8" | "u8" | "i16"
        | "u16" | "i32" | "u32" | "i64" | "u64" | "i128" | "u128" => Some(
            quote! { crate::views::search::TypeSpec::Type(crate::views::search::AstType::Integer) },
        ),
        "float" | "double" | "double precision" | "float8" | "numeric" | "decimal" | "real"
        | "float4" | "f8" | "f16" | "f32" | "f64" | "f128" => Some(
            quote! { crate::views::search::TypeSpec::Type(crate::views::search::AstType::Float) },
        ),
        "text" | "string" | "str" | "character varying" | "varchar" | "character" | "char" => Some(
            quote! { crate::views::search::TypeSpec::Type(crate::views::search::AstType::String) },
        ),
        "boolean" | "bool" => Some(
            quote! { crate::views::search::TypeSpec::Type(crate::views::search::AstType::Boolean) },
        ),
        "null" | "none" => Some(
            quote! { crate::views::search::TypeSpec::Type(crate::views::search::AstType::Null) },
        ),
        // handles VARCHAR(240), NUMERIC(4, 2), etc.
        prefix if prefix.contains('(') => {
            let (prefix, suffix) = prefix.split_once('(').unwrap();
            let suffix = suffix.trim_end_matches(')');
            match prefix {
                "array" | "vec" => {
                    let ts = rust_or_sql_type_to_type_spec(suffix).unwrap();
                    Some(quote! { crate::views::search::TypeSpec::Sequence(Box::new(#ts)) })
                }
                _ => rust_or_sql_type_to_type_spec(prefix),
            }
        }
        _ => None,
    }
}

pub fn expand_search(input: &DeriveInput) -> Result<TokenStream> {
    let params = SearchParams::from_derive_input(input)?;

    let struct_name = &input.ident;
    let table = params.table;
    let name = params
        .name
        .unwrap_or_else(|| struct_name.to_string().to_lowercase());
    let joins = match params.joins {
        joins if !joins.is_empty() => quote! { Some(#joins.to_owned()) },
        _ => quote! { None },
    };

    let mut criterias = Punctuated::<TokenStream, Comma>::new();
    for SearchColumn { name, data_type } in params.columns.iter() {
        let ts = rust_or_sql_type_to_type_spec(data_type).ok_or_else(|| {
            Error::custom(format!(
                "cannot translate SQL type '{data_type}' into a search engine-compatible type specifier"
            ))
        })?;
        criterias.push(
            quote! { crate::views::search::Criteria { name: #name.to_owned(), data_type: #ts, } },
        );
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
        let ts = match rust_or_sql_type_to_type_spec(&prop.type_string()) {
            Some(ts) => quote! { Some(#ts) },
            None => quote! { None },
        };
        let sql = prop.sql;
        properties.push(quote! { crate::views::search::Property {
            name: #name.to_owned(),
            sql: #sql.to_owned(),
            data_type: #ts,
        } });
    }

    // you can't stop me 😈
    unsafe {
        SEARCH_STRUCTS.get_or_init(Vec::new);
        SEARCH_STRUCTS
            .get_mut()
            .unwrap()
            .push((name.clone(), struct_name.to_string()));
    }
    Ok(quote! {
        impl crate::views::search::SearchObject for #struct_name {
            fn search_config() -> crate::views::search::SearchConfig {
                crate::views::search::SearchConfig {
                    name: #name.to_owned(),
                    table: #table.to_owned(),
                    joins: #joins,
                    criterias: vec![#criterias],
                    properties: vec![#properties],
                }
            }
        }
    })
}

pub fn expand_store(input: &DeriveInput) -> Result<TokenStream> {
    let name = &input.ident;
    let mut patterns = Punctuated::<TokenStream, Comma>::new();
    for (name, ident) in unsafe { SEARCH_STRUCTS.get() }.unwrap().iter() {
        let struct_ident = syn::Ident::new(ident, input.ident.span());
        patterns.push(quote! { #name => Some(< #struct_ident as crate::views::search::SearchObject > :: search_config()) });
    }
    patterns.push(quote! { _ => None });
    Ok(quote! {
        impl crate::views::search::SearchConfigStore for #name {
            fn find<S: AsRef<str>>(object_name: S) -> Option<crate::views::search::SearchConfig> {
                match object_name.as_ref() { #patterns }
            }
        }
    })
}

#[cfg(test)]
mod test {
    use darling::FromDeriveInput;
    use pretty_assertions::assert_eq;
    use quote::quote;

    use crate::search::{expand_search, SearchParams};

    use super::SearchField;

    fn track() -> syn::DeriveInput {
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
    }

    impl SearchField {
        fn to_tuple(&self) -> (String, String, String) {
            (
                self.ident_string().unwrap(),
                self.type_string(),
                self.sql.to_owned(),
            )
        }
    }

    #[test]
    fn test_construction() {
        let params = SearchParams::from_derive_input(&track()).unwrap();
        assert_eq!(&params.table, "search_track");
        assert!(&params.joins.is_empty());
        assert_eq!(
            params.columns.iter().map(|c| &c.name).collect::<Vec<_>>(),
            vec!["infra_id", "line_code", "line_name"]
        );
        assert_eq!(
            params
                .columns
                .iter()
                .map(|c| &c.data_type)
                .collect::<Vec<_>>(),
            vec!["INT", "INT", "TEXT"]
        );
        let tuples = params
            .data
            .take_struct()
            .unwrap()
            .fields
            .into_iter()
            .map(|p| p.to_tuple())
            .collect::<Vec<_>>();
        assert_eq!(
            tuples
                .iter()
                .map(|t| (t.0.as_ref(), t.1.as_ref(), t.2.as_ref()))
                .collect::<Vec<_>>(),
            vec![
                ("infra_id", "i64", "search_track.infra_id"),
                ("line_name", "String", "search_track.unprocessed_line_name"),
                ("code", "i64", "search_track.line_code")
            ]
        );
    }

    #[test]
    fn test_expansion() {
        let toks = expand_search(&track()).unwrap();
        let expected = quote! {
            impl crate::views::search::SearchObject for Track {
                fn search_config() -> crate::views::search::SearchConfig {
                    crate::views::search::SearchConfig {
                        name: "track".to_owned(),
                        table: "search_track".to_owned(),
                        joins: None,
                        criterias: vec![
                            crate::views::search::Criteria {
                                name: "infra_id".to_owned(),
                                data_type: crate::views::search::TypeSpec::Type(crate::views::search::AstType::Integer),
                            },
                            crate::views::search::Criteria {
                                name: "line_code".to_owned(),
                                data_type: crate::views::search::TypeSpec::Type(crate::views::search::AstType::Integer),
                            },
                            crate::views::search::Criteria {
                                name: "line_name".to_owned(),
                                data_type: crate::views::search::TypeSpec::Type(crate::views::search::AstType::String),
                            }
                        ],
                        properties: vec![
                            crate::views::search::Property {
                                name: "infra_id".to_owned(),
                                sql: "search_track.infra_id".to_owned(),
                                data_type: Some(crate::views::search::TypeSpec::Type(crate::views::search::AstType::Integer)),
                            },
                            crate::views::search::Property {
                                name: "line_name".to_owned(),
                                sql: "search_track.unprocessed_line_name".to_owned(),
                                data_type: Some(crate::views::search::TypeSpec::Type(crate::views::search::AstType::String)),
                            },
                            crate::views::search::Property {
                                name: "code".to_owned(),
                                sql: "search_track.line_code".to_owned(),
                                data_type: Some(crate::views::search::TypeSpec::Type(crate::views::search::AstType::Integer)),
                            }
                        ],
                    }
                }
            }
        };
        assert_eq!(toks.to_string(), expected.to_string());
    }
}
