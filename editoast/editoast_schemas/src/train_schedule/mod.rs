mod allowance;
pub use allowance::Allowance;
pub use allowance::AllowanceDistribution;
pub use allowance::AllowanceValue;
pub use allowance::EngineeringAllowance;
pub use allowance::RangeAllowance;
pub use allowance::StandardAllowance;

editoast_common::schemas! {
    Allowance,
    AllowanceValue,
    AllowanceDistribution,
    RangeAllowance,
    EngineeringAllowance,
    StandardAllowance,
}
