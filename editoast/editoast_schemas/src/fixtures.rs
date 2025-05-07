use std::collections::HashMap;

use editoast_common::units;

use crate::RollingStock;
use crate::rolling_stock::EffortCurves;
use crate::rolling_stock::LoadingGaugeType;
use crate::rolling_stock::RollingResistance;
use crate::rolling_stock::RollingResistancePerWeight;
use crate::rolling_stock::RollingStockSupportedSignalingSystems;
use crate::rolling_stock::TowedRollingStock;
use crate::rolling_stock::TrainCategories;
use crate::rolling_stock::TrainCategory;

pub fn simple_rolling_stock() -> RollingStock {
    RollingStock {
        name: "SIMPLE_ROLLING_STOCK".to_string(),
        loading_gauge: LoadingGaugeType::G1,
        supported_signaling_systems: RollingStockSupportedSignalingSystems(vec![]),
        base_power_class: None,
        comfort_acceleration: units::meter_per_second_squared::new(0.1),
        inertia_coefficient: units::basis_point::new(1.10),
        startup_acceleration: units::meter_per_second_squared::new(0.04),
        startup_time: units::second::new(1.0),
        effort_curves: EffortCurves::default(),
        electrical_power_startup_time: None,
        raise_pantograph_time: None,
        energy_sources: vec![],
        const_gamma: units::meter_per_second_squared::new(1.0),
        etcs_brake_params: None,
        locked: false,
        metadata: None,
        power_restrictions: HashMap::new(),
        railjson_version: "12".to_string(),
        rolling_resistance: RollingResistance {
            rolling_resistance_type: "davis".to_string(),
            // TODO those values are wrong, they correspond to daN/T, (daN/T)/(km/h), and (daN/T)/(km/h)²
            // We should use more realistic values and fix the tests
            A: units::newton::new(1.0),
            B: units::kilogram_per_second::new(0.01),
            C: units::kilogram_per_meter::new(0.0005),
        },
        length: units::meter::new(140.0),
        mass: units::kilogram::new(15000.0),
        max_speed: units::meter_per_second::new(20.0),
        primary_category: TrainCategory::HighSpeedTrain,
        other_categories: TrainCategories(vec![]),
    }
}

pub fn towed_rolling_stock() -> TowedRollingStock {
    TowedRollingStock {
        name: "TOWED_ROLLING_STOCK".to_string(),
        label: "towed".to_string(),
        mass: units::kilogram::new(50000.0),
        length: units::meter::new(30.0),
        comfort_acceleration: units::meter_per_second_squared::new(0.2),
        startup_acceleration: units::meter_per_second_squared::new(0.06),
        inertia_coefficient: units::basis_point::new(1.05),
        rolling_resistance: RollingResistancePerWeight {
            rolling_resistance_type: "davis".to_string(),
            // TODO those values are wrong, they correspond to daN/T, (daN/T)/(km/h), and (daN/T)/(km/h)² per weight
            // We should use more realistic values and fix the tests
            A: units::meter_per_second_squared::new(1.0),
            B: units::hertz::new(0.01),
            C: units::per_meter::new(0.0002),
        },
        const_gamma: units::meter_per_second_squared::new(0.5),
        max_speed: Some(units::meter_per_second::new(35.0)),
        railjson_version: "3.4".to_string(),
    }
}
