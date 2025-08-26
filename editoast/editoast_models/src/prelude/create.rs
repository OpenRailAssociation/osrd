use std::fmt::Debug;
use std::result::Result;

use database::DbConnection;

use super::Model;

/// Describes how a [Model] can be created in the database
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
pub trait Create<M: Model>: Sized {
    type Error: std::error::Error + From<crate::Error> + Send;

    /// Creates a new row in the database with the values of the changeset and
    /// returns the created model instance
    async fn create(self, conn: &mut DbConnection) -> Result<M, Self::Error>;

    /// Just like [Create::create] but discards the error if any and returns `Err(fail())` instead
    async fn create_or_fail<E: From<Self::Error>, F: FnOnce() -> E + Send>(
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

/// Describes how a [Model] can be created in the database given a batch of its changesets
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
pub trait CreateBatch: Model {
    type Error: std::error::Error + From<crate::Error> + Send;

    /// Creates a batch of rows in the database given an iterator of changesets
    ///
    /// Returns a collection of the created rows.
    /// ```no_run
    /// # use editoast_models::prelude::*;
    /// # use database::DbConnection;
    /// # #[derive(Debug, PartialEq, Eq, Hash)]
    /// # struct Document;
    /// # impl Document {
    /// #     fn changeset() -> Self { Self }
    /// #     fn content_type(self, _: String) -> Self { self }
    /// #     fn data(self, _: Vec<u8>) -> Self { self }
    /// #     async fn create_batch<C: Default>(_conn: &mut DbConnection, _changesets: impl IntoIterator<Item = Self> + Send) -> Result<C, std::io::Error> { Ok(C::default()) }
    /// # }
    /// # async fn example(mut conn: DbConnection) -> Result<(), std::io::Error> {
    /// let changesets = (0..5).map(|i| {
    ///     Document::changeset()
    ///         .content_type(String::from("text/plain"))
    ///         .data(vec![i])
    /// });
    /// let docs: Vec<Document> = Document::create_batch(&mut conn, changesets).await?;
    /// assert_eq!(docs.len(), 5);
    /// # Ok(())
    /// # }
    async fn create_batch<
        I: IntoIterator<Item = Self::Changeset> + Send,
        C: Default + std::iter::Extend<Self> + Send + Debug,
    >(
        conn: &mut DbConnection,
        values: I,
    ) -> Result<C, Self::Error>;
}

/// Describes how a [Model] can be created in the database given a batch of its changesets
///
/// This trait is similar to [CreateBatch] but the returned models are paired with their key.
/// There is two different traits because Rust cannot infer the type of the key when using
/// [CreateBatch::create_batch] with a model that has more than one identifier.
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
pub trait CreateBatchWithKey<K>: Model
where
    K: Send + Clone,
{
    type Error: std::error::Error + From<crate::Error> + Send;

    /// Just like [CreateBatch::create_batch] but the returned models are paired with their key
    async fn create_batch_with_key<
        I: IntoIterator<Item = Self::Changeset> + Send,
        C: Default + std::iter::Extend<(K, Self)> + Send + Debug,
    >(
        conn: &mut DbConnection,
        values: I,
    ) -> Result<C, Self::Error>;
}
