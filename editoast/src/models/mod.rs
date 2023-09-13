mod documents;
pub mod electrical_profile;
pub mod infra;
pub mod infra_objects;
pub mod pathfinding;
mod projects;
pub mod rolling_stock;
mod scenario;
mod study;
mod text_array;
mod timetable;
pub mod train_schedule;

use crate::{error::Result, views::pagination::PaginatedResponse};
use crate::{schemas, DbPool};
use actix_web::web::Data;
use async_trait::async_trait;
use diesel_async::AsyncPgConnection as PgConnection;

pub use self::pathfinding::*;
pub use documents::Document;
pub use electrical_profile::ElectricalProfileSet;
pub use infra::{Infra, RAILJSON_VERSION};
pub use projects::{Ordering, Project, ProjectWithStudies};
pub use rolling_stock::{
    LightRollingStockModel, RollingStockLiveryModel, RollingStockModel,
    RollingStockSeparatedImageModel,
};
pub use scenario::{Scenario, ScenarioWithCountTrains, ScenarioWithDetails};
pub use study::{Study, StudyWithScenarios};
pub use text_array::TextArray;
pub use timetable::{
    check_train_validity, get_timetable_train_schedules, Timetable, TimetableWithSchedules,
    TimetableWithSchedulesDetails,
};
pub use train_schedule::{
    Allowance, FullResultStops, ResultPosition, ResultSpeed, ResultStops, ResultTrain,
    RoutingRequirement, ScheduledPoint, SignalSighting, SimulationOutput,
    SimulationOutputChangeset, SpacingRequirement, TrainSchedule, TrainScheduleChangeset,
    ZoneUpdate,
};

schemas! {
    infra::schemas(),
}

pub trait Identifiable {
    fn get_id(&self) -> i64;
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
    async fn create_conn(self, conn: &mut PgConnection) -> Result<Self>;

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
    async fn delete_conn(conn: &mut PgConnection, id: i64) -> Result<bool>;

    /// Delete an object given its ID (primary key).
    /// Return `false` if not found.
    ///
    /// ### Example
    ///
    /// ```
    /// assert!(Model::delete(db_pool, 42).await?);
    /// ```
    async fn delete(db_pool: Data<DbPool>, id: i64) -> Result<bool> {
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
    async fn retrieve_conn(conn: &mut PgConnection, id: i64) -> Result<Option<Self>>;

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
    async fn retrieve(db_pool: Data<DbPool>, id: i64) -> Result<Option<Self>> {
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
    /// Same as [update](Self::update) but takes a single postgres connection.
    /// Useful when you are in a transaction.
    async fn update_conn(self, conn: &mut PgConnection, id: i64) -> Result<Option<Self>>;

    /// Update an object given its ID (primary key).
    /// Return 'None' if not found.
    ///
    /// ### Example
    ///
    /// ```
    /// let patch_model = ...;
    /// let new_obj = patch_model.update(db_pool).await?.expect("Object not found");
    /// ```
    async fn update(self, db_pool: Data<DbPool>, id: i64) -> Result<Option<Self>> {
        let mut conn = db_pool.get().await?;
        self.update_conn(&mut conn, id).await
    }
}

/// Use this struct for list when there are no generic parameters
pub struct NoParams;

/// Trait to implement the `list` and `list_conn` methods.
/// This trait is automatically implemented by the `#[derive(Model)]` macro.
/// Check the macro documentation [here](editoast_derive::Model)
/// You can implement it manually if you want to customize the behavior.
#[async_trait]
pub trait List<T: Send + 'static>: Sized + 'static {
    /// Same as [list](Self::list) but takes a single postgres connection.
    /// Useful when you are in a transaction.
    async fn list_conn(
        conn: &mut PgConnection,
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
        db_pool: Data<DbPool>,
        page: i64,
        page_size: i64,
        params: T,
    ) -> Result<PaginatedResponse<Self>> {
        let mut conn = db_pool.get().await?;
        Self::list_conn(&mut conn, page, page_size, params).await
    }
}
