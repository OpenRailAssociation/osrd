mod gamma;
pub use gamma::Gamma;

mod effort_curves;
pub use effort_curves::ConditionalEffortCurve;
pub use effort_curves::EffortCurve;
pub use effort_curves::EffortCurveConditions;
pub use effort_curves::EffortCurves;
pub use effort_curves::ModeEffortCurves;
pub use effort_curves::RollingStockComfortType;

mod rolling_resistance;
pub use rolling_resistance::RollingResistance;

mod energy_source;
pub use energy_source::EnergySource;
pub use energy_source::EnergyStorage;
pub use energy_source::RefillLaw;
pub use energy_source::SpeedDependantPower;

editoast_common::schemas! {
    Gamma,
    ConditionalEffortCurve,
    EffortCurve,
    EffortCurves,
    EffortCurveConditions,
    ModeEffortCurves,
    RollingStockComfortType,
    RollingResistance,
    EnergySource,
    EnergyStorage,
    RefillLaw,
    SpeedDependantPower,
}
