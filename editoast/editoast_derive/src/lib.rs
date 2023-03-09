extern crate proc_macro;

mod error;
mod infra_model;
mod model;

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
/// ```
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
    let mut input = parse_macro_input!(input as DeriveInput);
    error::expand_editoast_error(&mut input)
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
    let mut input = parse_macro_input!(input as DeriveInput);
    model::model(&mut input)
        .unwrap_or_else(darling::Error::write_errors)
        .into()
}
