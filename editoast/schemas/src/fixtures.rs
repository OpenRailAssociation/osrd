use std::collections::HashMap;
use std::collections::HashSet;

use common::units;

use crate::RollingStock;
use crate::rolling_stock::EffortCurves;
use crate::rolling_stock::LoadingGaugeType;
use crate::rolling_stock::RollingResistance;
use crate::rolling_stock::RollingResistancePerWeight;
use crate::rolling_stock::TowedRollingStock;
use crate::rolling_stock::TrainMainCategory;
use crate::rolling_stock::default_rolling_stock_railjson_version;

pub fn simple_rolling_stock() -> RollingStock {
    RollingStock {
        name: "SIMPLE_ROLLING_STOCK".to_string(),
        loading_gauge: LoadingGaugeType::G1,
        supported_signaling_systems: HashSet::new(),
        base_power_class: None,
        comfort_acceleration: units::meter_per_second_squared::new(0.1),
        inertia_coefficient: 1.10,
        startup_acceleration: units::meter_per_second_squared::new(0.04),
        startup_time: units::second::new(1.0),
        effort_curves: EffortCurves::default(),
        electrical_power_startup_time: None,
        raise_pantograph_time: None,
        energy_sources: vec![],
        const_gamma: units::meter_per_second_squared::new(1.0),
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
        primary_category: TrainMainCategory::HighSpeedTrain,
        other_categories: vec![],
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
        inertia_coefficient: 1.05,
        rolling_resistance: RollingResistancePerWeight {
            rolling_resistance_type: "davis".to_string(),
            // TODO those values are wrong, they correspond to daN/T, (daN/T)/(km/h), and (daN/T)/(km/h)²
            // We should use more realistic values and fix the tests
            A: units::meter_per_second_squared::new(1.0),
            B: units::hertz::new(0.01),
            C: units::per_meter::new(0.0002),
        },
        const_gamma: units::meter_per_second_squared::new(0.5),
        max_speed: Some(units::meter_per_second::new(35.0)),
        railjson_version: default_rolling_stock_railjson_version(),
    }
}

pub fn fast_rolling_stock() -> RollingStock {
    serde_json::from_str::<crate::RollingStock>(include_str!("../examples/fast_rolling_stock.json"))
        .expect("Unable to parse example rolling stock")
}

pub fn rolling_stock_with_energy_sources() -> RollingStock {
    serde_json::from_str::<crate::RollingStock>(include_str!(
        "../examples/fast_rolling_stock_with_energy_sources.json"
    ))
    .expect("Unable to parse rolling stock with energy sources")
}

pub fn rolling_stock_with_invalid_effort_curves_json() -> &'static str {
    include_str!("../examples/rolling_stock_invalid_effort_curves.json")
}

pub fn small_infra() -> crate::infra::RailJson {
    serde_json::from_str(include_str!(
        "../../../tests/data/infras/small_infra/infra.json"
    ))
    .expect("Unable to parse small infra RailJson")
}
