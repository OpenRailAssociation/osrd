extern crate proc_macro;

mod annotate_units;
mod error;
mod route;
mod search;
mod view_error;

use proc_macro::TokenStream;
use syn::DeriveInput;
use syn::parse_macro_input;

/// An EditoastError custom derive.
///
/// ### Usage
/// You must provide a `base_id` which will prefix each variant.
/// For a variant named `MyError`, this will generate error ids like `"editoast:my_view:MyError"`.
/// You can provide a `default_status` that will apply to all variants (400 by default).
///
/// If your variant has named fields. They will be automatically added to the error context.
/// **Note:**
///
/// - Each field must be serializable.
/// - You can use the `#[editoast_error(no_context)]` disable this behavior.
///
/// You can also use `#[editoast_error(status = ???)]` for each variant, which will be the HTTP status code.
///
/// Alternatively, you can use `#[editoast_error(forward)]` to forward the status code and type of an inner EditoastError.
/// That's only possible with a single field tuple variant.
///
/// ### Example
///
/// ```ignore
/// #[derive(Debug, EditoastError)]
/// #[editoast_error(base_id = "my_view", default_status = 404)]
/// enum MyError {
///   #[editoast_error(status = 400)]
///   MyFirstError,
///   MyErrorWithContext{ context: usize },
///   #[editoast_error(no_context)]
///   MyErrorWithoutContext{ context: usize },
///   #[editoast_error(forward)]
///   MyForwardedError(#[from] AnotherEditoastError),
/// }
/// ```
#[proc_macro_derive(EditoastError, attributes(editoast_error))]
pub fn error(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    error::expand_editoast_error(&input)
        .unwrap_or_else(darling::Error::write_errors)
        .into()
}

/// # A Search custom derive.
///
/// This derive provides the implementation of the description of a search object
/// the search engine can later use. This is a replacement of the late search.yml file.
///
/// ## Usage
///
/// ```ignore
/// #[derive(Search)]
/// #[search(
///     table = "search_track",
///     migration(src_table = "infra_object_track"),
///     column(name = "infra_id", data_type = "INT", sql = "infra_object_track.infra_id"),
///     column(name = "line_code", data_type = "INT", sql = "infra_object_track.line_code", index = false),
///     column(
///         name = "line_name",
///         data_type = "TEXT",
///         sql = "infra_object_track.line_name",
///         textual_search
///     )
/// )]
/// struct Track {
///     #[search(sql = "search_track.infra_id")]
///     infra_id: i64,
///     #[search(sql = "search_track.unprocessed_line_name")]
///     line_name: String,
///     #[search(sql = "search_track.line_code")]
///     line_code: i64,
/// }
/// ```
///
/// ## Parameters
/// ### The `search()` derive macro
///
/// - **table** (required): the search table name in the database
/// - **migration** (optional): the migration to perform to build the search table
///     - **src_table** (required): the source table name in the database
///     - **src_primary_key** (optional): the source table primary key name in the database, `"id"` by default
///     - **query_joins** (optional): the joins to perform to build the search table
///     - **prepend_sql** (optional): the SQL to prepend to the query
///         - **up** (required): the SQL to prepend to the query when migrating up
///         - **down** (required): the SQL to prepend to the query when migrating down
///     - **append_sql** (optional): the SQL to append to the query
///         - **up** (required): the SQL to append to the query when migrating up
///         - **down** (required): the SQL to append to the query when migrating down
/// - **joins** (optional): the joins to perform to build the response
/// - **name** (optional): the name of the search object (defaults to the struct name lowercase-d)
/// - **column** (0-*): a description of each search table column
///     - **name** (required): the column name in the database
///     - **data_type** (required): the SQL column type in the database
///     - **sql** (optional, required if **migration** is provided): the SQL query to perform to retrieve the data for the column in the search table
///     - **index** (optional): whether to create an index for the column in the search table (defaults to `true`)
///     - **textual_search** (optional): whether to create a textual search index for the column in the search table (defaults to `false`)
///
/// ### The `search()` attribute macro
///
/// - **sql** (required): the sql query to perform to retrieve the data to forward to the response
/// - **rename** (optional): the name of the field in the response (overrides the field name)
#[proc_macro_derive(Search, attributes(search))]
pub fn search(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    search::expand_search(&input)
        .unwrap_or_else(darling::Error::write_errors)
        .into()
}

/// # A SearchConfigStore custom derive.
///
/// This derive provides the implementation the `SearchConfigStore` trait.
/// Each struct that derives `Search` will be saved and the struct deriving
/// `SearchConfigStore` will implement a `find(name: &str)` function that
/// given a search object name, returns the `SearchConfig` of the search object
/// matching.
///
/// ```ignore
/// #[derive(Search)]
/// struct Foo;
///
/// #[derive(Search)]
/// struct Bar;
///
/// #[derive(SearchObjectStore)]
/// struct Store;
///
/// assert_eq!(Store::find("foo"), Some(Foo::search_config()));
/// assert_eq!(Store::find("bar"), Some(Bar::search_config()));
/// assert_eq!(Store::find("nope"), None);
/// ```
#[proc_macro_derive(SearchConfigStore, attributes(search_config_store))]
pub fn search_config_store(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    search::expand_store(&input)
        .unwrap_or_else(darling::Error::write_errors)
        .into()
}


/// Annotates fields of a structs with documentation and value_type for a better utoipa schema
///
/// It must be used on structs that use #[derive(ToSchema)]
///
/// On every field that has an attribute such as #[serde(with="millimeter")]
/// It will add:
/// * #[schema(value_type = f64)]
/// * /// Length in mm
#[proc_macro_attribute]
pub fn annotate_units(_attr: TokenStream, input: TokenStream) -> TokenStream {
    // We are using a macro attribute to modify in place the attributes of fields to annotate
    // This requires to mutate the input
    let mut input = parse_macro_input!(input as DeriveInput);
    annotate_units::annotate_units(&mut input)
        .unwrap_or_else(darling::Error::write_errors)
        .into()
}

/// Axum handlers must be annotated with this macro to tie them to their utoipa documentation
///
/// A role to be verified can be specified, in which case an additional role verification layer
/// is added to the handler.
///
/// Syntaxes:
/// * `#[editoast_derive::route]` — all roles are allowed
/// * `#[editoast_derive::route(authz::Role::Stdcm)]` — only `authz::Role::Stdcm` and `authz::Role::Admin`
#[proc_macro_attribute]
pub fn route(attr: TokenStream, input: TokenStream) -> TokenStream {
    let attr = proc_macro2::TokenStream::from(attr);
    let input = parse_macro_input!(input as syn::ItemFn);
    route::route(attr, &input)
        .unwrap_or_else(darling::Error::write_errors)
        .into()
}

#[proc_macro_derive(ViewError, attributes(view_error))]
pub fn view_error(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    view_error::view_error(&input)
        .unwrap_or_else(darling::Error::write_errors)
        .into()
}

#[cfg(test)]
use test_utils::assert_macro_expansion;

#[cfg(test)]
mod test_utils {
    pub(crate) fn pretty_tokens(tokens: &proc_macro2::TokenStream) -> String {
        let file = syn::parse_file(tokens.to_string().as_str()).unwrap();
        prettyplease::unparse(&file)
    }

    macro_rules! assert_macro_expansion {
        ($expansion:path, $derive_input:expr) => {
            let input: syn::DeriveInput = $derive_input;
            let source = crate::test_utils::pretty_tokens(&<syn::DeriveInput as quote::ToTokens>::to_token_stream(&input));
            let expansion = $expansion(&input).expect("macro should expand faultlessly");
            let expected = crate::test_utils::pretty_tokens(&expansion);

            // HACK: sadly insta doesn't let us print multiline strings in the snapshot description
            // or info sections. So we have to incorporate the source input into the snapshot content
            // in order to keep it pretty printed and next to its expansion.
            insta::with_settings!({
                omit_expression => true,
            }, {
                let sep = "-".repeat(77);
                insta::assert_snapshot!(format!("// Source\n// {sep}\n\n{source}\n// Macro expansion\n// {sep}\n\n{expected}"));
            });
        };
    }

    pub(crate) use assert_macro_expansion;
}
