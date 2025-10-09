use std::ops::Bound;
use std::sync::Mutex;

uniffi::setup_scaffolding!();

#[derive(uniffi::Record, Clone, Copy)]
pub struct DavisCoefficients {
    pub a: f64,
    pub b: f64,
    pub c: f64,
}

impl From<DavisCoefficients> for libtsim::DavisCoefficients {
    fn from(value: DavisCoefficients) -> Self {
        libtsim::DavisCoefficients {
            a: value.a,
            b: value.b,
            c: value.c,
        }
    }
}

#[derive(uniffi::Record)]
pub struct RollingStock {
    pub davis: DavisCoefficients,
    pub const_gamma: f64,
    pub length: f64,
    pub mass: f64,
    pub inertia: f64,
}

#[uniffi::export(with_foreign)]
pub trait TrainPath: Send + Sync {
    fn length(&self) -> f64;

    fn avg_grade(&self, start: f64, end: f64) -> f64;

    fn min_grade(&self, start: f64, end: f64) -> f64;
}

struct SalutÀTous<'a>(&'a dyn TrainPath);

impl libtsim::TrainPath for SalutÀTous<'_> {
    fn length(&self) -> f64 {
        TrainPath::length(self.0)
    }

    fn avg_grade(&self, start: f64, end: f64) -> f64 {
        TrainPath::avg_grade(self.0, start, end)
    }

    fn min_grade(&self, start: f64, end: f64) -> f64 {
        TrainPath::min_grade(self.0, start, end)
    }

    fn electrification_map(
        &self,
        _base_power_class: &str,
        _power_restrictions: &libtsim::RangeMap<f64, String>,
        _power_restriction_to_power_class: &libtsim::RangeMap<String, String>,
        _ignore_electrical_profiles: bool,
    ) -> libtsim::RangeMap<f64, Option<libtsim::Electrification>> {
        todo!()
    }
}

#[derive(uniffi::Record, Debug)]
pub struct HalfOpenRangeF64 {
    pub start: f64,
    pub end: f64,
}

#[derive(uniffi::Record, Debug)]
pub struct TractiveEffortPoint {
    pub speed: f64,
    pub max_effort: f64,
}

/// XXX: generics when???? https://github.com/mozilla/uniffi-rs/issues/1755
#[derive(uniffi::Object)]
pub struct TractiveEffortCurveMap {
    // XXX: https://mozilla.github.io/uniffi-rs/latest/types/interfaces.html#concurrent-access
    inner: Mutex<libtsim::RangeMap<f64, Box<[libtsim::TractiveEffortPoint]>>>,
}

#[uniffi::export]
impl TractiveEffortCurveMap {
    #[uniffi::constructor]
    fn new() -> Self {
        Self {
            inner: Mutex::new(libtsim::RangeMap::new()),
        }
    }

    fn insert(&self, range: HalfOpenRangeF64, value: Vec<TractiveEffortPoint>) {
        let range = libtsim::Range::new(Bound::Included(range.start), Bound::Excluded(range.end));
        let value = value
            .into_iter()
            .map(|pt| libtsim::TractiveEffortPoint {
                speed: pt.speed,
                max_effort: pt.max_effort,
            })
            .collect::<Vec<libtsim::TractiveEffortPoint>>()
            .into_boxed_slice();
        self.inner.lock().unwrap().insert(range, value);
    }
}

#[derive(uniffi::Enum)]
pub enum Action {
    Accelerate,
    Brake,
    Maintain,
    Coast,
}

impl From<Action> for libtsim::Action {
    fn from(value: Action) -> Self {
        match value {
            Action::Accelerate => libtsim::Action::Accelerate,
            Action::Brake => libtsim::Action::Brake,
            Action::Maintain => libtsim::Action::Maintain,
            Action::Coast => libtsim::Action::Coast,
        }
    }
}

#[derive(uniffi::Enum)]
pub enum Direction {
    Forwards,
    Backwards,
}

impl From<Direction> for libtsim::Direction {
    fn from(value: Direction) -> Self {
        match value {
            Direction::Forwards => libtsim::Direction::Forwards,
            Direction::Backwards => libtsim::Direction::Backwards,
        }
    }
}

impl From<libtsim::Direction> for Direction {
    fn from(value: libtsim::Direction) -> Self {
        match value {
            libtsim::Direction::Forwards => Direction::Forwards,
            libtsim::Direction::Backwards => Direction::Backwards,
        }
    }
}

#[derive(uniffi::Enum)]
pub enum BrakingType {
    Constant,
    Ebd,
    Ebi,
    Sbd,
    Sbi1,
    Sbi2,
    Guidance,
    PrePs,
    Ps,
    Indication,
}

impl From<BrakingType> for libtsim::BrakingType {
    fn from(value: BrakingType) -> Self {
        match value {
            BrakingType::Constant => libtsim::BrakingType::Constant,
            BrakingType::Ebd => libtsim::BrakingType::Ebd,
            BrakingType::Ebi => libtsim::BrakingType::Ebi,
            BrakingType::Sbd => libtsim::BrakingType::Sbd,
            BrakingType::Sbi1 => libtsim::BrakingType::Sbi1,
            BrakingType::Sbi2 => libtsim::BrakingType::Sbi2,
            BrakingType::Guidance => libtsim::BrakingType::Guidance,
            BrakingType::PrePs => libtsim::BrakingType::PrePs,
            BrakingType::Ps => libtsim::BrakingType::Ps,
            BrakingType::Indication => libtsim::BrakingType::Indication,
        }
    }
}

#[derive(uniffi::Record)]
pub struct IntegrationStep {
    pub time_delta: f64,
    pub position_delta: f64,
    pub start_speed: f64,
    pub end_speed: f64,
    pub acceleration: f64,
    pub direction: Direction,
}

impl From<libtsim::IntegrationStep> for IntegrationStep {
    fn from(value: libtsim::IntegrationStep) -> Self {
        IntegrationStep {
            time_delta: value.time_delta,
            position_delta: value.position_delta,
            start_speed: value.start_speed,
            end_speed: value.end_speed,
            acceleration: value.acceleration,
            direction: value.direction.into(),
        }
    }
}

#[uniffi::export]
#[allow(clippy::too_many_arguments)]
pub fn step(
    rolling_stock: RollingStock,
    path: &dyn TrainPath,
    time_delta: f64,
    tractive_effort_curve_map: &TractiveEffortCurveMap,
    initial_position: f64,
    initial_speed: f64,
    action: Action,
    direction: Direction,
    braking_type: BrakingType,
) -> IntegrationStep {
    let rolling_stock = libtsim::RollingStock {
        davis: rolling_stock.davis.into(),
        const_gamma: rolling_stock.const_gamma,
        length: rolling_stock.length,
        mass: rolling_stock.mass,
        inertia: rolling_stock.inertia,
    };
    libtsim::step(
        &rolling_stock,
        &SalutÀTous(path),
        time_delta,
        &tractive_effort_curve_map.inner.lock().unwrap(),
        initial_position,
        initial_speed,
        action.into(),
        direction.into(),
        braking_type.into(),
    )
    .into()
}
