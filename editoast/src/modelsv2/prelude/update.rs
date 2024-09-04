use std::fmt::Debug;

use diesel::result::Error::NotFound;
use editoast_models::DbConnection;

use crate::error::EditoastError;
use crate::error::Result;
use crate::modelsv2::PreferredId;

use super::Model;

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
    pub(super) model: &'a mut T,
    pub changeset: T::Changeset,
}

#[allow(unused)]
impl<'a, M: Model> Patch<'a, M> {
    /// Applies the patch changeset to update the model instance's row and updates
    /// the model reference with its new values
    ///
    /// If this method is not implemented for your model for whatever reason, just
    /// use [Save::save].
    pub async fn apply<K>(self, conn: &mut DbConnection) -> Result<()>
    where
        for<'b> K: Send + Clone + 'b,
        M: Model + PreferredId<K> + Send,
        <M as Model>::Changeset: Update<K, M> + Send,
    {
        let id: K = self.model.get_id();
        let updated: M = self.changeset.update_or_fail(conn, id, || NotFound).await?;
        *self.model = updated;
        Ok(())
    }
}

/// Describes how a [Model] can be updated in the database
///
/// The models that implement this trait also implement [Save] which provide
/// a convenient way to update a model instance.
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait::async_trait]
pub trait Update<K, Row>: Sized
where
    for<'async_trait> K: Send + 'async_trait,
    Row: Send,
{
    /// Updates the row #`id` with the changeset values and returns the updated model
    async fn update(self, conn: &mut DbConnection, id: K) -> Result<Option<Row>>;

    /// Just like [Update::update] but returns `Err(fail())` if the row was not found
    async fn update_or_fail<E: EditoastError, F: FnOnce() -> E + Send>(
        self,
        conn: &'async_trait mut DbConnection,
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
#[async_trait::async_trait]
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
    async fn save(&mut self, conn: &mut DbConnection) -> Result<()>;
}

#[async_trait::async_trait]
impl<'a, K, M> Save<K> for M
where
    for<'async_trait> K: Send + Clone + 'async_trait,
    M: Model + PreferredId<K> + Clone + Send + 'a,
    <M as Model>::Changeset: Update<K, M> + Send,
{
    async fn save(&mut self, conn: &mut DbConnection) -> Result<()> {
        let id = self.get_id();
        let changeset = <M as Model>::Changeset::from(self.clone()); // FIXME: I don't like that clone, maybe a ChangesetOwned/Changeset pair would work?
        *self = changeset.update_or_fail(conn, id, || NotFound).await?;
        Ok(())
    }
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
        C: Default + std::iter::Extend<M> + Send + Debug,
    >(
        self,
        conn: &mut DbConnection,
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
        conn: &mut DbConnection,
        ids: I,
    ) -> Result<C>;
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
        conn: &mut DbConnection,
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
        conn: &mut DbConnection,
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
        conn: &mut DbConnection,
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
        conn: &mut DbConnection,
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

// Auto-impl of UpdateBatch for all models that implement UpdateBatchUnchecked
#[async_trait::async_trait]
impl<Cs, M, K> UpdateBatch<M, K> for Cs
where
    Cs: UpdateBatchUnchecked<M, K>,
    M: Send,
    for<'async_trait> K: Eq + std::hash::Hash + Clone + Send + 'async_trait,
{
}
