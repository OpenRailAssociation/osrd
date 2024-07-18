//! A module that exposes all the ModelV2 traits and utils, but not the models themselves

mod create;
mod delete;
mod list;
mod retrieve;
mod update;

use std::marker::PhantomData;

pub use create::*;
pub use delete::*;
pub use list::*;
pub use retrieve::*;
pub use update::*;

use diesel::pg::Pg;
use diesel::AsChangeset;
use diesel::QueryableByName;

/// A struct that can be saved to and read from the database using diesel's interface
///
/// The `Self::Row` type is a struct that precisely maps the columns of the
/// table that represents this model. It's used to read the rows returned
/// by the SQL queries performed on this model.
///
/// The `Self::Changeset` type is a struct `Option`-ally maps the columns
/// of the table. It represents the values that might or might not be given
/// to an INSERT or UPDATE statement.
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
// FIXME: that Clone requirement is not necessary, see problematic line below
pub trait Model: std::fmt::Debug + Clone + Sized + Send {
    type Row: QueryableByName<Pg> + Into<Self> + Send;
    type Changeset: AsChangeset + Default + From<Self> + Send;
    type Table: diesel::Table + Send;

    /// Returns an empty changeset for this model
    fn changeset() -> Self::Changeset {
        Self::Changeset::default()
    }

    /// Returns an empty [Patch] referencing this instance of the model
    fn patch(&mut self) -> Patch<Self> {
        Patch {
            model: self,
            changeset: Self::Changeset::default(),
        }
    }

    fn into_changeset(self) -> Self::Changeset {
        self.into()
    }

    fn from_row(row: Self::Row) -> Self {
        row.into()
    }
}

/// A type alias for the [Model::Row] associated type
///
/// Helps silent compiler errors about type amibiguity.
#[allow(unused)]
pub type Row<M> = <M as Model>::Row;

/// A type alias for the [Model::Changeset] associated type
///
/// Helps silent compiler errors about type amibiguity.
#[allow(unused)]
pub type Changeset<M> = <M as Model>::Changeset;

/// A struct persisting the column and type information of each model field
///
/// This struct is instanciated by the `Model` derive macro and shouldn't be
/// used manually. The macro expansion also provides a few methods such as
/// `eq` or `asc` that can be used in conjunction with [SelectionSettings].
pub struct ModelField<M, T, Column>(PhantomData<(M, T, Column)>);

impl<M, T, Column> ModelField<M, T, Column> {
    pub(in crate::modelsv2) const fn new() -> Self {
        Self(PhantomData)
    }
}

/// Splits a query into chunks to accommodate libpq's maximum number of parameters
///
/// This is a hack around a libpq limitation (cf. <https://github.com/diesel-rs/diesel/issues/2414>).
/// The rows to process are split into chunks for which at most `2^16 - 1` parameters are sent to libpq.
/// Hence the macro needs to know how many parameters are sent per row.
/// The result of the chunked query is then concatenated into `result`, which must
/// implement `std::iter::Extend<RowType>`.
/// The chunked query is defined using a closure-like syntax. The argument of the "closure"
/// is a variable of type `&[ParameterType]`, and it must "return" a `Result<impl IntoIterator<Item = RowType>, E>`.
/// The values can be any type that implements `IntoIterator<Item = ParameterType>`.
///
/// # Example
///
/// ```
/// chunked_for_libpq! {
///     3, // 3 parameters are binded per row
///     values, // an iterator of parameters
///     Vec::new(), // the collection to extend with the result
///     chunk => { // chunk is a variable of type `&[ParameterType]`
///         diesel::insert_into(dsl::document)
///             .values(chunk)
///             .load_stream::<<Self as Model>::Row>(conn)
///             .await
///             .map(|s| s.map_ok(<Document as Model>::from_row).try_collect::<Vec<_>>())?
///             .await?
///         // returns a Result<Vec<RowType>, impl EditoastError>
///     } // (this is not a real closure)
/// }
/// ```
///
/// # On concurrency
///
/// There seem to be a problem with concurrent queries using deadpool, panicking with
/// 'Cannot access shared transaction state'. So this macro do not run each chunk's query concurrently.
/// While AsyncPgConnection supports pipelining, each query will be sent one after the other.
/// (But hey, it's still better than just making one query per row :p)
#[macro_export]
macro_rules! chunked_for_libpq {
    // Collects every chunk result into a vec
    ($parameters_per_row:expr, $limit:literal, $values:expr, $chunk:ident => $query:tt) => {{
        const LIBPQ_MAX_PARAMETERS: usize = 2_usize.pow(16) - 1;
        // We need to divide further because of AsyncPgConnection, maybe it is related to connection pipelining
        const ASYNC_SUBDIVISION: usize = 2_usize;
        const CHUNK_SIZE: usize = LIBPQ_MAX_PARAMETERS / ASYNC_SUBDIVISION / $parameters_per_row;
        let mut result = Vec::new();
        let chunks = $values.chunks(CHUNK_SIZE.min($limit));
        for $chunk in chunks {
            let chunk_result = $query;
            result.push(chunk_result);
        }
        result
    }};
    // Extends the result structure with every chunked query result
    ($parameters_per_row:expr, $limit:literal, $values:expr, $result:expr, $chunk:ident => $query:tt) => {{
        const LIBPQ_MAX_PARAMETERS: usize = 2_usize.pow(16) - 1;
        // We need to divide further because of AsyncPgConnection, maybe it is related to connection pipelining
        const ASYNC_SUBDIVISION: usize = 2_usize;
        const CHUNK_SIZE: usize = LIBPQ_MAX_PARAMETERS / ASYNC_SUBDIVISION / $parameters_per_row;
        let mut result = $result;
        let chunks = $values.chunks(CHUNK_SIZE.min($limit));
        for $chunk in chunks {
            let chunk_result = $query;
            result.extend(chunk_result);
        }
        result
    }};
}
