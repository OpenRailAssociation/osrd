pub mod documents;

pub use documents::Document;

use async_trait::async_trait;
use diesel::{pg::Pg, result::Error::NotFound, AsChangeset, QueryableByName};

use crate::error::{EditoastError, Result};

pub use crate::models::{Identifiable, PreferredId};

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
pub trait Model: Clone + Sized + Send {
    type Row: QueryableByName<Pg> + Into<Self> + Send;
    type Changeset: AsChangeset + Default + From<Self> + Send;

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

/// A couple ([Model] mutable reference, a [Model] changeset instance)
///
/// This struct is useful for several things:
///
/// * Provides a function [Patch::apply] that applies the changeset to the model
///     row and updates the model instance with the new values
/// * Takes the model instance as a mutable reference ensuring no concurrent
///     modification can be made to the instance
/// * The `Model` derive macro generates a builder similar to the changeset
///     for `Patch<'a, YourModel>` as well making this struct easier to use.
///
/// # Example
///
/// ```
/// let mut doc = Document::retrieve(&mut conn, 1).await?.unwrap();
/// doc.patch().title("new title").apply(&mut conn).await?;
/// assert_eq!(doc.title, "new title");
/// ```
///
/// See [Model::patch]
///
/// Also checkout [Save] and [Save::save] that provide another way to modify
/// [Model] instances.
#[allow(unused)]
pub struct Patch<'a, T: Model> {
    model: &'a mut T,
    changeset: T::Changeset,
}

#[allow(unused)]
impl<'a, M: Model> Patch<'a, M> {
    /// Applies the patch changeset to update the model instance's row and updates
    /// the model reference with its new values
    ///
    /// If this method is not implemented for your model for whatever reason, just
    /// use [Save::save].
    async fn apply<K>(self, conn: &mut diesel_async::AsyncPgConnection) -> Result<()>
    where
        for<'b> K: Send + Clone + 'b,
        M: Model + Identifiable<K> + Send,
        <M as Model>::Changeset: Update<K, M> + Send,
    {
        let id: K = self.model.get_id();
        let updated: M = self.changeset.update_or_fail(conn, id, || NotFound).await?;
        *self.model = updated;
        Ok(())
    }
}

/// Describes how a [Model] can be retrieved from the database
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait]
pub trait Retrieve<K>: Sized
where
    for<'async_trait> K: Send + 'async_trait,
{
    /// Retrieves the row #`id` and deserializes it as a model instance
    async fn retrieve(conn: &mut diesel_async::AsyncPgConnection, id: K) -> Result<Option<Self>>;

    /// Just like [Retrieve::retrieve] but returns `Err(fail())` if the row was not found
    async fn retrieve_or_fail<E, F>(
        conn: &'async_trait mut diesel_async::AsyncPgConnection,
        id: K,
        fail: F,
    ) -> Result<Self>
    where
        E: EditoastError,
        F: FnOnce() -> E + Send + 'async_trait,
    {
        match Self::retrieve(conn, id).await {
            Ok(Some(obj)) => Ok(obj),
            Ok(None) => Err(fail().into()),
            Err(e) => Err(e),
        }
    }
}

/// Describes how a [Model] can be updated in the database
///
/// The models that implement this trait also implement [Save] which provide
/// a convenient way to update a model instance.
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait]
pub trait Update<K, Row>: Sized
where
    for<'async_trait> K: Send + 'async_trait,
    Row: Send,
{
    /// Updates the row #`id` with the changeset values and returns the updated model
    async fn update(self, conn: &mut diesel_async::AsyncPgConnection, id: K)
        -> Result<Option<Row>>;

    /// Just like [Update::update] but returns `Err(fail())` if the row was not found
    async fn update_or_fail<E: EditoastError, F: FnOnce() -> E + Send>(
        self,
        conn: &'async_trait mut diesel_async::AsyncPgConnection,
        id: K,
        fail: F,
    ) -> Result<Row> {
        match self.update(conn, id).await {
            Ok(Some(obj)) => Ok(obj),
            Ok(None) => Err(fail().into()),
            Err(e) => Err(e),
        }
    }
}

/// Describes how a [Model] can be persisted to the database
///
/// This trait is automatically implemented for all models that implement
/// [Update].
#[async_trait]
pub trait Save<K: Send>: Sized {
    /// Persists the model instance to the database
    ///
    /// # Example
    ///
    /// ```
    /// let mut doc = Document::retrieve(&mut conn, 1).await?.unwrap();
    /// doc.title = "new title".to_string();
    /// doc.save(&mut conn).await?;
    /// assert_eq!(doc.title, "new title");
    /// ```
    async fn save(&mut self, conn: &mut diesel_async::AsyncPgConnection) -> Result<()>;
}

#[async_trait]
impl<'a, K, M> Save<K> for M
where
    for<'async_trait> K: Send + Clone + 'async_trait,
    M: Model + Identifiable<K> + Clone + Send + 'a,
    <M as Model>::Changeset: Update<K, M> + Send,
{
    async fn save(&mut self, conn: &mut diesel_async::AsyncPgConnection) -> Result<()> {
        let id = self.get_id();
        let changeset = <M as Model>::Changeset::from(self.clone()); // FIXME: I don't like that clone, maybe a ChangesetOwned/Changeset pair would work?
        *self = changeset.update_or_fail(conn, id, || NotFound).await?;
        Ok(())
    }
}

/// Describes how a [Model] can be created in the database
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait]
pub trait Create<Row: Send>: Sized {
    /// Creates a new row in the database with the values of the changeset and
    /// returns the created model instance
    async fn create(self, conn: &mut diesel_async::AsyncPgConnection) -> Result<Row>;

    /// Just like [Create::create] but discards the error if any and returns `Err(fail())` instead
    async fn create_or_fail<E: EditoastError, F: FnOnce() -> E + Send>(
        self,
        conn: &'async_trait mut diesel_async::AsyncPgConnection,
        fail: F,
    ) -> Result<Row> {
        match self.create(conn).await {
            Ok(obj) => Ok(obj),
            Err(_) => Err(fail().into()),
        }
    }
}

/// Describes how a [Model] can be deleted from the database
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
// NOTE: I'd argue that taking an &self is better than a borrow here
// as one might want to access the values of the model after deletion
#[async_trait]
pub trait Delete: Sized {
    /// Deletes the row corresponding to this model instance
    ///
    /// Returns `true` if the row was deleted, `false` if it didn't exist
    async fn delete(&self, conn: &mut diesel_async::AsyncPgConnection) -> Result<bool>;

    /// Just like [Delete::delete] but returns `Err(fail())` if the row didn't exist
    async fn delete_or_fail<E, F>(
        &self,
        conn: &mut diesel_async::AsyncPgConnection,
        fail: F,
    ) -> Result<()>
    where
        E: EditoastError,
        F: FnOnce() -> E + Send + 'async_trait,
    {
        match self.delete(conn).await {
            Ok(true) => Ok(()),
            Ok(false) => Err(fail().into()),
            Err(e) => Err(e),
        }
    }
}

/// Describes how a [Model] can be deleted from the database
///
/// This trait is similar to [Delete] but it doesn't take a reference to the model
/// instance. This is useful for models that don't have to be retrieved before deletion.
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait]
pub trait DeleteStatic<K>: Sized
where
    for<'async_trait> K: Send + 'async_trait,
{
    /// Deletes the row #`id` from the database
    async fn delete_static(conn: &mut diesel_async::AsyncPgConnection, id: K) -> Result<bool>;

    /// Just like [DeleteStatic::delete_static] but returns `Err(fail())` if the row didn't exist
    async fn delete_static_or_fail<E, F>(
        conn: &mut diesel_async::AsyncPgConnection,
        id: K,
        fail: F,
    ) -> Result<()>
    where
        E: EditoastError,
        F: FnOnce() -> E + Send + 'async_trait,
    {
        match Self::delete_static(conn, id).await {
            Ok(true) => Ok(()),
            Ok(false) => Err(fail().into()),
            Err(e) => Err(e),
        }
    }
}
