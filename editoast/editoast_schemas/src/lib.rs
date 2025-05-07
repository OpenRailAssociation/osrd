pub mod errors;
pub mod fixtures;
pub mod infra;
pub mod paced_train;
pub mod primitives;
pub mod rolling_stock;
pub mod train_schedule;

pub use rolling_stock::RollingStock;
pub use train_schedule::TrainSchedule;

editoast_common::schemas! {
    rolling_stock::schemas(),
    train_schedule::schemas(),
    primitives::schemas(),
    infra::schemas(),
    paced_train::schemas(),
}
