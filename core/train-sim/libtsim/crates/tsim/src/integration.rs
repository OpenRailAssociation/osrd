use crate::RangeMap;
use std::cmp::Ordering;

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

pub trait RollingStock {
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
    /// Make a new [`IntegrationStep`], ensuring `end_speed` is positive.
    pub fn new(
        mut time_delta: f64,
        mut position_delta: f64,
        start_speed: f64,
        mut end_speed: f64,
        acceleration: f64,
        direction: Direction,
    ) -> Self {
        let signed_acceleration = direction.sign(acceleration);

        if end_speed < 0.0 {
            // The end of the step dips below zero, so cut the step in half
            assert!(signed_acceleration < 0.0);
            end_speed = 0.0;
            time_delta = -start_speed / signed_acceleration;
            position_delta =
                start_speed * time_delta + 0.5 * acceleration * time_delta * time_delta;
            position_delta = direction.copysign(position_delta);
        }

        assert!(are_speeds_equal(
            end_speed,
            start_speed + signed_acceleration * time_delta,
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
    /// Multiply the given `value` by `-1.0` if the direction is backwards.
    pub fn sign(self, value: f64) -> f64 {
        match self {
            Self::Forwards => value,
            Self::Backwards => -value,
        }
    }

    /// Set the sign of the given `value` to positive if the direction is forwards, and to negative
    /// if the direction is backwards.
    pub fn copysign(self, value: f64) -> f64 {
        f64::copysign(
            value,
            match self {
                Self::Forwards => 1.0,
                Self::Backwards => -1.0,
            },
        )
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

/// A `TrainPath` describes the path taken by a train and its properties. It is built in a way that
/// can easily be mapped to train simulations, where we track the distance travelled by the train
/// head.
///
/// `Offset<TrainPath>` is the correct typing to locate elements on a path.
///
/// We consider that 1m of train path means 1m of train movement, not necessarily 1m of actual track
/// length. Specifically, when a train turns around at a station, no distance is travelled. See
/// below, where a train goes up to a point and turn around:
///
/// ```text
///                         backtrack
///                         location
/// ========================>|
/// -------------------------|-----    track section
/// <============############|
///              ^   train   ^
///              ^   length  ^
///             new         old
///             head        head
/// ```
///
/// What we consider the "train path" is marked with `===>` symbols. The area covered by the train
/// itself ('#') is excluded from the path after turning around. 1m after the backtrack offset is
/// already `train length + 1m` away from the previous location.
///
/// `getBlocks` and similar methods only return block ranges that are part of the train path. This
/// may include partial blocks, especially at the edges of the path or around backtracks.
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
        power_restrictions: &RangeMap<f64, String>,
        power_restriction_to_power_class: &RangeMap<String, String>,
        ignore_electrical_profiles: bool,
    ) -> RangeMap<f64, Option<Electrification>>;
}

/// The maximum acceleration, in m/s^2, which can be applied at a given speed, in m/s
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct TractiveEffortPoint {
    pub speed: f64,
    pub max_effort: f64,
}

fn average_grade(
    rolling_stock: &dyn RollingStock,
    path: &dyn TrainPath,
    head_position: f64,
) -> f64 {
    let tail_position = f64::clamp(head_position - rolling_stock.length(), 0.0, path.length());
    let head_position = f64::clamp(head_position, 0.0, path.length());
    path.avg_grade(head_position, tail_position)
}

fn weight_force(rolling_stock: &dyn RollingStock, grade: f64) -> f64 {
    // get an angle from a m/km elevation difference
    // the curve's radius is taken into account in meanTrainGrade
    let angle = f64::atan(grade / 1000.0); // m/km -> m/m
    -rolling_stock.mass() * G * f64::sin(angle)
}

/// Simulate train movement using Runge-Kutta 4
#[allow(clippy::too_many_arguments)]
pub fn step(
    rolling_stock: &dyn RollingStock,
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
                BrakingType::Constant => rolling_stock.deceleration(),
                _ => panic!("TODO support other braking types"),
            };
            return newton_step(time_delta, speed, acceleration, direction);
        }

        let tractive_effort_curve = {
            let position = f64::clamp(position, 0.0, path.length());
            match tractive_effort_curve_map.get(position) {
                None => {
                    panic!("position {position} not found on curve {tractive_effort_curve_map:#?}");
                }
                Some(x) => x,
            }
        };
        let max_traction = max_effort(speed, tractive_effort_curve);
        let rolling_resistance = rolling_stock.rolling_resistance(speed);
        let average_grade = average_grade(rolling_stock, path, position);
        let weight_force = weight_force(rolling_stock, average_grade);

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
                / rolling_stock.inertia()
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Range;
    use std::ops::Bound;

    struct FlatPath {
        length: f64,
        slope: f64,
    }

    impl TrainPath for FlatPath {
        fn length(&self) -> f64 {
            self.length
        }

        fn avg_grade(&self, _start: f64, _end: f64) -> f64 {
            self.slope
        }

        fn min_grade(&self, _start: f64, _end: f64) -> f64 {
            self.slope
        }

        fn electrification_map(
            &self,
            _base_power_class: &str,
            _power_restrictions: &RangeMap<f64, String>,
            _power_restriction_to_power_class: &RangeMap<String, String>,
            _ignore_electrical_profiles: bool,
        ) -> RangeMap<f64, Option<Electrification>> {
            RangeMap::new()
        }
    }

    fn dummy_effort_speed_curve(max_speed: f64) -> Box<[TractiveEffortPoint]> {
        std::iter::successors(Some(0.0), |prev| Some(*prev + 1.0))
            .take_while(|speed| *speed < max_speed)
            .chain([max_speed])
            .map(|speed| {
                let max_effort = 450_000.0;
                let min_effort = 180_000.0;
                let max_effort = max_effort + (min_effort - max_effort) * speed / max_speed;
                TractiveEffortPoint { speed, max_effort }
            })
            .collect::<Vec<_>>()
            .into_boxed_slice()
    }

    fn dummy_effort_curve_map() -> RangeMap<f64, Box<[TractiveEffortPoint]>> {
        let mut map = RangeMap::new();
        let all = Range::new(Bound::Unbounded, Bound::Unbounded);
        map.insert(all, dummy_effort_speed_curve(MAX_SPEED));
        map
    }

    struct TheOnlyRollingStockImpl {
        // Davis coefficients
        a: f64,
        b: f64,
        c: f64,

        const_gamma: f64,
        length: f64,
        mass: f64,
        inertia: f64,
        max_speed: f64,
    }

    impl RollingStock for TheOnlyRollingStockImpl {
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
            let speed = f64::abs(speed);
            self.a + self.b * speed + self.c * speed * speed
        }

        fn rolling_resistance_deriv(&self, speed: f64) -> f64 {
            self.b + 2.0 * self.c * f64::abs(speed)
        }

        fn deceleration(&self) -> f64 {
            -self.const_gamma
        }
    }

    const MAX_SPEED: f64 = 300.0 / 3.6;
    const STANDARD_TRAIN: TheOnlyRollingStockImpl = {
        let mass = 850_000.0;
        TheOnlyRollingStockImpl {
            a: (0.65 * mass) / 100.0,
            b: ((0.008 * mass) / 100.0) * 3.6,
            c: (((0.00012 * mass) / 100.0) * 3.6) * 3.6,
            const_gamma: 0.5,
            length: 400.0,
            mass,
            inertia: mass * 1.05,
            max_speed: MAX_SPEED,
        }
    };
    const TIME_DELTA: f64 = 1.0;

    #[test]
    fn negative_speed_forward() {
        let initial_time_delta = 1.0;
        let start_speed = 1.0;
        let acceleration = -2.0;
        let direction = Direction::Forwards;
        let end_speed = start_speed + direction.sign(initial_time_delta * acceleration);
        let initial_position_delta = direction.sign(
            start_speed * initial_time_delta
                + 0.5 * acceleration * initial_time_delta * initial_time_delta,
        );

        let step = IntegrationStep::new(
            initial_time_delta,
            initial_position_delta,
            start_speed,
            end_speed,
            acceleration,
            direction,
        );

        assert_eq!(step.end_speed, 0.0);
        assert!(step.time_delta < initial_time_delta);
        assert!(direction.sign(step.position_delta) > 0.0);

        let expected_end_speed =
            step.start_speed + direction.sign(step.time_delta * step.acceleration);
        assert_eq!(expected_end_speed, 0.0);
    }

    #[test]
    fn negative_speed_backward() {
        let initial_time_delta = 1.0;
        let start_speed = 1.0;
        let acceleration = 2.0;
        let direction = Direction::Backwards;
        let end_speed = start_speed + direction.sign(initial_time_delta * acceleration);
        let initial_position_delta = direction.sign(
            start_speed * initial_time_delta
                + 0.5 * acceleration * initial_time_delta * initial_time_delta,
        );

        let step = IntegrationStep::new(
            initial_time_delta,
            initial_position_delta,
            start_speed,
            end_speed,
            acceleration,
            direction,
        );

        assert_eq!(step.end_speed, 0.0);
        assert!(step.time_delta < initial_time_delta);
        assert!(direction.sign(step.position_delta) > 0.0);

        let expected_end_speed =
            step.start_speed + direction.sign(step.time_delta * step.acceleration);
        assert_eq!(expected_end_speed, 0.0);
    }

    #[test]
    fn accelerate_and_coast() {
        let path = FlatPath {
            length: 100_000.0,
            slope: 0.0,
        };
        let rolling_stock = STANDARD_TRAIN;
        let effort_curve_map = dummy_effort_curve_map();
        let mut position = 0.0;
        let mut speed = 0.0;

        // make a huge traction effort
        let rolling_resistance = rolling_stock.rolling_resistance(speed);
        let grade = average_grade(&rolling_stock, &path, position);
        let weight_force = weight_force(&rolling_stock, grade);
        let acceleration = (500_000.0 + weight_force - f64::signum(speed) * rolling_resistance)
            / rolling_stock.inertia;
        let s = newton_step(TIME_DELTA, speed, acceleration, Direction::Forwards);

        position += s.position_delta;
        speed = s.end_speed;
        assert!(speed > 0.5);

        // the train should be able to coast for a minute without stopping
        for _ in 0..59 {
            let s = step(
                &rolling_stock,
                &path,
                TIME_DELTA,
                &effort_curve_map,
                position,
                speed,
                Action::Coast,
                Direction::Forwards,
                BrakingType::Constant,
            );
            position += s.position_delta;
            let prev_speed = s.start_speed;
            speed = s.end_speed;
            assert!(speed < prev_speed);
            assert!(speed > 0.0);
        }

        // another minute later
        for _ in 0..59 {
            let s = step(
                &rolling_stock,
                &path,
                TIME_DELTA,
                &effort_curve_map,
                position,
                speed,
                Action::Coast,
                Direction::Forwards,
                BrakingType::Constant,
            );
            position += s.position_delta;
            speed = s.end_speed;
        }

        // it should be stopped
        assert_eq!(speed, 0.0);
    }

    #[test]
    fn slope_change_vmax() {
        let path = FlatPath {
            length: 100_000.0,
            slope: 0.0,
        };
        let rolling_stock = STANDARD_TRAIN;
        let effort_curve_map = dummy_effort_curve_map();

        let mut position = 0.0;
        let mut speed = 0.0;

        // go to full speed by cruising for 20 minutes
        for _ in 0..20 * 60 {
            let s = step(
                &rolling_stock,
                &path,
                TIME_DELTA,
                &effort_curve_map,
                position,
                speed,
                Action::Accelerate,
                Direction::Forwards,
                BrakingType::Constant,
            );
            position += s.position_delta;
            speed = s.end_speed;
        }

        let full_throttle = speed;

        // we expect the train to go pretty fast
        assert!(speed > 100.0, "{speed}");

        // continue the simulation, but with some slope
        let path = FlatPath {
            length: 100_000.0,
            slope: 35.0,
        };

        // go to full speed by cruising for 20 minutes
        for _ in 0..20 * 60 {
            let s = step(
                &rolling_stock,
                &path,
                TIME_DELTA,
                &effort_curve_map,
                position,
                speed,
                Action::Accelerate,
                Direction::Forwards,
                BrakingType::Constant,
            );
            position += s.position_delta;
            speed = s.end_speed;
        }

        // we expect the train to run at less than half the speed, but still decently fast
        assert!(speed < full_throttle / 2.0, "{speed}");
        assert!(speed > full_throttle / 3.0, "{speed}");
    }

    #[test]
    fn bench_slope_change_vmax() {
        use std::time::Duration;
        use std::time::Instant;

        let start_time = Instant::now();
        let mut warmup_count = 0;

        loop {
            slope_change_vmax();
            warmup_count += 1;
            if warmup_count >= 3 || start_time.elapsed() > Duration::from_secs(1) {
                break;
            }
        }

        let bench_count = u32::clamp(warmup_count * 5, 10, 100);
        let mut total_time = Duration::ZERO;

        for _ in 0..bench_count {
            let start_time = Instant::now();
            slope_change_vmax();
            total_time += start_time.elapsed();
        }

        let avg = total_time / bench_count;
        println!("Average time: {avg:?}");
    }
}
