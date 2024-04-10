mod margins;
pub use margins::MarginValue;
pub use margins::Margins;

mod schedule_item;
pub use schedule_item::ScheduleItem;

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
    margins::schemas(),
    schedule_item::schemas(),
    // TODO TrainSchedule V1 (it will be removed)
    allowance::schemas(),
    rjs_power_restriction_range::schemas(),
}
