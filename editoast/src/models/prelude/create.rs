use std::fmt::Debug;

use editoast_models::model;
use editoast_models::DbConnection;

use crate::error::EditoastError;
use crate::error::Result;

use super::Model;

/// Describes how a [Model](super::Model) can be created in the database
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
pub trait Create<M: Model>: Sized {
    /// Creates a new row in the database with the values of the changeset and
    /// returns the created model instance
    async fn create(self, conn: &mut DbConnection) -> std::result::Result<M, M::Error>;

    /// Just like [Create::create] but discards the error if any and returns `Err(fail())` instead
    async fn create_or_fail<E: From<M::Error>, F: FnOnce() -> E + Send>(
        self,
        conn: &mut DbConnection,
        fail: F,
    ) -> std::result::Result<M, E> {
        match self.create(conn).await {
            Ok(obj) => Ok(obj),
            Err(_) => Err(fail()),
        }
    }
}

/// Describes how a [Model](super::Model) can be created in the database given a batch of its changesets
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait::async_trait]
pub trait CreateBatch<Cs>: Sized
where
    Cs: Send,
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
        C: Default + std::iter::Extend<Self> + Send + Debug,
    >(
        conn: &mut DbConnection,
        values: I,
    ) -> Result<C>;
}

/// Describes how a [Model](super::Model) can be created in the database given a batch of its changesets
///
/// This trait is similar to [CreateBatch] but the returned models are paired with their key.
/// There is two different traits because Rust cannot infer the type of the key when using
/// [CreateBatch::create_batch] with a model that has more than one identifier.
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait::async_trait]
pub trait CreateBatchWithKey<Cs, K>: Sized
where
    Cs: Send,
    K: Send + Clone,
{
    /// Just like [CreateBatch::create_batch] but the returned models are paired with their key
    async fn create_batch_with_key<
        I: IntoIterator<Item = Cs> + Send + 'async_trait,
        C: Default + std::iter::Extend<(K, Self)> + Send + Debug,
    >(
        conn: &mut DbConnection,
        values: I,
    ) -> Result<C>;
}
