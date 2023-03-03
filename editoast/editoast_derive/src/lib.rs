extern crate proc_macro;

mod error;
mod model;

use proc_macro::TokenStream;
use syn::{parse_macro_input, DeriveInput};

/// A Model custom derive.
///
/// Usage: you should provide a diesel table path, like so
/// `#[model(table = "crate::tables::osrd_infra_bufferstopmodel")]`
///
/// The type must be OSRDIdentified, and must be serializable
///
/// Provides a type impl with an insertion method, persist_batch
#[proc_macro_derive(Model, attributes(model))]
pub fn model(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    model::model(input)
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
