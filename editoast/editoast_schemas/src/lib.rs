pub mod infra;
pub mod primitives;
pub mod rolling_stock;
pub mod train_schedule;

editoast_common::schemas! {
    rolling_stock::schemas(),
    train_schedule::schemas(),
    primitives::schemas(),
    infra::schemas(),
}
