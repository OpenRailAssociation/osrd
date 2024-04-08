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

mod supported_signaling_systems;
pub use supported_signaling_systems::RollingStockSupportedSignalingSystems;

mod rolling_stock_metadata;
pub use rolling_stock_metadata::RollingStockMetadata;

mod loading_gauge_type;
pub use loading_gauge_type::LoadingGaugeType;

mod rolling_stock_common;
pub use rolling_stock_common::RollingStockCommon;

mod rolling_stock_livery;
pub use rolling_stock_livery::RollingStockLivery;
pub use rolling_stock_livery::RollingStockLiveryMetadata;

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
    RollingStockSupportedSignalingSystems,
    RollingStockMetadata,
    LoadingGaugeType,
    RollingStockCommon,
    RollingStockLivery,
    RollingStockLiveryMetadata,
}
