use std::ops::Bound;
use std::sync::Mutex;

uniffi::setup_scaffolding!();

#[derive(uniffi::Record)]
pub struct RollingStock {
    mass: f64,
    inertia: f64,
    length: f64,
    max_speed: f64,
    a: f64,
    b: f64,
    c: f64,
    const_gamma: f64,
}

impl tsim::RollingStock for RollingStock {
    fn mass(&self) -> f64 {
        self.mass
    }

    fn inertia(&self) -> f64 {
        self.inertia
    }

    fn length(&self) -> f64 {
        self.length
    }

    fn max_speed(&self) -> f64 {
        self.max_speed
    }

    fn rolling_resistance(&self, speed: f64) -> f64 {
        self.a + self.b * f64::abs(speed) + self.c * speed * speed
    }

    fn rolling_resistance_deriv(&self, speed: f64) -> f64 {
        self.b + 2.0 * self.c * f64::abs(speed)
    }

    fn deceleration(&self) -> f64 {
        -self.const_gamma
    }
}

#[derive(uniffi::Record)]
pub struct TrainPath {
    length: f64,
    grade: f64,
}

impl tsim::TrainPath for TrainPath {
    fn length(&self) -> f64 {
        self.length
    }

    fn avg_grade(&self, start: f64, end: f64) -> f64 {
        self.grade
    }

    fn min_grade(&self, start: f64, end: f64) -> f64 {
        self.grade
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
    rolling_stock: &RollingStock,
    path: &TrainPath,
    time_delta: f64,
    tractive_effort_curve_map: &TractiveEffortCurveMap,
    initial_position: f64,
    initial_speed: f64,
    action: Action,
    direction: Direction,
    braking_type: BrakingType,
) -> IntegrationStep {
    tsim::step(
        rolling_stock,
        path,
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
