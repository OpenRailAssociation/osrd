use std::ops::Bound;
use std::sync::Mutex;

uniffi::setup_scaffolding!();

#[uniffi::export(with_foreign)]
pub trait RollingStock: Send + Sync {
    /// The mass of the train, in kilograms
    fn mass(&self) -> f64;

    /// The inertia of the train, in newtons (usually computed from mass * inertiaCoefficient)
    fn inertia(&self) -> f64;

    /// The length of the train, in meters
    fn length(&self) -> f64;

    /// The maximum speed the train can reach, in m/s
    fn max_speed(&self) -> f64;

    /// The resistance to movement at a given speed, in newtons
    fn rolling_resistance(&self, speed: f64) -> f64;

    /// The first derivative of the resistance to movement at a given speed, in kg/s
    fn rolling_resistance_deriv(&self, speed: f64) -> f64;

    /// The maximum constant deceleration, in m/s^2
    fn deceleration(&self) -> f64;
}

struct RollingStockWrapper<'a>(&'a dyn RollingStock);

impl tsim::RollingStock for RollingStockWrapper<'_> {
    fn mass(&self) -> f64 {
        RollingStock::mass(self.0)
    }

    fn inertia(&self) -> f64 {
        RollingStock::inertia(self.0)
    }

    fn length(&self) -> f64 {
        RollingStock::length(self.0)
    }

    fn max_speed(&self) -> f64 {
        RollingStock::max_speed(self.0)
    }

    fn rolling_resistance(&self, speed: f64) -> f64 {
        RollingStock::rolling_resistance(self.0, speed)
    }

    fn rolling_resistance_deriv(&self, speed: f64) -> f64 {
        RollingStock::rolling_resistance_deriv(self.0, speed)
    }

    fn deceleration(&self) -> f64 {
        RollingStock::deceleration(self.0)
    }
}

#[uniffi::export(with_foreign)]
pub trait TrainPath: Send + Sync {
    fn length(&self) -> f64;

    fn avg_grade(&self, start: f64, end: f64) -> f64;

    fn min_grade(&self, start: f64, end: f64) -> f64;
}

struct TrainPathWrapper<'a>(&'a dyn TrainPath);

impl tsim::TrainPath for TrainPathWrapper<'_> {
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
        _power_restrictions: &tsim::RangeMap<f64, String>,
        _power_restriction_to_power_class: &tsim::RangeMap<String, String>,
        _ignore_electrical_profiles: bool,
    ) -> tsim::RangeMap<f64, Option<tsim::Electrification>> {
        todo!()
    }
}

#[derive(uniffi::Record, Debug)]
pub struct ClosedRangeF64 {
    pub start: Option<f64>,
    pub end: Option<f64>,
}

impl From<ClosedRangeF64> for tsim::Range<f64> {
    fn from(r: ClosedRangeF64) -> Self {
        let start = r.start.map_or(Bound::Unbounded, Bound::Included);
        let end = r.end.map_or(Bound::Unbounded, Bound::Included);
        Self::new(start, end)
    }
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
    inner: Mutex<tsim::RangeMap<f64, Box<[tsim::TractiveEffortPoint]>>>,
}

#[uniffi::export]
impl TractiveEffortCurveMap {
    #[uniffi::constructor]
    fn new() -> Self {
        Self {
            inner: Mutex::new(tsim::RangeMap::new()),
        }
    }

    fn insert(&self, range: ClosedRangeF64, value: Vec<TractiveEffortPoint>) {
        let range = tsim::Range::from(range);
        let value = value
            .into_iter()
            .map(|pt| tsim::TractiveEffortPoint {
                speed: pt.speed,
                max_effort: pt.max_effort,
            })
            .collect::<Vec<tsim::TractiveEffortPoint>>()
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

impl From<Action> for tsim::Action {
    fn from(value: Action) -> Self {
        match value {
            Action::Accelerate => tsim::Action::Accelerate,
            Action::Brake => tsim::Action::Brake,
            Action::Maintain => tsim::Action::Maintain,
            Action::Coast => tsim::Action::Coast,
        }
    }
}

#[derive(uniffi::Enum)]
pub enum Direction {
    Forwards,
    Backwards,
}

impl From<Direction> for tsim::Direction {
    fn from(value: Direction) -> Self {
        match value {
            Direction::Forwards => tsim::Direction::Forwards,
            Direction::Backwards => tsim::Direction::Backwards,
        }
    }
}

impl From<tsim::Direction> for Direction {
    fn from(value: tsim::Direction) -> Self {
        match value {
            tsim::Direction::Forwards => Direction::Forwards,
            tsim::Direction::Backwards => Direction::Backwards,
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

impl From<BrakingType> for tsim::BrakingType {
    fn from(value: BrakingType) -> Self {
        match value {
            BrakingType::Constant => tsim::BrakingType::Constant,
            BrakingType::Ebd => tsim::BrakingType::Ebd,
            BrakingType::Ebi => tsim::BrakingType::Ebi,
            BrakingType::Sbd => tsim::BrakingType::Sbd,
            BrakingType::Sbi1 => tsim::BrakingType::Sbi1,
            BrakingType::Sbi2 => tsim::BrakingType::Sbi2,
            BrakingType::Guidance => tsim::BrakingType::Guidance,
            BrakingType::PrePs => tsim::BrakingType::PrePs,
            BrakingType::Ps => tsim::BrakingType::Ps,
            BrakingType::Indication => tsim::BrakingType::Indication,
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

impl From<tsim::IntegrationStep> for IntegrationStep {
    fn from(value: tsim::IntegrationStep) -> Self {
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
    rolling_stock: &dyn RollingStock,
    path: &dyn TrainPath,
    time_delta: f64,
    tractive_effort_curve_map: &TractiveEffortCurveMap,
    initial_position: f64,
    initial_speed: f64,
    action: Action,
    direction: Direction,
    braking_type: BrakingType,
) -> IntegrationStep {
    tsim::step(
        &RollingStockWrapper(rolling_stock),
        &TrainPathWrapper(path),
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
