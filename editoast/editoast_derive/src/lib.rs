extern crate proc_macro;

mod error;
mod infra_model;
mod model;
mod search;

use proc_macro::TokenStream;
use syn::{parse_macro_input, DeriveInput};

/// An InfraModel custom derive.
///
/// Usage: you should provide a diesel table path, like so
/// `#[infra_model(table = "crate::tables::osrd_infra_bufferstopmodel")]`
///
/// The type must be OSRDIdentified, and must be serializable
///
/// Provides a type impl with an insertion method, persist_batch
#[proc_macro_derive(InfraModel, attributes(infra_model))]
pub fn infra_model(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    infra_model::infra_model(input)
}

/// An EditoastError custom derive.
///
/// ### Usage
/// You must provide a `base_id` which will prefix each variant.
/// For a variant named `MyError`, this will generate error ids like `"editoast:myview:MyError"`.
/// You can provide a `default_status` that will apply to all variants (400 by default).
///
/// If your variant has nammed fields. They will be automatically added to the error context.
/// **Note:**
///
/// - Each field must be serializable.
/// - You can use the `#[editoast_error(no_context)]` disable this behavior.
///
/// You can also use `#[editoast_error(status = ???)]` for each variant, which will be the HTTP status code.
///
/// ### Example
///
/// ```ignore
/// #[derive(Debug, EditoastError)]
/// #[editoast_error(base_id = "myview", default_status = 404)]
/// enum MyError {
///   #[editoast_error(status = 400)]
///   MyFirstError,
///   MyErrorWithContext{ context: usize },
///   #[editoast_error(no_context)]
///   MyErrorWithoutContext{ context: usize },
/// }
/// ```
#[proc_macro_derive(EditoastError, attributes(editoast_error))]
pub fn error(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    error::expand_editoast_error(&input)
        .unwrap_or_else(darling::Error::write_errors)
        .into()
}

/// # A Model custom derive.
///
/// This derive provides implementations for common database operations traits.
///
/// ## Usage
///
/// You should provide a diesel table path, like so
/// ```#[model(table = "crate::tables::osrd_infra_project")]```
///
/// Then you can enable implementations like so:
/// ```#[model(retrieve, create, delete)]```
///
/// ## Available implementations
///
/// - **retrieve** (enable `Retrieve` trait)
///   - `retrieve(Data<DbPool>, i64) -> Result<Option<Self>>`
///   - `retrieve_conn(&mut PgConnection, i64) -> Result<Option<Self>>`
/// - **create** (enable `Create` trait)
///   - `create(self, Data<DbPool>) -> Result<Self>`
///   - `create_conn(self, &mut PgConnection) -> Result<Self>`
/// - **delete** (enable `Delete` trait)
///   - `delete(Data<DbPool>, i64) -> Result<bool>`
///   - `delete_conn(&mut PgConnection, i64) -> Result<bool>`
///
/// ## Requirements
///
/// The type must implements:
///   - Queryable (for **retrieve**)
///   - Insertable (for **create**)
#[proc_macro_derive(Model, attributes(model))]
pub fn model(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    model::model(&input)
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
///     table = "osrd_search_track",
///     column(name = "infra_id", data_type = "INT"),
///     column(name = "line_code", data_type = "INT"),
///     column(name = "line_name", data_type = "TEXT")
/// )]
/// struct Track {
///     #[search(sql = "osrd_search_track.infra_id")]
///     infra_id: i64,
///     #[search(sql = "osrd_search_track.unprocessed_line_name")]
///     line_name: String,
///     #[search(sql = "osrd_search_track.line_code")]
///     line_code: i64,
/// }
/// ```
///
/// ## Parameters
/// ### The `search()` derive macro
///
/// - **table** (required): the search table name in the database
/// - **joins** (optional): the joins to perform to build the response
/// - **name** (optional): the name of the search object (defaults to the struct name lowercase-d)
/// - **column** (0-*): a description of each search table column
///     - **name** (required): the column name in the database
///     - **data_type** (required): the column data type in the database
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
/// given a seach object name, returns the `SearchConfig` of the search object
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
#[proc_macro_derive(SearchConfigStore, attributes(search))]
pub fn search_config_store(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    search::expand_store(&input)
        .unwrap_or_else(darling::Error::write_errors)
        .into()
}
