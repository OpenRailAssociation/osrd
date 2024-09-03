use editoast_models::DbConnection;

use crate::error::EditoastError;
use crate::error::Result;

/// Describes how a [Model](super::Model) can be deleted from the database
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait::async_trait]
pub trait Delete: Sized {
    /// Deletes the row corresponding to this model instance
    ///
    /// Returns `true` if the row was deleted, `false` if it didn't exist
    async fn delete(&self, conn: &DbConnection) -> Result<bool>;

    /// Just like [Delete::delete] but returns `Err(fail())` if the row didn't exist
    async fn delete_or_fail<E, F>(&self, conn: &DbConnection, fail: F) -> Result<()>
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

/// Describes how a [Model](super::Model) can be deleted from the database
///
/// This trait is similar to [Delete] but it doesn't take a reference to the model
/// instance. This is useful for models that don't have to be retrieved before deletion.
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
#[async_trait::async_trait]
pub trait DeleteStatic<K>: Sized
where
    for<'async_trait> K: Send + 'async_trait,
{
    /// Deletes the row #`id` from the database
    async fn delete_static(conn: &DbConnection, id: K) -> Result<bool>;

    /// Just like [DeleteStatic::delete_static] but returns `Err(fail())` if the row didn't exist
    async fn delete_static_or_fail<E, F>(conn: &DbConnection, id: K, fail: F) -> Result<()>
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

/// Describes how a [Model](super::Model) can be deleted from the database given a batch of keys
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
        conn: &DbConnection,
        ids: I,
    ) -> Result<usize>;

    /// Just like [DeleteBatch::delete_batch] but returns `Err(fail(missing))` where `missing`
    /// is the number of rows that were not deleted
    async fn delete_batch_or_fail<I, E, F>(conn: &DbConnection, ids: I, fail: F) -> Result<()>
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
