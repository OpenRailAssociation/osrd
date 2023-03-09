mod documents;

use crate::error::Result;
use actix_web::web::{block, Data};
use async_trait::async_trait;
use diesel::PgConnection;
pub use documents::Document;

use crate::DbPool;

/// Trait to implement the `create` and `create_conn` methods.
/// This trait is automatically implemented by the `#[derive(Model)]` macro.
/// Check the macro documentation [here](editoast_derive::Model)
/// You can implement it manually if you want to customize the behavior.
#[async_trait]
pub trait Create: Sized + 'static {
    /// Same as [create](Self::create) but takes a single postgres connection.
    /// Useful when you are in a transaction.
    fn create_conn(self, conn: &mut PgConnection) -> Result<Self>;

    /// Create a new Object in the database.
    /// Returns the created object with its default values filled (like the id).
    ///
    /// ### Example
    ///
    /// ```
    /// let obj = ...;
    /// let created_obj = obj.create(db_pool).await?;
    /// let obj_id = created_obj.id.unwrap();
    /// ```
    async fn create(self, db_pool: Data<DbPool>) -> Result<Self> {
        block::<_, crate::error::Result<Self>>(move || {
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            Self::create_conn(self, &mut conn)
        })
        .await
        .unwrap()
    }
}

/// Trait to implement the `delete` and `delete_conn` methods.
/// This trait is automatically implemented by the `#[derive(Model)]` macro.
/// Check the macro documentation [here](editoast_derive::Model)
/// You can implement it manually if you want to customize the behavior.
#[async_trait]
pub trait Delete {
    /// Same as [delete](Self::delete) but takes a single postgres connection.
    /// Useful when you are in a transaction.
    fn delete_conn(conn: &mut PgConnection, id: i64) -> Result<bool>;

    /// Delete an given its ID (primary key).
    /// Return `false` if not found.
    ///
    /// ### Example
    ///
    /// ```
    /// assert!({model_name}::delete(db_pool, 42).await?);
    /// ```
    async fn delete(db_pool: Data<DbPool>, id: i64) -> Result<bool> {
        block::<_, crate::error::Result<_>>(move || {
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            Self::delete_conn(&mut conn, id)
        })
        .await
        .unwrap()
    }
}

/// Trait to implement the `retrieve` and `retrieve_conn` methods.
/// This trait is automatically implemented by the `#[derive(Model)]` macro.
/// Check the macro documentation [here](editoast_derive::Model)
/// You can implement it manually if you want to customize the behavior.
#[async_trait]
pub trait Retrieve: Sized + 'static {
    /// Same as [retrieve](Self::retrieve) but takes a single postgres connection.
    /// Useful when you are in a transaction.
    fn retrieve_conn(conn: &mut PgConnection, id: i64) -> Result<Option<Self>>;

    /// Create a new object in the database.
    /// Returns the created object with its default values filled (like the id).
    /// Return `None` if not found.
    ///
    /// ### Example
    ///
    /// ```
    /// let obj = ...;
    /// let created_obj = obj.create(db_pool).await?;
    /// let obj_id = created_obj.id.unwrap();
    /// ```
    async fn retrieve(db_pool: Data<DbPool>, id: i64) -> Result<Option<Self>> {
        block::<_, crate::error::Result<_>>(move || {
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            Self::retrieve_conn(&mut conn, id)
        })
        .await
        .unwrap()
    }
}
