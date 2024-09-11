mod margins;
pub use margins::MarginValue;
pub use margins::Margins;

mod schedule_item;
pub use schedule_item::ReceptionSignal;
pub use schedule_item::ScheduleItem;

mod path_item;
pub use path_item::PathItem;
pub use path_item::PathItemLocation;

mod train_schedule_options;
pub use train_schedule_options::TrainScheduleOptions;

mod power_restriction_item;
pub use power_restriction_item::PowerRestrictionItem;

mod distribution;
pub use distribution::Distribution;

mod comfort;
pub use comfort::Comfort;

mod train_schedule_base;
pub use train_schedule_base::TrainScheduleBase;

mod allowance;
pub use allowance::Allowance;
pub use allowance::AllowanceDistribution;
pub use allowance::AllowanceValue;
pub use allowance::EngineeringAllowance;
pub use allowance::RangeAllowance;
pub use allowance::StandardAllowance;

mod rjs_power_restriction_range;
pub use rjs_power_restriction_range::RjsPowerRestrictionRange;

editoast_common::schemas! {
    train_schedule_base::schemas(),
    margins::schemas(),
    schedule_item::schemas(),
    path_item::schemas(),
    train_schedule_options::schemas(),
    power_restriction_item::schemas(),
    distribution::schemas(),
    comfort::schemas(),
    // TODO TrainSchedule V1 (it will be removed)
    allowance::schemas(),
    rjs_power_restriction_range::schemas(),
}
