pub mod documents;
pub mod infra_objects;

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

/// Describes how to check for the existence of a [Model] in the database
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait]
pub trait Exists<K>: Sized
where
    for<'async_trait> K: Send + 'async_trait,
{
    /// Returns whether the row #`id` exists in the database
    async fn exists(conn: &mut diesel_async::AsyncPgConnection, id: K) -> Result<bool>;
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
    ($parameters_per_row:expr, $values:expr, $chunk:ident => $query:tt) => {{
        const LIBPQ_MAX_PARAMETERS: usize = 2_usize.pow(16) - 1;
        // We need to divide further because of AsyncPgConnection, maybe it is related to connection pipelining
        const ASYNC_SUBDIVISION: usize = 2_usize;
        const CHUNK_SIZE: usize = LIBPQ_MAX_PARAMETERS / ASYNC_SUBDIVISION / $parameters_per_row;
        let mut result = Vec::new();
        let values = $values.into_iter().collect::<Vec<_>>();
        let chunks = values.chunks(CHUNK_SIZE);
        for $chunk in chunks.into_iter() {
            let chunk_result = $query;
            result.push(chunk_result);
        }
        result
    }};
    // Extends the result structure with every chunked query result
    ($parameters_per_row:expr, $values:expr, $result:expr, $chunk:ident => $query:tt) => {{
        const LIBPQ_MAX_PARAMETERS: usize = 2_usize.pow(16) - 1;
        // We need to divide further because of AsyncPgConnection, maybe it is related to connection pipelining
        const ASYNC_SUBDIVISION: usize = 2_usize;
        const CHUNK_SIZE: usize = LIBPQ_MAX_PARAMETERS / ASYNC_SUBDIVISION / $parameters_per_row;
        let mut result = $result;
        let values = $values.into_iter().collect::<Vec<_>>();
        let chunks = values.chunks(CHUNK_SIZE);
        for $chunk in chunks.into_iter() {
            let chunk_result = $query;
            result.extend(chunk_result);
        }
        result
    }};
}

/// Describes how a [Model] can be created in the database given a batch of its changesets
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait::async_trait]
pub trait CreateBatch<Cs, K>: Sized
where
    Cs: Send,
    K: Send + Clone,
{
    /// Creates a batch of rows in the database given an iterator of changesets
    ///
    /// Returns a collection of the created rows.
    /// ```
    /// let changesets = (0..5).map(|i| {
    ///     Document::changeset()
    ///         .content_type(String::from("text/plain"))
    ///         .data(vec![i])
    /// });
    /// let docs: Vec<Document> = Document::create_batch(&mut conn, changesets).await?;
    /// assert_eq!(docs.len(), 5);
    /// ```
    async fn create_batch<
        I: IntoIterator<Item = Cs> + Send + 'async_trait,
        C: Default + std::iter::Extend<Self> + Send,
    >(
        conn: &mut diesel_async::AsyncPgConnection,
        values: I,
    ) -> Result<C>;

    /// Just like [CreateBatch::create_batch] but the returned models are paired with their key
    async fn create_batch_with_key<
        I: IntoIterator<Item = Cs> + Send + 'async_trait,
        C: Default + std::iter::Extend<(K, Self)> + Send,
    >(
        conn: &mut diesel_async::AsyncPgConnection,
        values: I,
    ) -> Result<C>;
}

/// Unchecked batch retrieval of a [Model] from the database
///
/// Any [Model] that implement this trait also implement [RetrieveBatch].
/// Unless you know what you're doing, you should use [RetrieveBatch] instead.
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait::async_trait]
pub trait RetrieveBatchUnchecked<K>: Sized
where
    for<'async_trait> K: Send + 'async_trait,
{
    /// Retrieves a batch of rows from the database given an iterator of keys
    ///
    /// Returns a collection of the retrieved rows. That collection can contain
    /// fewer items than the number of provided keys if some rows were not found.
    /// Use [RetrieveBatch::retrieve_batch] or [RetrieveBatch::retrieve_batch_or_fail]
    /// if you want to fail if some rows were not found.
    /// Unless you know what you're doing, you should use these functions instead.
    async fn retrieve_batch_unchecked<
        I: IntoIterator<Item = K> + Send + 'async_trait,
        C: Default + std::iter::Extend<Self> + Send,
    >(
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
    ) -> Result<C>;

    /// Just like [RetrieveBatchUnchecked::retrieve_batch_unchecked] but the returned models are paired with their key
    ///
    /// Returns a collection of the retrieved rows. That collection can contain
    /// fewer items than the number of provided keys if some rows were not found.
    /// Use [RetrieveBatch::retrieve_batch_with_key] or [RetrieveBatch::retrieve_batch_with_key_or_fail]
    /// if you want to fail if some rows were not found.
    /// Unless you know what you're doing, you should use these functions instead.
    async fn retrieve_batch_with_key_unchecked<
        I: IntoIterator<Item = K> + Send + 'async_trait,
        C: Default + std::iter::Extend<(K, Self)> + Send,
    >(
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
    ) -> Result<C>;
}

/// Unchecked batch update of a [Model] in the database
///
/// Any [Model] that implement this trait also implement [UpdateBatch].
/// Unless you know what you're doing, you should use [UpdateBatch] instead.
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait::async_trait]
pub trait UpdateBatchUnchecked<M, K>: Sized
where
    M: Send,
    K: Send + Clone,
{
    /// Updates a batch of rows in the database given an iterator of keys
    ///
    /// Returns a collection of the updated rows. That collection can contain
    /// fewer items than the number of provided keys if some rows were not found.
    /// Use [UpdateBatch::update_batch] or [UpdateBatch::update_batch_or_fail]
    /// if you want to fail if some rows were not found.
    /// Unless you know what you're doing, you should use these functions instead.
    async fn update_batch_unchecked<
        I: IntoIterator<Item = K> + Send + 'async_trait,
        C: Default + std::iter::Extend<M> + Send,
    >(
        self,
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
    ) -> Result<C>;

    /// Just like [UpdateBatchUnchecked::update_batch_unchecked] but the returned models are paired with their key
    ///
    /// Returns a collection of the updated rows. That collection can contain
    /// fewer items than the number of provided keys if some rows were not found.
    /// Use [UpdateBatch::update_batch_with_key] or [UpdateBatch::update_batch_with_key_or_fail]
    /// if you want to fail if some rows were not found.
    /// Unless you know what you're doing, you should use these functions instead.
    async fn update_batch_with_key_unchecked<
        I: IntoIterator<Item = K> + Send + 'async_trait,
        C: Default + std::iter::Extend<(K, M)> + Send,
    >(
        self,
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
    ) -> Result<C>;
}

/// Describes how a [Model] can be deleted from the database given a batch of keys
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait::async_trait]
pub trait DeleteBatch<K>: Sized
where
    for<'async_trait> K: Send + 'async_trait,
{
    /// Deletes a batch of rows from the database given an iterator of keys
    ///
    /// Returns the number of rows deleted.
    async fn delete_batch<I: IntoIterator<Item = K> + Send + 'async_trait>(
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
    ) -> Result<usize>;

    /// Just like [DeleteBatch::delete_batch] but returns `Err(fail(missing))` where `missing`
    /// is the number of rows that were not deleted
    async fn delete_batch_or_fail<I, E, F>(
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
        fail: F,
    ) -> Result<()>
    where
        I: Send + IntoIterator<Item = K> + 'async_trait,
        E: EditoastError,
        F: FnOnce(usize) -> E + Send + 'async_trait,
    {
        let ids = ids.into_iter().collect::<Vec<_>>();
        let expected_count = ids.len();
        let count = Self::delete_batch(conn, ids).await?;
        if count != expected_count {
            Err(fail(expected_count - count).into())
        } else {
            Ok(())
        }
    }
}

/// Describes how a [Model] can be retrieved from the database given a batch of keys
///
/// This trait is automatically implemented for all models that implement
/// [RetrieveBatchUnchecked]. [RetrieveBatchUnchecked] is a lower-level trait
/// which implementation is automatically generated by the `Model` derive macro.
///
/// 99% of the time you should use this trait instead of [RetrieveBatchUnchecked].
/// This won't be possible however if the model's key is not `Eq` or `Hash`.
#[async_trait::async_trait]
pub trait RetrieveBatch<K>: RetrieveBatchUnchecked<K>
where
    for<'async_trait> K: Eq + std::hash::Hash + Clone + Send + 'async_trait,
{
    /// Retrieves a batch of rows from the database given an iterator of keys
    ///
    /// Returns a collection of the retrieved rows and a set of the keys
    /// that were not found.
    ///
    /// ```
    /// let mut ids = (0..5).collect::<Vec<_>>();
    /// ids.push(123456789);
    /// let (docs, missing): (HashSet<_>, _) = Document::retrieve_batch(&mut conn, ids).await?;
    /// assert!(ids.contains(&123456789));
    /// assert_eq!(docs.len(), 5);
    /// ```
    async fn retrieve_batch<I, C>(
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
    ) -> Result<(C, std::collections::HashSet<K>)>
    where
        I: Send + IntoIterator<Item = K> + 'async_trait,
        C: Send
            + Default
            + std::iter::Extend<Self>
            + std::iter::FromIterator<Self>
            + std::iter::IntoIterator<Item = Self>,
    {
        let ids = ids.into_iter().collect::<std::collections::HashSet<_>>();
        let (retrieved_ids, results): (std::collections::HashSet<_>, C) =
            Self::retrieve_batch_with_key_unchecked::<_, Vec<(_, _)>>(
                conn,
                ids.clone().into_iter(),
            )
            .await?
            .into_iter()
            .unzip();
        let missing = ids
            .difference(&retrieved_ids)
            .collect::<std::collections::HashSet<_>>();
        Ok((results, missing.into_iter().cloned().collect()))
    }

    /// Just like [RetrieveBatch::retrieve_batch] but the returned models are paired with their key
    ///
    /// ```
    /// let mut ids = (0..5).collect::<Vec<_>>();
    /// ids.push(123456789);
    /// let (docs, missing): (HashMap<_, _>, _) = Document::retrieve_batch_with_key(&mut conn, ids).await?;
    /// assert!(ids.contains(&123456789));
    /// assert!(docs.contains(&1));
    /// ```
    async fn retrieve_batch_with_key<I, C>(
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
    ) -> Result<(C, std::collections::HashSet<K>)>
    where
        I: Send + IntoIterator<Item = K> + 'async_trait,
        C: Send
            + Default
            + std::iter::Extend<(K, Self)>
            + std::iter::FromIterator<(K, Self)>
            + std::iter::IntoIterator<Item = (K, Self)>,
    {
        let ids = ids.into_iter().collect::<std::collections::HashSet<_>>();
        let (retrieved_ids, results): (std::collections::HashSet<_>, C) =
            Self::retrieve_batch_with_key_unchecked::<_, Vec<(_, _)>>(
                conn,
                ids.clone().into_iter(),
            )
            .await?
            .into_iter()
            .map(|(k, v)| (k.clone(), (k, v)))
            .unzip();
        let missing = ids
            .difference(&retrieved_ids)
            .collect::<std::collections::HashSet<_>>();
        Ok((results, missing.into_iter().cloned().collect()))
    }

    /// Retrieves a batch of rows from the database given an iterator of keys
    ///
    /// Returns a collection of the retrieved rows and fails if some rows were not found.
    /// On failure, the error returned is the result of calling `fail(missing)` where `missing`
    /// is the set of ids that were not found.
    ///
    /// ```
    /// let ids = (0..5).collect::<Vec<_>>();
    /// let docs: HashSet<_> = Document::retrieve_batch_or_fail(&mut conn, ids, |missing| {
    ///    MyErrorType::DocumentsNotFound(missing)
    /// }).await?;
    /// ```
    async fn retrieve_batch_or_fail<I, C, E, F>(
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
        fail: F,
    ) -> Result<C>
    where
        I: Send + IntoIterator<Item = K> + 'async_trait,
        C: Send
            + Default
            + std::iter::Extend<Self>
            + std::iter::FromIterator<Self>
            + std::iter::IntoIterator<Item = Self>,
        E: EditoastError,
        F: FnOnce(std::collections::HashSet<K>) -> E + Send + 'async_trait,
    {
        let (result, missing) = Self::retrieve_batch::<_, C>(conn, ids).await?;
        if missing.is_empty() {
            Ok(result)
        } else {
            Err(fail(missing).into())
        }
    }

    /// Just like [RetrieveBatch::retrieve_batch_or_fail] but the returned models are paired with their key
    ///
    /// ```
    /// let ids = (0..5).collect::<Vec<_>>();
    /// let docs: HashMap<_, _> = Document::retrieve_batch_with_key_or_fail(&mut conn, ids, |missing| {
    ///   MyErrorType::DocumentsNotFound(missing)
    /// }).await?;
    /// ```
    async fn retrieve_batch_with_key_or_fail<I, C, E, F>(
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
        fail: F,
    ) -> Result<C>
    where
        I: Send + IntoIterator<Item = K> + 'async_trait,
        C: Send
            + Default
            + std::iter::Extend<(K, Self)>
            + std::iter::FromIterator<(K, Self)>
            + std::iter::IntoIterator<Item = (K, Self)>,
        E: EditoastError,
        F: FnOnce(std::collections::HashSet<K>) -> E + Send + 'async_trait,
    {
        let (result, missing) = Self::retrieve_batch_with_key::<_, C>(conn, ids).await?;
        if missing.is_empty() {
            Ok(result)
        } else {
            Err(fail(missing).into())
        }
    }
}

/// Describes how a [Model] can be updated in the database given a batch of its changesets
///
/// This trait is automatically implemented for all models that implement
/// [UpdateBatchUnchecked]. [UpdateBatchUnchecked] is a lower-level trait
/// which implementation is automatically generated by the `Model` derive macro.
///
/// 99% of the time you should use this trait instead of [UpdateBatchUnchecked].
/// This won't be possible however if the model's key is not `Eq` or `Hash`.
#[async_trait::async_trait]
pub trait UpdateBatch<M, K>: UpdateBatchUnchecked<M, K>
where
    M: Send,
    for<'async_trait> K: Eq + std::hash::Hash + Clone + Send + 'async_trait,
{
    /// Applies the changeset to a batch of rows in the database given an iterator of keys
    ///
    /// Returns a collection of the updated rows and a set of the keys
    /// that were not found.
    ///
    /// ```
    /// let mut ids = (0..5).collect::<Vec<_>>();
    /// ids.push(123456789);
    /// let (docs, missing): (Vec<_>, _) =
    ///     Document::changeset()
    ///         .data(vec![])
    ///         .update_batch(&mut conn, ids)
    ///         .await?;
    /// assert!(missing.contains(&123456789));
    /// assert_eq!(docs.len(), 5);
    /// assert_eq!(docs[0].data, vec![]);
    /// ```
    async fn update_batch<I, C>(
        self,
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
    ) -> Result<(C, std::collections::HashSet<K>)>
    where
        I: Send + IntoIterator<Item = K> + 'async_trait,
        C: Send
            + Default
            + std::iter::Extend<M>
            + std::iter::FromIterator<M>
            + std::iter::IntoIterator<Item = M>,
    {
        let ids = ids.into_iter().collect::<std::collections::HashSet<_>>();
        let (updated_ids, results): (std::collections::HashSet<_>, C) = self
            .update_batch_with_key_unchecked::<_, Vec<(_, _)>>(conn, ids.clone().into_iter())
            .await?
            .into_iter()
            .unzip();
        let missing = ids
            .difference(&updated_ids)
            .collect::<std::collections::HashSet<_>>();
        Ok((results, missing.into_iter().cloned().collect()))
    }

    /// Just like [UpdateBatch::update_batch] but the returned models are paired with their key
    ///
    /// ```
    /// let mut ids = (0..5).collect::<Vec<_>>();
    /// ids.push(123456789);
    /// let (docs, missing): (BTreeMap<_, _>, _) =
    ///    Document::changeset()
    ///       .data(vec![])
    ///       .update_batch_with_key(&mut conn, ids)
    ///       .await?;
    /// assert!(missing.contains(&123456789));
    /// ```
    async fn update_batch_with_key<I, C>(
        self,
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
    ) -> Result<(C, std::collections::HashSet<K>)>
    where
        I: Send + IntoIterator<Item = K> + 'async_trait,
        C: Send
            + Default
            + std::iter::Extend<(K, M)>
            + std::iter::FromIterator<(K, M)>
            + std::iter::IntoIterator<Item = (K, M)>,
    {
        let ids = ids.into_iter().collect::<std::collections::HashSet<_>>();
        let (updated_ids, results): (std::collections::HashSet<_>, C) = self
            .update_batch_with_key_unchecked::<_, Vec<(_, _)>>(conn, ids.clone().into_iter())
            .await?
            .into_iter()
            .map(|(k, v)| (k.clone(), (k, v)))
            .unzip();
        let missing = ids
            .difference(&updated_ids)
            .collect::<std::collections::HashSet<_>>();
        Ok((results, missing.into_iter().cloned().collect()))
    }

    /// Applies the changeset to a batch of rows in the database given an iterator of keys
    ///
    /// Returns a collection of the updated rows and fails if some rows were not found.
    /// On failure, the error returned is the result of calling `fail(missing)` where `missing`
    /// is the set of ids that were not found.
    ///
    /// ```
    /// let docs: Vec<_> = Document::changeset()
    ///     .data(vec![])
    ///     .update_batch_or_fail(&mut conn, (0..5), |missing| {
    ///         MyErrorType::DocumentsNotFound(missing)
    ///     }).await?;
    /// ```
    async fn update_batch_or_fail<I, C, E, F>(
        self,
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
        fail: F,
    ) -> Result<C>
    where
        I: Send + IntoIterator<Item = K> + 'async_trait,
        C: Send
            + Default
            + std::iter::Extend<M>
            + std::iter::FromIterator<M>
            + std::iter::IntoIterator<Item = M>,
        E: EditoastError,
        F: FnOnce(std::collections::HashSet<K>) -> E + Send + 'async_trait,
    {
        let (result, missing) = self.update_batch::<_, C>(conn, ids).await?;
        if missing.is_empty() {
            Ok(result)
        } else {
            Err(fail(missing).into())
        }
    }

    /// Just like [UpdateBatch::update_batch_or_fail] but the returned models are paired with their key
    ///
    /// ```
    /// let docs: BTreeMap<_, _> = Document::changeset()
    ///     .data(vec![])
    ///     .update_batch_with_key_or_fail(&mut conn, (0..5), |missing| {
    ///         MyErrorType::DocumentsNotFound(missing)
    ///     }).await?;
    /// ```
    async fn update_batch_with_key_or_fail<I, C, E, F>(
        self,
        conn: &mut diesel_async::AsyncPgConnection,
        ids: I,
        fail: F,
    ) -> Result<C>
    where
        I: Send + IntoIterator<Item = K> + 'async_trait,
        C: Send
            + Default
            + std::iter::Extend<(K, M)>
            + std::iter::FromIterator<(K, M)>
            + std::iter::IntoIterator<Item = (K, M)>,
        E: EditoastError,
        F: FnOnce(std::collections::HashSet<K>) -> E + Send + 'async_trait,
    {
        let (result, missing) = self.update_batch_with_key::<_, C>(conn, ids).await?;
        if missing.is_empty() {
            Ok(result)
        } else {
            Err(fail(missing).into())
        }
    }
}

// Auto-impl of RetrieveBatch for all models that implement RetrieveBatchUnchecked
#[async_trait::async_trait]
impl<M, K> RetrieveBatch<K> for M
where
    M: RetrieveBatchUnchecked<K>,
    for<'async_trait> K: Eq + std::hash::Hash + Clone + Send + 'async_trait,
{
}

// Auto-impl of UpdateBatch for all models that implement UpdateBatchUnchecked
#[async_trait::async_trait]
impl<Cs, M, K> UpdateBatch<M, K> for Cs
where
    Cs: UpdateBatchUnchecked<M, K>,
    M: Send,
    for<'async_trait> K: Eq + std::hash::Hash + Clone + Send + 'async_trait,
{
}

#[cfg(test)]
mod tests {
    use crate::fixtures::tests::{db_pool, TestFixture};
    use crate::modelsv2::*;
    use editoast_derive::ModelV2;
    use itertools::Itertools;
    use std::collections::HashSet;

    #[derive(Debug, Default, Clone, ModelV2)]
    #[model(table = crate::tables::document)]
    struct Document {
        id: i64,
        content_type: String,
        data: Vec<u8>,
    }

    #[rstest::rstest]
    async fn test_batch() {
        let pool = db_pool();
        let mut conn = pool.get().await.unwrap();
        let changesets = (0..5).map(|i| {
            Document::changeset()
                .content_type(String::from("text/plain"))
                .data(vec![i])
        });
        let docs = Document::create_batch::<_, Vec<_>>(&mut conn, changesets)
            .await
            .unwrap()
            .into_iter()
            .map(|d| TestFixture::new(d, pool.clone()))
            .collect::<Vec<_>>();
        assert_eq!(docs.len(), 5);

        let mut ids = docs.iter().map(|d| d.model.id).collect::<Vec<_>>();
        ids.push(123456789);

        let (docs, missing): (Vec<_>, _) =
            Document::retrieve_batch(&mut pool.get().await.unwrap(), ids.clone())
                .await
                .unwrap();
        assert_eq!(missing.into_iter().collect_vec(), vec![123456789]);
        assert_eq!(docs.len(), 5);
        assert_eq!(
            docs.iter()
                .map(|d| d.content_type.clone())
                .collect::<HashSet<_>>(),
            HashSet::from([String::from("text/plain")])
        );
        assert_eq!(
            docs.iter()
                .flat_map(|d| d.data.clone())
                .collect::<HashSet<_>>(),
            HashSet::from_iter(0..5)
        );

        let new_ct = String::from("I like trains");
        let (updated_docs, missing): (Vec<_>, _) = Document::changeset()
            .content_type(new_ct.clone())
            .update_batch(&mut pool.get().await.unwrap(), ids.iter().cloned().take(2))
            .await
            .unwrap();
        assert!(missing.is_empty());
        assert!(updated_docs.iter().all(|d| d.content_type == new_ct));
        assert_eq!(updated_docs.len(), 2);

        let (docs, _): (Vec<_>, _) =
            Document::retrieve_batch(&mut pool.get().await.unwrap(), ids.clone())
                .await
                .unwrap();
        assert_eq!(
            docs.iter()
                .map(|d| d.content_type.clone())
                .collect::<HashSet<_>>(),
            HashSet::from([String::from("text/plain"), new_ct])
        );

        let not_deleted = ids.remove(0);
        let count = Document::delete_batch(&mut pool.get().await.unwrap(), ids)
            .await
            .unwrap();
        assert_eq!(count, 4);

        assert!(
            Document::exists(&mut pool.get().await.unwrap(), not_deleted)
                .await
                .unwrap()
        );
    }

    #[rstest::rstest]
    async fn test_remote() {
        #[derive(Debug, Clone, PartialEq)]
        enum Data {
            Prefixed(u8),
            Raw(u8, u8),
        }

        impl From<Vec<u8>> for Data {
            fn from(v: Vec<u8>) -> Self {
                match v.as_slice() {
                    [0x42, x] => Data::Prefixed(*x),
                    [x, y] => Data::Raw(*x, *y),
                    _ => panic!("invalid 2-bytes data"),
                }
            }
        }

        impl From<Data> for Vec<u8> {
            fn from(d: Data) -> Self {
                match d {
                    Data::Prefixed(x) => vec![0x42, x],
                    Data::Raw(x, y) => vec![x, y],
                }
            }
        }

        #[derive(Clone, ModelV2)]
        #[model(table = crate::tables::document)]
        struct Document {
            id: i64,
            content_type: String,
            #[model(remote = "Vec<u8>")]
            data: Data,
        }

        let pool = db_pool();
        let mut conn = pool.get().await.unwrap();
        let docs = Document::create_batch::<_, Vec<_>>(
            &mut conn,
            [
                Document::changeset()
                    .content_type(String::from("text/plain"))
                    .data(Data::Prefixed(0x43)),
                Document::changeset()
                    .content_type(String::from("text/plain"))
                    .data(Data::Raw(0, 1)),
            ],
        )
        .await
        .unwrap()
        .into_iter()
        .map(|d| TestFixture::new(d, pool.clone()))
        .collect::<Vec<_>>();
        assert_eq!(docs.len(), 2);

        let ids = docs.iter().map(|d| d.model.id).collect::<Vec<_>>();
        assert_eq!(
            Document::retrieve(&mut conn, ids[0])
                .await
                .unwrap()
                .unwrap()
                .data,
            Data::Prefixed(0x43)
        );
        assert_eq!(
            Document::retrieve(&mut conn, ids[1])
                .await
                .unwrap()
                .unwrap()
                .data,
            Data::Raw(0, 1)
        );
    }
}
