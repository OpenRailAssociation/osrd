//! A module that exposes all the Model traits and utils, but not the models themselves

mod create;
mod delete;
mod list;
mod retrieve;
mod update;

pub use create::*;
pub use delete::*;
pub use list::*;
pub use retrieve::*;
pub use update::*;

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
    type Row: Into<Self> + Send;
    type Changeset: Default + From<Self> + Send;
    type Table: diesel::Table + Send;

    /// Returns an empty changeset for this model
    fn changeset() -> Self::Changeset {
        Self::Changeset::default()
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
/// Helps silent compiler errors about type ambiguity.
#[allow(unused)]
pub type Row<M> = <M as Model>::Row;

/// A type alias for the [Model::Changeset] associated type
///
/// Helps silent compiler errors about type ambiguity.
pub type Changeset<M> = <M as Model>::Changeset;

pub trait Identifiable<T = i64>
where
    T: Clone,
{
    fn get_id(&self) -> T;
}

pub trait PreferredId<T>: Identifiable<T>
where
    T: Clone,
{
    fn id(&self) -> T {
        self.get_id()
    }
}

impl<T: diesel::Identifiable<Id = i64> + Clone> Identifiable for T {
    fn get_id(&self) -> i64 {
        self.clone().id()
    }
}
