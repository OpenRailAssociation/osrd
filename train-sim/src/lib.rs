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

#[uniffi::export]
pub trait TrainPath: libtsim::TrainPath + Send + Sync {}

/// XXX: generics when???? https://github.com/mozilla/uniffi-rs/issues/1755
#[derive(uniffi::Object)]
pub struct TractiveEffortCurveMap {
    inner: libtsim::RangeMap<f64, Box<[libtsim::TractiveEffortPoint]>>,
}

#[uniffi::export]
impl TractiveEffortCurveMap {
    #[uniffi::constructor]
    fn new() -> Self {
        Self {
            inner: libtsim::RangeMap::new(),
        }
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
    rolling_stock: &RollingStock,
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
        path,
        time_delta,
        &tractive_effort_curve_map.inner,
        initial_position,
        initial_speed,
        action.into(),
        direction.into(),
        braking_type.into(),
    )
    .into()
}
