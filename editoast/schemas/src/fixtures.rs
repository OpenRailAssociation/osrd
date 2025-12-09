use std::collections::HashMap;
use std::str::FromStr;

use chrono::DateTime;
use chrono::Utc;
use common::units;

use crate::RollingStock;
use crate::paced_train::ConstraintDistributionChangeGroup;
use crate::paced_train::ExceptionType;
use crate::paced_train::InitialSpeedChangeGroup;
use crate::paced_train::LabelsChangeGroup;
use crate::paced_train::OptionsChangeGroup;
use crate::paced_train::PacedTrainException;
use crate::paced_train::PathAndScheduleChangeGroup;
use crate::paced_train::RollingStockCategoryChangeGroup;
use crate::paced_train::RollingStockChangeGroup;
use crate::paced_train::SpeedLimitTagChangeGroup;
use crate::paced_train::StartTimeChangeGroup;
use crate::paced_train::TrainNameChangeGroup;
use crate::primitives::NonBlankString;
use crate::rolling_stock::EffortCurves;
use crate::rolling_stock::LoadingGaugeType;
use crate::rolling_stock::RollingResistance;
use crate::rolling_stock::RollingResistancePerWeight;
use crate::rolling_stock::TowedRollingStock;
use crate::rolling_stock::TrainMainCategory;
use crate::rolling_stock::default_rolling_stock_railjson_version;
use crate::train_schedule::Comfort;
use crate::train_schedule::Distribution;
use crate::train_schedule::MarginValue;
use crate::train_schedule::Margins;
use crate::train_schedule::TrainScheduleOptions;

pub fn simple_rolling_stock() -> RollingStock {
    RollingStock {
        name: "SIMPLE_ROLLING_STOCK".to_string(),
        loading_gauge: LoadingGaugeType::G1,
        supported_signaling_systems: vec![],
        base_power_class: None,
        comfort_acceleration: units::millimeter_per_second_squared::new(100),
        inertia_coefficient: 1.10,
        startup_acceleration: units::millimeter_per_second_squared::new(40),
        startup_time: units::millisecond::new(1000),
        effort_curves: EffortCurves::default(),
        electrical_power_startup_time: None,
        raise_pantograph_time: None,
        energy_sources: vec![],
        const_gamma: units::millimeter_per_second_squared::new(100),
        etcs_brake_params: None,
        metadata: None,
        power_restrictions: HashMap::new(),
        railjson_version: "12".to_string(),
        rolling_resistance: RollingResistance {
            rolling_resistance_type: "davis".to_string(),
            // TODO those values are wrong, they correspond to daN/T, (daN/T)/(km/h), and (daN/T)/(km/h)²
            // We should use more realistic values and fix the tests
            A: units::newton::new(1),
            B: units::gram_per_second::new(10),
            C: units::milligram_per_meter::new(500),
        },
        length: units::millimeter::new(140_000),
        mass: units::kilogram::new(15000),
        max_speed: units::meter_per_second::new(20),
        primary_category: TrainMainCategory::HighSpeedTrain,
        other_categories: vec![],
    }
}

pub fn towed_rolling_stock() -> TowedRollingStock {
    TowedRollingStock {
        name: "TOWED_ROLLING_STOCK".to_string(),
        label: "towed".to_string(),
        mass: units::kilogram::new(50000),
        length: units::meter::new(30),
        comfort_acceleration: units::millimeter_per_second_squared::new(200),
        startup_acceleration: units::millimeter_per_second_squared::new(60),
        inertia_coefficient: 1.05,
        rolling_resistance: RollingResistancePerWeight {
            rolling_resistance_type: "davis".to_string(),
            // TODO those values are wrong, they correspond to daN/T, (daN/T)/(km/h), and (daN/T)/(km/h)² per weight
            // We should use more realistic values and fix the tests
            A: units::meter_per_second_squared::new(1),
            B: units::millihertz::new(10),
            C: units::per_nanometer::new(200),
        },
        const_gamma: units::millimeter_per_second_squared::new(50),
        max_speed: Some(units::meter_per_second::new(35)),
        railjson_version: default_rolling_stock_railjson_version(),
    }
}

pub fn simple_created_exception_with_change_groups(key: &str) -> PacedTrainException {
    PacedTrainException {
        key: key.into(),
        exception_type: ExceptionType::Created {},
        disabled: false,
        train_name: Some(TrainNameChangeGroup {
            value: "exception_train_name".into(),
        }),
        constraint_distribution: Some(ConstraintDistributionChangeGroup {
            value: Distribution::Mareco,
        }),
        initial_speed: Some(InitialSpeedChangeGroup { value: 10.0 }),
        labels: Some(LabelsChangeGroup {
            value: vec!["Label 1".to_string(), "Label 3".to_string()],
        }),
        options: Some(OptionsChangeGroup {
            value: TrainScheduleOptions::default(),
        }),
        path_and_schedule: Some(PathAndScheduleChangeGroup {
            power_restrictions: vec![],
            schedule: vec![],
            path: vec![],
            margins: Margins {
                boundaries: vec![],
                values: vec![MarginValue::Percentage(5.0)],
            },
        }),
        rolling_stock: Some(RollingStockChangeGroup {
            rolling_stock_name: "TJV".into(),
            comfort: Comfort::AirConditioning,
        }),
        rolling_stock_category: Some(RollingStockCategoryChangeGroup { value: None }),
        speed_limit_tag: Some(SpeedLimitTagChangeGroup {
            value: Some(NonBlankString("GB".into())),
        }),
        start_time: Some(StartTimeChangeGroup {
            value: DateTime::<Utc>::from_str("2025-05-05T20:05:00+02:00").unwrap(),
        }),
    }
}

pub fn simple_modified_exception_with_change_groups(
    key: &str,
    occurrence_index: i32,
) -> PacedTrainException {
    let mut exception = simple_created_exception_with_change_groups(key);
    exception.exception_type = ExceptionType::Modified { occurrence_index };
    exception
}
