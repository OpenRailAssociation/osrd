pub mod pathfinding;
mod scenario;
mod text_array;
mod timetable;
pub mod train_schedule;

use async_trait::async_trait;
pub use scenario::Scenario;
pub use scenario::ScenarioWithCountTrains;
pub use scenario::ScenarioWithDetails;
use std::sync::Arc;
pub use text_array::TextArray;
pub use timetable::check_train_validity;
pub use timetable::Timetable;
pub use timetable::TimetableWithSchedulesDetails;
pub use train_schedule::FullResultStops;
pub use train_schedule::ResultPosition;
pub use train_schedule::ResultSpeed;
pub use train_schedule::ResultStops;
pub use train_schedule::ResultTrain;
pub use train_schedule::RoutingRequirement;
pub use train_schedule::ScheduledPoint;
pub use train_schedule::SignalSighting;
pub use train_schedule::SimulationOutput;
pub use train_schedule::SimulationOutputChangeset;
pub use train_schedule::SpacingRequirement;
pub use train_schedule::TrainSchedule;
pub use train_schedule::TrainScheduleChangeset;
pub use train_schedule::ZoneUpdate;

pub use self::pathfinding::*;
use crate::error::Result;
use crate::modelsv2::projects;
use crate::views::pagination::PaginatedResponse;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPool;

editoast_common::schemas! {
    projects::schemas(),
    train_schedule::schemas(),
    timetable::schemas(),
    pathfinding::schemas(),
}

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

/// Trait to implement the `create` and `create_conn` methods.
/// This trait is automatically implemented by the `#[derive(Model)]` macro.
/// Check the macro documentation [here](editoast_derive::Model)
/// You can implement it manually if you want to customize the behavior.
#[async_trait]
pub trait Create: Sized + 'static {
    /// Same as [create](Self::create) but takes a single postgres connection.
    /// Useful when you are in a transaction.
    async fn create_conn(self, conn: &mut DbConnection) -> Result<Self>;

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
    async fn create(self, db_pool: Arc<DbConnectionPool>) -> Result<Self> {
        let mut conn = db_pool.get().await?;
        Self::create_conn(self, &mut conn).await
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
    async fn delete_conn(conn: &mut DbConnection, id: i64) -> Result<bool>;

    /// Delete an object given its ID (primary key).
    /// Return `false` if not found.
    ///
    /// ### Example
    ///
    /// ```
    /// assert!(Model::delete(db_pool, 42).await?);
    /// ```
    async fn delete(db_pool: Arc<DbConnectionPool>, id: i64) -> Result<bool> {
        let mut conn = db_pool.get().await?;
        Self::delete_conn(&mut conn, id).await
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
    async fn retrieve_conn(conn: &mut DbConnection, id: i64) -> Result<Option<Self>>;

    /// Retrieve an object given its ID (primary key).
    /// Return 'None' if not found.
    ///
    /// ### Example
    ///
    /// ```
    /// if let Some(obj) = Model::retrieve(db_pool, 42).await? {
    ///     // do something with obj
    /// }
    /// ```
    async fn retrieve(db_pool: Arc<DbConnectionPool>, id: i64) -> Result<Option<Self>> {
        let mut conn = db_pool.get().await?;
        Self::retrieve_conn(&mut conn, id).await
    }
}

/// Trait to implement the `update` and `update_conn` methods.
/// This trait is automatically implemented by the `#[derive(Model)]` macro.
/// Check the macro documentation [here](editoast_derive::Model)
/// You can implement it manually if you want to customize the behavior.
#[async_trait]
pub trait Update: Sized + 'static {
    /// Update an object given its ID (primary key).
    /// Return 'None' if not found.
    ///
    /// ### Example
    ///
    /// ```
    /// let patch_model = ...;
    /// let new_obj = patch_model.update_conn(&mut conn, obj_id).await?.expect("Object not found");
    /// ```
    async fn update_conn(self, conn: &mut DbConnection, id: i64) -> Result<Option<Self>>;
}

/// Trait to implement the `list` and `list_conn` methods.
/// This trait is automatically implemented by the `#[derive(Model)]` macro.
/// Check the macro documentation [here](editoast_derive::Model)
/// You can implement it manually if you want to customize the behavior.
#[async_trait]
pub trait List<T: Send + 'static>: Sized + 'static {
    /// Same as [list](Self::list) but takes a single postgres connection.
    /// Useful when you are in a transaction.
    async fn list_conn(
        conn: &mut DbConnection,
        page: i64,
        page_size: i64,
        params: T,
    ) -> Result<PaginatedResponse<Self>>;

    /// List and paginate objects.
    ///
    /// ### Example
    ///
    /// ```
    /// let patch_model = ...;
    /// let new_obj = patch_model.update(db_pool).await?.expect("Object not found");
    /// ```
    async fn list(
        db_pool: Arc<DbConnectionPool>,
        page: i64,
        page_size: i64,
        params: T,
    ) -> Result<PaginatedResponse<Self>> {
        let mut conn = db_pool.get().await?;
        Self::list_conn(&mut conn, page, page_size, params).await
    }
}
