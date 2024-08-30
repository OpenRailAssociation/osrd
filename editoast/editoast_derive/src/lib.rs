extern crate proc_macro;

mod error;
mod model;
mod modelv2;
mod search;

use proc_macro::TokenStream;
use syn::{parse_macro_input, DeriveInput};

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
/// ```#[model(table = "editoast_models::tables::project")]```
///
/// Then you can enable implementations like so:
/// ```#[model(retrieve, create, delete)]```
///
/// ## Available implementations
///
/// - **retrieve** (enable `Retrieve` trait)
///   - `retrieve(State<DbPool>, i64) -> Result<Option<Self>>`
///   - `retrieve_conn(&mut PgConnection, i64) -> Result<Option<Self>>`
/// - **create** (enable `Create` trait)
///   - `create(self, State<DbPool>) -> Result<Self>`
///   - `create_conn(self, &mut PgConnection) -> Result<Self>`
/// - **delete** (enable `Delete` trait)
///   - `delete(State<DbPool>, i64) -> Result<bool>`
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

/// # `ModelV2` derive macro
///
/// This derive macro provides implementations for common database operations traits.
///
/// ## Usage
///
/// ```ignore
/// #[derive(Debug, Default, Clone, ModelV2)]
/// #[model(table = editoast_models::tables::osrd_infra_document)]
/// pub struct Document {
///     pub id: i64,
///     pub content_type: String,
///     pub data: Vec<u8>,
/// }
/// ```
///
/// ## Generated content
///
/// This macro generates the following trait implementations and types for your given
/// Model struct `Model`:
///
/// * `struct ModelRow`: a struct nearly identical to your model by default, used to
///     read rows from the database
/// * `struct ModelChangeset`: a struct that represents a possibly incomplete
///     set of changes to apply to a row in the database
/// * `impl Model` that references both structs above
/// * `impl From<ModelRow> for Model`: a conversion from the row struct to your model
/// * `impl From<Model> for ModelChangeset`: a conversion from your model to the changeset
/// * `impl Identifiable<T> for Model` / `impl PreferredId<T> for Model` according to your model specifications,
///     more about that below
/// * `impl ModelChangeset`: that contains builder functions in order to conveniently
///     populate the changeset
/// * `impl Patch<'a, Model>`: the same builder functions as the changeset, but
///     for a `Patch` in order to have a better interface
/// * `impl Retrieve<T> for Model`: if `Model: Identifiable<T>`
/// * `impl Create<T, Model> for ModelChangeset`: if `Model: Identifiable<T>`
/// * `impl Update<T, Model> for ModelChangeset`: if `Model: Identifiable<T>`
/// * `impl Delete for Model`
/// * `impl DeleteStatic<T> for Model`: if `Model: Identifiable<T>`
/// * `impl RetrieveBatchUnchecked<T> for Model`: if `Model: Identifiable<T>`
/// * `impl UpdateBatchUnchecked<T, Model> for ModelChangeset`: if `Model: Identifiable<T>`
/// * `impl CreateBatch<T, ModelChangeset> for Model`: if `Model: Identifiable<T>`
/// * `impl DeleteBatch<T> for Model`: if `Model: Identifiable<T>`
///
/// ## Options
/// ### Struct-level options
///
/// * `#[model(table = crate::table::osrd_yourtable")]` (**REQUIRED**): the path to the diesel table
/// * `#[model(row(type_name = "YourRowType"))]`: the name of the row struct (defaults to `ModelRow`)
/// * `#[model(row(derive(ADDITIONAL_DERIVES*,)))]`: additional derives for the row struct (always implicitely derives `Queryable` and `QueryableByName`)
/// * `#[model(row(public))]`: make the row struct fields `pub` (private by default)
/// * `#[model(changeset(type_name = "YourChangesetType"))]`: the name of the changeset struct (defaults to `ModelChangeset`)
/// * `#[model(changeset(derive(ADDITIONAL_DERIVES*,)))]`: additional derives for the changeset struct (always implicitely derives `Default, Queryable, QueryableByName, AsChangeset, Insertable`)
/// * `#[model(changeset(public))]`: make the changeset struct fields `pub` (private by default)
/// * `#[model(identifier = IDENTIFIER)]` (multiple): just like `#[model(identifier)]` for fields, but at the struct level.
///     `IDENTIFIER` can be a compound identifier with the syntax `(field1, field2, ...)` (e.g.: `#[model(identifier = (infra_id, obj_id))]`).
///     This option can be specified multiple times. The same rules applies as for fields.
/// * `#[model(preferred = PREFERRED)]`: just like `#[model(preferred)]` for fields, but at the struct level.
///     Compound identifier syntax is supported. This option can be specified only once, including at field level.
///     It is NOT NECESSARY to also specify `#[model(identifier = PREFERRED)]`.
/// * `#[model(batch_chunk_size_limit = usize)]` (default: [modelv2::DEFAULT_BATCH_CHUNK_SIZE_LIMIT]): there seem to be a bug from either diesel or libpq that causes
///     a stack overflow for large batch chunk sizes. Until a better solution is found, this option allows to limit the
///     size of each chunk on a per-model basis. Increasing this value could lead to stack overflows, decreasing it
///     might degrade the performance of batch operations.
///
/// ### Field-level options
///
/// * `#[model(column = "COLUMN")]`: the name of the corresponding column in the database (defaults to the field name)
/// * `#[model(builder_fn = function_name)]`: the name of the builder function for this field (defaults to the field name)
/// * `#[model(builder_skip)]`: skip this field in the builder
/// * `#[model(identifier)]`: this field can be used to uniquely identify a the model row in the database ; generates `impl Identifiable<T> for Model`
///     This field will be excluded from the changeset and the changeset/patch builder.
/// * `#[model(preferred)]`: implies `identifier` ; also generates `impl PreferredId<T> for Model`
/// * `#[model(primary)]`: implies `identifier` ; marks the field as the primary key of the table
/// * `#[model(json)]`: wraps the row field with `diesel_jsonb::JsonValue` (diesel column type: `diesel_jsonb::Json<T>`)
/// * `#[model(to_string)]`: calls `to_string()` before writing the field to the database and calls `String::from` after reading (diesel column type: String)
/// * `#[model(to_enum)]`: is converted as `u8` before writing the field to the database and calls `FromRepr::from_repr` after reading (diesel column type: TinyInt)
/// * `#[model(remote = "T")]`: calls `Into::<T>::into` before writing the field to the database and calls `T::from` after reading (diesel column type: T)
/// * `#[model(geo)]` **TODO**: TBD
///
/// #### A note on identifiers
///
/// * *When no `primary` field is specified*, if there is a field named `id`,
///     *it will be assumed to be the primary key* regardless of its type
/// * Every model **MUST** have a `primary` field (explicit or not)
/// * There can only be one `primary` field
/// * The `primary` field **MUST** be represent the column of the primary key in the database
///    and be the `diesel_table::PrimaryKey`
/// * There can only be one `preferred` field
/// * If no `preferred` field is provided, the `primary` field will be used
/// * There can be as many `identifier` fields as you want (as long as it makes sense ofc)
#[proc_macro_derive(ModelV2, attributes(model))]
pub fn model_v2(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    modelv2::model(&input)
        .unwrap_or_else(darling::Error::write_errors)
        .into()
}
