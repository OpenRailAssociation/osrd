use crate::RangeMap;
use std::cmp::Ordering;
use std::fmt;

const G: f64 = 9.80665;
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
pub struct DavisCoefficients {
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
pub struct RollingStock {
    /// Rolling resistance coefficients
    pub davis: DavisCoefficients,

    /// the deceleration of the train, in m/s^2
    pub const_gamma: f64,

    /// Length of the rolling stock in meters
    pub length: f64,

    /// Mass of the rolling stock in kilograms
    pub mass: f64,

    /// Defined as mass * inertiaCoefficient
    pub inertia: f64,
}

/// The effort a rolling stock can apply at a given speed, in newtons.
///
/// This function interpolates linearly between the tractive effort points.
pub fn max_effort(speed: f64, tractive_effort_curve: &[TractiveEffortPoint]) -> f64 {
    assert!(!tractive_effort_curve.is_empty());

    let speed = f64::abs(speed);
    let res = tractive_effort_curve.binary_search_by(|point| {
        let diff = point.speed - speed;
        if f64::abs(diff) < 0.000001 {
            Ordering::Equal
        } else {
            f64::total_cmp(&point.speed, &speed)
        }
    });

    match res {
        Ok(i) => tractive_effort_curve[i].max_effort,
        Err(i) => {
            if i == 0 {
                tractive_effort_curve[0].max_effort
            } else if i == tractive_effort_curve.len() {
                tractive_effort_curve.last().unwrap().max_effort
            } else {
                let prev = tractive_effort_curve[i - 1];
                let next = tractive_effort_curve[i];
                prev.max_effort
                    + (speed - prev.speed) / (next.speed - prev.speed)
                        * (next.max_effort - prev.max_effort)
            }
        }
    }
}

#[derive(Clone, Debug)]
pub struct IntegrationStep {
    pub time_delta: f64,
    pub position_delta: f64,
    pub start_speed: f64,

    /// Always positive. TODO rest of doc comment
    pub end_speed: f64,
    pub acceleration: f64,
    pub direction: Direction,
}

impl IntegrationStep {
    pub fn new(
        mut time_delta: f64,
        mut position_delta: f64,
        start_speed: f64,
        mut end_speed: f64,
        acceleration: f64,
        direction: Direction,
    ) -> Self {
        if end_speed < 0.0 {
            // The end of the step dips below zero, so cut the step in half
            assert!(direction.sign() * acceleration < 0.0);
            end_speed = 0.0;
            time_delta = -start_speed / direction.sign() * acceleration;
            position_delta =
                start_speed * time_delta + 0.5 * acceleration * time_delta * time_delta;
            position_delta = direction.copysign(position_delta);
        }

        assert!(are_speeds_equal(
            end_speed,
            start_speed + direction.sign() * acceleration * time_delta,
        ));

        Self {
            time_delta,
            position_delta,
            start_speed,
            end_speed,
            acceleration,
            direction,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub enum BrakingType {
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
pub enum Action {
    Accelerate,
    Brake,
    Maintain,
    Coast,
}

#[derive(Clone, Copy, Debug)]
pub enum Direction {
    Forwards,
    Backwards,
}

impl Direction {
    pub fn sign(self) -> f64 {
        match self {
            Self::Forwards => 1.0,
            Self::Backwards => -1.0,
        }
    }

    pub fn copysign(self, value: f64) -> f64 {
        f64::copysign(value, self.sign())
    }
}

/// Electrification conditions of a section
pub struct Electrified {
    /// Tractive mode the train should use
    mode: String,

    /// Electrical profile value
    profile: Option<String>,

    /// Power restriction code
    power_restriction: Option<String>,
}

/// Neutral electrification conditions of a section
pub struct Neutral {
    /// Whether the pantograph should be lowered
    lower_pantograph: bool,

    /// Whether this section is an announcement
    is_announcement: bool,

    /// The electrification that would have been used if it weren't for this neutral section
    overlap: Electrified,
}

pub enum Electrification {
    Electrified(Electrified),
    Neutral(Neutral),
}

pub trait TrainPath {
    /// The length of the path, in meters.
    fn length(&self) -> f64;

    /// The average slope on a given range, in m/km
    fn avg_grade(&self, start: f64, end: f64) -> f64;

    /// The lowest slope on a given range, in m/km
    fn min_grade(&self, start: f64, end: f64) -> f64;

    /// The electrification related data for a given power class and power restriction map
    fn electrification_map(
        &self,
        base_power_class: &str,
        power_restrictions: &RangeMap<f64, &str>,
        power_restriction_to_power_class: &RangeMap<&str, &str>,
        ignore_electrical_profiles: bool,
    ) -> RangeMap<f64, Option<Electrification>>;
}

/// The maximum acceleration, in m/s^2, which can be applied at a given speed, in m/s
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TractiveEffortPoint {
    pub speed: f64,
    pub max_effort: f64,
}

/// Simulate train movement using Runge-Kutta 4
#[allow(clippy::too_many_arguments)]
pub fn step(
    rolling_stock: &RollingStock,
    path: &dyn TrainPath,
    time_delta: f64,
    tractive_effort_curve_map: &RangeMap<f64, Box<[TractiveEffortPoint]>>,
    initial_position: f64,
    initial_speed: f64,
    action: Action,
    direction: Direction,
    braking_type: BrakingType,
) -> IntegrationStep {
    let step_part = |time_delta: f64, position: f64, speed: f64| -> IntegrationStep {
        if matches!(action, Action::Brake) {
            let acceleration = match braking_type {
                BrakingType::Constant => -rolling_stock.const_gamma,
                _ => panic!("TODO support other braking types"),
            };
            return newton_step(time_delta, speed, acceleration, direction);
        }

        let tractive_effort_curve = tractive_effort_curve_map
            .get(f64::clamp(position, 0.0, path.length()))
            .unwrap();
        let max_traction = max_effort(speed, tractive_effort_curve);
        let rolling_resistance = rolling_stock.davis.rolling_resistance(speed);
        let average_grade = {
            let tail_position = f64::clamp(position - rolling_stock.length, 0.0, path.length());
            let head_position = f64::clamp(position, 0.0, path.length());
            path.avg_grade(head_position, tail_position)
        };
        let weight_force = {
            let angle = f64::atan(average_grade / 1000.0); // m/km -> m/m
            -rolling_stock.mass * G * f64::sin(angle)
        };

        let mut traction = 0.0;
        if matches!(action, Action::Maintain) {
            traction = rolling_resistance - weight_force;
            if traction <= max_traction {
                return newton_step(time_delta, speed, 0.0, direction);
            }
            traction = max_traction;
        } else if matches!(action, Action::Accelerate) {
            traction = max_traction;
        }

        assert!(traction >= 0.0);

        let acceleration = if speed == 0.0
            && matches!(direction, Direction::Forwards)
                                        // XXX: < or <= ?
            && f64::abs(traction + weight_force) < rolling_resistance
        {
            // If we are stopped and if the forces are not enough to compensate the opposite force,
            // the rolling resistance and braking force don't apply and the speed stays at 0 Unless
            // we integrate backwards, then we need the speed to increase
            0.0
        } else {
            (traction + weight_force - f64::signum(speed) * rolling_resistance)
                / rolling_stock.inertia
        };

        newton_step(time_delta, speed, acceleration, direction)
    };

    let half_time = time_delta / 2.0;
    let step1 = step_part(half_time, initial_position, initial_speed);
    let step2 = step_part(
        half_time,
        initial_position + step1.position_delta,
        step1.end_speed,
    );
    let step3 = step_part(
        time_delta,
        initial_position + step2.position_delta,
        step2.end_speed,
    );
    let step4 = step_part(
        time_delta,
        initial_position + step3.position_delta,
        step3.end_speed,
    );

    let mean_acceleration = (step1.acceleration
        + 2.0 * step2.acceleration
        + 2.0 * step3.acceleration
        + step4.acceleration)
        / 6.0;

    newton_step(time_delta, initial_speed, mean_acceleration, direction)
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
