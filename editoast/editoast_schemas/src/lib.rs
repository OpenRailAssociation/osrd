pub mod infra;
pub mod primitives;
pub mod rolling_stock;
pub mod track_offset;
pub mod train_schedule;

use primitives::ObjectType;

editoast_common::schemas! {
    rolling_stock::schemas(),
    train_schedule::schemas(),
    infra::schemas(),
    ObjectType,
}
