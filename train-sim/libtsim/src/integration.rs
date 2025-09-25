use std::fmt;

const G: f64 = 9.81;
const SPEED_EPSILON: f64 = 1e-5;
const POSITION_EPSILON: f64 = 1e-2;

fn are_doubles_equal(a: f64, b: f64, epsilon: f64) -> bool {
    f64::abs(a - b) < epsilon
}

fn are_speeds_equal(a: f64, b: f64) -> bool {
    are_doubles_equal(a, b, SPEED_EPSILON)
}

fn are_positions_equal(a: f64, b: f64) -> bool {
    are_doubles_equal(a, b, POSITION_EPSILON)
}

/// Davis equation coefficients used to model the resistance to motion of a rolling stock.
///
/// They are usually set empirically for each type of rolling stock.
///
/// See <https://en.wikipedia.org/wiki/Rail_vehicle_resistance> for details.
#[derive(Clone, Copy)]
struct DavisCoefficients {
    /// Speed-independent term, in newtons
    pub a: f64,

    /// Speed-linear term, in newtons / (m/s) = kg/s
    pub b: f64,

    /// Acceleration-linear term, in newtons / (m/s²) = kg
    pub c: f64,
}

impl DavisCoefficients {
    /// The resistance to motion of the rolling stock, given its current `speed`, in newtons.
    pub fn rolling_resistance(&self, speed: f64) -> f64 {
        self.a + self.b * f64::abs(speed) + self.c * speed * speed
    }
}

impl fmt::Debug for DavisCoefficients {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let Self { a, b, c } = *self;
        write!(f, "{a}+{b}*v+{c}*v²")
    }
}

/// Characteristics of a specific rolling stock.
#[derive(Clone, Debug)]
struct RollingStock {
    // id: String, // TODO remove?
    davis: DavisCoefficients,
}

#[derive(Clone, Debug)]
struct IntegrationStep {
    pub time_delta: f64,
    pub position_delta: f64,
    pub start_speed: f64,

    /// Always positive. TODO rest of doc comment
    pub end_speed: f64,
    pub acceleration: f64,
    pub direction_sign: f64,
}

impl IntegrationStep {
    pub fn new(
        time_delta: f64,
        position_delta: f64,
        start_speed: f64,
        end_speed: f64,
        acceleration: f64,
        direction: Direction,
    ) -> Self {
        if end_speed < 0.0 {
            // TODO
        }
        todo!()
    }
}

#[derive(Clone, Copy, Debug)]
enum BrakingType {
    /// Constant deceleration
    Constant,

    /// Emergency Brake Deceleration
    Ebd,

    /// Emergency Brake Intervention
    Ebi,

    /// Service Brake Deceleration
    Sbd,

    /// Service Brake Intervention 1 - SBI curve computed from SBD
    Sbi1,

    /// Service Brake Intervention 2 - SBI curve computed from EBD
    Sbi2,

    Guidance,

    /// Permitted Speed before applying minimum with guidance
    PrePs,

    /// Permitted Speed
    Ps,

    Indication,
}

#[derive(Clone, Copy, Debug)]
enum Action {
    Accelerate,
    Brake,
    Maintain,
    Coast,
}

#[derive(Clone, Copy, Debug)]
enum Direction {
    Forwards,
    Backwards,
}

impl Direction {
    pub fn copysign(self, value: f64) -> f64 {
        let sign = match self {
            Self::Forwards => 1.0,
            Self::Backwards => -1.0,
        };
        f64::copysign(value, sign)
    }
}

fn newton_step(
    time_delta: f64,
    speed: f64,
    acceleration: f64,
    direction: Direction,
) -> IntegrationStep {
    let signed_time_delta = direction.copysign(time_delta);
    let mut new_speed = speed + acceleration * signed_time_delta;
    if are_speeds_equal(new_speed, 0.0) {
        new_speed = 0.0;
    }

    let mut position_delta =
        speed * signed_time_delta + 0.5 * acceleration * signed_time_delta * signed_time_delta;
    if are_positions_equal(position_delta, 0.0) {
        position_delta = 0.0;
    }

    IntegrationStep::new(
        time_delta,
        position_delta,
        speed,
        new_speed,
        acceleration,
        direction,
    )
}
