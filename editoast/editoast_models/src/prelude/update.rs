use std::fmt::Debug;

use database::DbConnection;
use diesel::result::Error::NotFound;

use super::PreferredId;

use super::Model;

/// Describes how a [Model] can be updated in the database
///
/// The models that implement this trait also implement [Save] which provide
/// a convenient way to update a model instance.
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
pub trait Update<K, M>: Sized
where
    K: Send,
    M: Model,
{
    type Error: std::error::Error + From<crate::Error> + Send;

    /// Updates the row #`id` with the changeset values and returns the updated model
    async fn update(self, conn: &mut DbConnection, id: K) -> Result<Option<M>, Self::Error>;

    /// Just like [Update::update] but returns `Err(fail())` if the row was not found
    async fn update_or_fail<E, F>(self, conn: &mut DbConnection, id: K, fail: F) -> Result<M, E>
    where
        E: From<Self::Error>,
        F: FnOnce() -> E + Send,
    {
        match self.update(conn, id).await {
            Ok(Some(obj)) => Ok(obj),
            Ok(None) => Err(fail()),
            Err(e) => Err(E::from(e)),
        }
    }
}

/// Describes how a [Model] can be persisted to the database
///
/// This trait is automatically implemented for all models that implement
/// [Update].
pub trait Save<K: Send>: Model {
    type Error: std::error::Error + From<crate::Error> + Send;

    /// Persists the model instance to the database
    ///
    /// # Example
    ///
    /// ```no_run
    /// # use editoast_models::prelude::*;
    /// # use database::DbConnection;
    /// # #[derive(Debug, PartialEq, Eq, Hash)]
    /// # struct Document { title: String }
    /// # impl Document {
    /// #     async fn retrieve(_conn: DbConnection, _id: i64) -> Result<Option<Self>, std::io::Error> {
    /// #         Ok(Some(Document { title: "old title".to_string() }))
    /// #     }
    /// #     async fn save(&mut self, _conn: &mut DbConnection) -> Result<(), std::io::Error> { Ok(()) }
    /// # }
    /// # async fn example(mut conn: DbConnection) -> Result<(), std::io::Error> {
    /// let mut doc = Document::retrieve(conn.clone(), 1).await?.unwrap();
    /// doc.title = "new title".to_string();
    /// doc.save(&mut conn).await?;
    /// assert_eq!(doc.title, "new title");
    /// # Ok(())
    /// # }
    async fn save(&mut self, conn: &mut DbConnection) -> Result<(), Self::Error>;
}

impl<K, M> Save<K> for M
where
    K: Send + Clone,
    M: Model + PreferredId<K> + Clone + Send,
    <M as Model>::Changeset: Update<K, M> + Send,
{
    type Error = <<M as Model>::Changeset as Update<K, M>>::Error;

    async fn save(&mut self, conn: &mut DbConnection) -> Result<(), Self::Error> {
        let id = self.get_id();
        let changeset = <M as Model>::Changeset::from(self.clone()); // FIXME: I don't like that clone, maybe a ChangesetOwned/Changeset pair would work?
        *self = changeset
            .update_or_fail(conn, id, || Self::Error::from(crate::Error::from(NotFound)))
            .await?;
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
pub trait UpdateBatchUnchecked<M, K>: Sized
where
    M: Model,
    K: Send + Clone,
{
    type Error: std::error::Error + From<crate::Error> + Send;

    /// Updates a batch of rows in the database given an iterator of keys
    ///
    /// Returns a collection of the updated rows. That collection can contain
    /// fewer items than the number of provided keys if some rows were not found.
    /// Use [UpdateBatch::update_batch] or [UpdateBatch::update_batch_or_fail]
    /// if you want to fail if some rows were not found.
    /// Unless you know what you're doing, you should use these functions instead.
    async fn update_batch_unchecked<
        I: IntoIterator<Item = K> + Send,
        C: Default + std::iter::Extend<M> + Send + Debug,
    >(
        self,
        conn: &mut DbConnection,
        ids: I,
    ) -> Result<C, Self::Error>;

    /// Just like [UpdateBatchUnchecked::update_batch_unchecked] but the returned models are paired with their key
    ///
    /// Returns a collection of the updated rows. That collection can contain
    /// fewer items than the number of provided keys if some rows were not found.
    /// Use [UpdateBatch::update_batch_with_key] or [UpdateBatch::update_batch_with_key_or_fail]
    /// if you want to fail if some rows were not found.
    /// Unless you know what you're doing, you should use these functions instead.
    async fn update_batch_with_key_unchecked<
        I: IntoIterator<Item = K> + Send,
        C: Default + std::iter::Extend<(K, M)> + Send,
    >(
        self,
        conn: &mut DbConnection,
        ids: I,
    ) -> Result<C, Self::Error>;
}

/// Describes how a [Model] can be updated in the database given a batch of its changesets
///
/// This trait is automatically implemented for all models that implement
/// [UpdateBatchUnchecked]. [UpdateBatchUnchecked] is a lower-level trait
/// which implementation is automatically generated by the `Model` derive macro.
///
/// 99% of the time you should use this trait instead of [UpdateBatchUnchecked].
/// This won't be possible however if the model's key is not `Eq` or `Hash`.
pub trait UpdateBatch<M, K>: UpdateBatchUnchecked<M, K>
where
    M: Model,
    K: Eq + std::hash::Hash + Clone + Send,
{
    /// Applies the changeset to a batch of rows in the database given an iterator of keys
    ///
    /// Returns a collection of the updated rows and a set of the keys
    /// that were not found.
    ///
    /// ```no_run
    /// # use editoast_models::prelude::*;
    /// # use database::DbConnection;
    /// # use std::collections::HashSet;
    /// # #[derive(Debug, PartialEq, Eq, Hash)]
    /// # struct Document { data: Vec<u8> }
    /// # impl Document {
    /// #     fn changeset() -> Self { Self { data: Vec::new() } }
    /// #     fn data(mut self, data: Vec<u8>) -> Self { self.data = data; self }
    /// #     async fn update_batch<C: Default + std::iter::Extend<Self>>(
    /// #         self, _conn: &mut DbConnection, _ids: impl IntoIterator<Item = i64> + Send
    /// #     ) -> Result<(C, HashSet<i64>), std::io::Error> { Ok((C::default(), HashSet::new())) }
    /// # }
    /// # async fn example(mut conn: DbConnection) -> Result<(), std::io::Error> {
    /// let mut ids = (0..5).collect::<Vec<_>>();
    /// ids.push(123456789);
    /// let (docs, missing): (Vec<_>, _) =
    ///     Document::changeset()
    ///         .data(vec![])
    ///         .update_batch(&mut conn, ids)
    ///         .await?;
    /// assert!(missing.contains(&123456789));
    /// assert_eq!(docs.len(), 5);
    /// assert_eq!(docs[0].data, Vec::<u8>::new());
    /// # Ok(())
    /// # }
    /// ```
    async fn update_batch<I, C>(
        self,
        conn: &mut DbConnection,
        ids: I,
    ) -> Result<(C, std::collections::HashSet<K>), Self::Error>
    where
        I: Send + IntoIterator<Item = K>,
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
    /// ```no_run
    /// # use editoast_models::prelude::*;
    /// # use database::DbConnection;
    /// # use std::collections::{BTreeMap, HashSet};
    /// # #[derive(Debug, PartialEq, Eq, Hash)]
    /// # struct Document { data: Vec<u8> }
    /// # impl Document {
    /// #     fn changeset() -> Self { Self { data: Vec::new() } }
    /// #     fn data(mut self, data: Vec<u8>) -> Self { self.data = data; self }
    /// #     async fn update_batch_with_key<C: Default + std::iter::Extend<(i64, Self)>>(
    /// #         self, _conn: &mut DbConnection, _ids: impl IntoIterator<Item = i64> + Send
    /// #     ) -> Result<(C, HashSet<i64>), std::io::Error> { Ok((C::default(), HashSet::new())) }
    /// # }
    /// # async fn example(mut conn: DbConnection) -> Result<(), std::io::Error> {
    /// let mut ids = (0..5).collect::<Vec<_>>();
    /// ids.push(123456789);
    /// let (docs, missing): (BTreeMap<_, _>, _) =
    ///    Document::changeset()
    ///       .data(vec![])
    ///       .update_batch_with_key(&mut conn, ids)
    ///       .await?;
    /// assert!(missing.contains(&123456789));
    /// # Ok(())
    /// # }
    /// ```
    async fn update_batch_with_key<I, C>(
        self,
        conn: &mut DbConnection,
        ids: I,
    ) -> Result<(C, std::collections::HashSet<K>), Self::Error>
    where
        I: Send + IntoIterator<Item = K>,
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
    /// ```no_run
    /// # use editoast_models::prelude::*;
    /// # use database::DbConnection;
    /// # use std::collections::HashSet;
    /// # #[derive(Debug, PartialEq, Eq, Hash)]
    /// # struct Document { data: Vec<u8> }
    /// # impl Document {
    /// #     fn changeset() -> Self { Self { data: Vec::new() } }
    /// #     fn data(mut self, data: Vec<u8>) -> Self { self.data = data; self }
    /// #     async fn update_batch_or_fail<C: Default + std::iter::Extend<Self>, F>(
    /// #         self, _conn: &mut DbConnection, _ids: impl IntoIterator<Item = i64> + Send, _fail: F
    /// #     ) -> Result<C, MyErrorType> { Ok(C::default()) }
    /// # }
    /// # #[derive(Debug)]
    /// # enum MyErrorType { DocumentsNotFound(HashSet<i64>) }
    /// # impl std::fmt::Display for MyErrorType {
    /// #     fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "error") }
    /// # }
    /// # impl std::error::Error for MyErrorType {}
    /// # async fn example(mut conn: DbConnection) -> Result<(), MyErrorType> {
    /// let docs: Vec<_> = Document::changeset()
    ///     .data(vec![])
    ///     .update_batch_or_fail(&mut conn, (0..5), |missing| {
    ///         MyErrorType::DocumentsNotFound(missing)
    ///     }).await?;
    /// # Ok(())
    /// # }
    /// ```
    async fn update_batch_or_fail<I, C, E, F>(
        self,
        conn: &mut DbConnection,
        ids: I,
        fail: F,
    ) -> Result<C, E>
    where
        I: Send + IntoIterator<Item = K>,
        C: Send
            + Default
            + std::iter::Extend<M>
            + std::iter::FromIterator<M>
            + std::iter::IntoIterator<Item = M>,
        E: From<Self::Error>,
        F: FnOnce(std::collections::HashSet<K>) -> E + Send,
    {
        let (result, missing) = self.update_batch::<_, C>(conn, ids).await?;
        if missing.is_empty() {
            Ok(result)
        } else {
            Err(fail(missing))
        }
    }

    /// Just like [UpdateBatch::update_batch_or_fail] but the returned models are paired with their key
    ///
    /// ```no_run
    /// # use editoast_models::prelude::*;
    /// # use database::DbConnection;
    /// # use std::collections::{BTreeMap, HashSet};
    /// # #[derive(Debug, PartialEq, Eq, Hash)]
    /// # struct Document { data: Vec<u8> }
    /// # impl Document {
    /// #     fn changeset() -> Self { Self { data: Vec::new() } }
    /// #     fn data(mut self, data: Vec<u8>) -> Self { self.data = data; self }
    /// #     async fn update_batch_with_key_or_fail<C: Default + std::iter::Extend<(i64, Self)>, F>(
    /// #         self, _conn: &mut DbConnection, _ids: impl IntoIterator<Item = i64> + Send, _fail: F
    /// #     ) -> Result<C, MyErrorType> { Ok(C::default()) }
    /// # }
    /// # #[derive(Debug)]
    /// # enum MyErrorType { DocumentsNotFound(HashSet<i64>) }
    /// # impl std::fmt::Display for MyErrorType {
    /// #     fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "error") }
    /// # }
    /// # impl std::error::Error for MyErrorType {}
    /// # async fn example(mut conn: DbConnection) -> Result<(), MyErrorType> {
    /// let docs: BTreeMap<_, _> = Document::changeset()
    ///     .data(vec![])
    ///     .update_batch_with_key_or_fail(&mut conn, (0..5), |missing| {
    ///         MyErrorType::DocumentsNotFound(missing)
    ///     }).await?;
    /// # Ok(())
    /// # }
    /// ```
    async fn update_batch_with_key_or_fail<I, C, E, F>(
        self,
        conn: &mut DbConnection,
        ids: I,
        fail: F,
    ) -> Result<C, E>
    where
        I: Send + IntoIterator<Item = K>,
        C: Send
            + Default
            + std::iter::Extend<(K, M)>
            + std::iter::FromIterator<(K, M)>
            + std::iter::IntoIterator<Item = (K, M)>,
        E: From<Self::Error>,
        F: FnOnce(std::collections::HashSet<K>) -> E + Send,
    {
        let (result, missing) = self.update_batch_with_key::<_, C>(conn, ids).await?;
        if missing.is_empty() {
            Ok(result)
        } else {
            Err(fail(missing))
        }
    }
}

// Auto-impl of UpdateBatch for all models that implement UpdateBatchUnchecked
impl<Cs, M, K> UpdateBatch<M, K> for Cs
where
    Cs: UpdateBatchUnchecked<M, K>,
    M: Model,
    K: Eq + std::hash::Hash + Clone + Send,
{
}
