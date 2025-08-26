use std::result::Result;

use database::DbConnection;

use super::Model;

/// Describes how a [Model] can be deleted from the database
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
pub trait Delete: Model {
    type Error: std::error::Error + From<crate::Error> + Send;

    /// Deletes the row corresponding to this model instance
    ///
    /// Returns `true` if the row was deleted, `false` if it didn't exist
    async fn delete(&self, conn: &mut DbConnection) -> Result<bool, Self::Error>;

    /// Just like [Delete::delete] but returns `Err(fail())` if the row didn't exist
    async fn delete_or_fail<E, F>(&self, conn: &mut DbConnection, fail: F) -> Result<(), E>
    where
        E: From<Self::Error>,
        F: FnOnce() -> E + Send,
    {
        match self.delete(conn).await {
            Ok(true) => Ok(()),
            Ok(false) => Err(fail()),
            Err(e) => Err(E::from(e)),
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
pub trait DeleteStatic<K>: Model
where
    K: Send,
{
    type Error: std::error::Error + From<crate::Error> + Send;

    /// Deletes the row #`id` from the database
    async fn delete_static(
        conn: &mut DbConnection,
        id: K,
    ) -> std::result::Result<bool, Self::Error>;

    /// Just like [DeleteStatic::delete_static] but returns `Err(fail())` if the row didn't exist
    async fn delete_static_or_fail<E, F>(conn: &mut DbConnection, id: K, fail: F) -> Result<(), E>
    where
        E: From<Self::Error>,
        F: FnOnce() -> E + Send,
    {
        match Self::delete_static(conn, id).await {
            Ok(true) => Ok(()),
            Ok(false) => Err(fail()),
            Err(e) => Err(E::from(e)),
        }
    }
}

/// Describes how a [Model] can be deleted from the database given a batch of keys
///
/// You can implement this type manually but its recommended to use the `Model`
/// derive macro instead.
pub trait DeleteBatch<K>: Model
where
    K: Send,
{
    type Error: std::error::Error + From<crate::Error> + Send;

    /// Deletes a batch of rows from the database given an iterator of keys
    ///
    /// Returns the number of rows deleted.
    async fn delete_batch<I: IntoIterator<Item = K> + Send>(
        conn: &mut DbConnection,
        ids: I,
    ) -> Result<usize, Self::Error>;

    /// Just like [DeleteBatch::delete_batch] but returns `Err(fail(missing))` where `missing`
    /// is the number of rows that were not deleted
    async fn delete_batch_or_fail<I, E, F>(
        conn: &mut DbConnection,
        ids: I,
        fail: F,
    ) -> Result<(), E>
    where
        I: Send + IntoIterator<Item = K>,
        E: From<Self::Error>,
        F: FnOnce(usize) -> E + Send,
    {
        let ids = ids.into_iter().collect::<Vec<_>>();
        let expected_count = ids.len();
        let count = Self::delete_batch(conn, ids).await?;
        if count != expected_count {
            Err(fail(expected_count - count))
        } else {
            Ok(())
        }
    }
}
