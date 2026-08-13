//! Implementation of the [Profile Connection Scan Algorithm][csa] described in
//! Section 4 of the linked paper.
//!
//! Initially ported from this implementation:
//! <https://github.com/Tristramg/csa-rust/blob/72ee6d54de6652da81bc41d53b81ab721dcef479/src/algo.rs>
//!
//! # Definitions
//!
//! In order to understand the code and the APIs, here's some definitions
//! regarding the algorithm:
//!
//! **Trip:** a scheduled train.
//!
//! **Stop:** "a position outside of a train where a traveler can stand."
//!
//! **Connection:** a portion of a trip from one stop to the next one (without
//! any intermediate stops). Both stops are scheduled (with an associated time).
//!
//! **Footpath:** a path by foot between two stops that takes a given duration.
//! It's also called a transfer. If a foot path exist between stop A and stop
//! B, and other one between stop B and stop C, then there must be a footpath
//! between stop A and stop C.
//!
//! **Journey:** a collection of N connections and N+1 footpaths. A journey
//! starts and ends with a footpath, and alternates between footpaths and
//! connections.
//!
//! # Implementation limitations
//!
//! We assume that the only footpath are those that depart and arrive on the
//! same stop (`s^{change}` in the article). We also assume they take the same
//! constant time.
//!
//! [csa]: https://arxiv.org/pdf/1703.05997

/// Milliseconds since midnight.
type TimeOfDayMs = u32;

/// Index of a [Connection] into [`JourneyListParams::connections`].
pub type ConnectionId = usize;

type StopId = usize;
type TripId = usize;

/// A train connection from one station to another.
///
/// This represent a portion of a scheduled train from one stop to another. In
/// the input data, it is expected that connections are from one stop to the
/// next, without intermediate stops.
#[derive(Clone, Copy, Debug)]
pub struct Connection {
    /// The ID of the scheduled train which makes this connection.
    pub trip: TripId,

    /// The ID of the station where the train departs.
    ///
    /// It is expected that `depature` is different from `arrival`.
    pub departure: StopId,

    /// The time of day when the train departs from `departure`.
    ///
    /// It is expected that `departure_ms` is strictly lower than `arrival_ms`.
    pub departure_ms: TimeOfDayMs,

    /// The ID of the station where the train arrives.
    ///
    /// It is expected that `depature` is different from `arrival`.
    pub arrival: StopId,

    /// The time of day when the train arrives at `arrival`.
    ///
    /// It is expected that `departure_ms` is strictly lower than `arrival_ms`.
    pub arrival_ms: TimeOfDayMs,
}

/// Pairs a connection to exit a trip from with the resulting target arrival time.
///
/// A traveler on the trip should exit it at `exit_connection` to arrive to the target at `arrival_ms`
#[derive(Clone, Copy, Debug)]
struct TripArrival {
    /// The arrival time at the target
    arrival_ms: TimeOfDayMs,

    /// The number of legs between entering the trip and reaching the target
    leg_count: u32,

    /// The connection the traveler exits the trip to reach the target at `arrival_ms`
    exit_connection_id: ConnectionId,
}

/// A Leg represents a part of a journey taken on a specific trip.
///
/// The traveler enters the trip at `enter_connection` and exits it after `exit_connection`.
#[derive(Clone, Copy, Debug)]
pub struct Leg {
    /// The id of the connection taken to enter a trip
    pub enter_connection_id: ConnectionId,

    /// The id of the last connection taken before exiting the trip
    pub exit_connection_id: ConnectionId,
}

/// A Profile documents part of a route travelers can take to reach the destination.
///
/// More specifically, at `departure_ms`, a traveler can take the leg
/// `leg` to reach the destination at `arrival_ms` in `leg_count` legs.
#[derive(Clone, Debug)]
struct Profile {
    /// The leg taken at the departure stop
    leg: Leg,

    /// The number of legs between the departure stop and the target
    leg_count: u32,

    /// The departure time at a given stop.
    departure_ms: TimeOfDayMs,

    /// The arrival time at the target (of the algorithm input, not the connection).
    arrival_ms: TimeOfDayMs,
}

/// A function ordering two criteria, main criterion first.
type OrderCriterion = fn(arrival_ms: TimeOfDayMs, leg_count: u32) -> (u32, u32);

fn order_by_time(arrival_ms: TimeOfDayMs, leg_count: u32) -> (u32, u32) {
    (arrival_ms, leg_count)
}

fn order_by_legs(arrival_ms: TimeOfDayMs, leg_count: u32) -> (u32, u32) {
    (leg_count, arrival_ms)
}

impl Profile {
    /// Whether [self] is superior to [other] both in departure time and in criterion.
    fn dominates(&self, other: &Self, order_criterion: OrderCriterion) -> bool {
        self.departure_ms >= other.departure_ms
            && order_criterion(self.arrival_ms, self.leg_count)
                <= order_criterion(other.arrival_ms, other.leg_count)
    }
}

pub struct JourneyListParams {
    pub stop_count: usize,
    pub trip_count: usize,
    pub connections: Vec<Connection>,
    pub start_ms: u32,
    pub start_tolerance: u32,
    pub start: StopId,
    pub end: StopId,
    pub transfer_ms: u32,
}

/// This returns 3 journeys if they exist, each journey being the list of [Leg] to take:
/// - the one departing closest to [`JourneyListParams::start_ms`] on the earliest arrival front
/// - the fastest one
/// - the one taking the fewest legs, whatever its duration
///
/// A journey satisfying several criteria is returned several times.
///
/// Some pre-conditions are required:
///
/// - [`JourneyListParams::connections`] must be sorted by descending `departure_ms`
/// - All connections' `trip`s must be strictly lower than [`JourneyListParams::trip_count`]
/// - All connections' `departure`s and `arrival`s must be strictly lower than [`JourneyListParams::stop_count`]
///
/// See asserts below for more pre-conditions.
pub fn journey_list(p: JourneyListParams) -> Vec<Vec<Leg>> {
    assert!(p.start < p.stop_count);
    assert!(p.end < p.stop_count);

    if p.start == p.end {
        return Vec::new();
    }

    let profiles_by_time = scan_connections(&p, order_by_time);
    let profiles_by_legs = scan_connections(&p, order_by_legs);

    let closest_departure_journey = profiles_by_time[p.start]
        .iter()
        .min_by_key(|profile| {
            (
                u32::abs_diff(profile.departure_ms, p.start_ms),
                profile.arrival_ms,
            )
        })
        .map(|profile| {
            extract_journey(
                &profiles_by_time,
                &p.connections,
                p.transfer_ms,
                p.end,
                profile,
            )
        });

    let fastest_journey = profiles_by_time[p.start]
        .iter()
        .min_by_key(|profile| {
            (
                profile.arrival_ms - profile.departure_ms,
                u32::abs_diff(profile.departure_ms, p.start_ms),
                profile.arrival_ms,
            )
        })
        .map(|profile| {
            extract_journey(
                &profiles_by_time,
                &p.connections,
                p.transfer_ms,
                p.end,
                profile,
            )
        });

    let fewest_legs_journey = profiles_by_legs[p.start]
        .iter()
        .min_by_key(|profile| {
            (
                profile.leg_count,
                u32::abs_diff(profile.departure_ms, p.start_ms),
                profile.arrival_ms,
            )
        })
        .map(|profile| {
            extract_journey(
                &profiles_by_legs,
                &p.connections,
                p.transfer_ms,
                p.end,
                profile,
            )
        });

    closest_departure_journey
        .into_iter()
        .chain(fastest_journey)
        .chain(fewest_legs_journey)
        .collect()
}

/// Scans every connection and returns the profiles of each stop, indexed by stop id.
///
/// Profiles are ordered by decreasing `departure_ms`.
/// They are also ordered by decreasing first criterion (`arrival_ms` or `leg_count`),
/// since they all lie on the Pareto front.
fn scan_connections(p: &JourneyListParams, order_criterion: OrderCriterion) -> Vec<Vec<Profile>> {
    let mut profiles: Vec<Vec<Profile>> = vec![Vec::new(); p.stop_count];

    // This maps trips to the best TripArrival found over the connections scanned so far
    let mut trip_arrivals = vec![None; p.trip_count];

    for (connection_id, connection) in p.connections.iter().enumerate() {
        if connection.departure == p.start
            && u32::abs_diff(connection.departure_ms, p.start_ms) > p.start_tolerance
        {
            continue;
        }

        let direct = (connection.arrival == p.end).then_some(TripArrival {
            arrival_ms: connection.arrival_ms,
            leg_count: 1,
            exit_connection_id: connection_id,
        });

        let seated = trip_arrivals[connection.trip];

        let transfer = profiles[connection.arrival]
            .iter()
            .rfind(|profile| profile.departure_ms >= connection.arrival_ms + p.transfer_ms)
            .map(|profile| TripArrival {
                arrival_ms: profile.arrival_ms,
                leg_count: profile.leg_count + 1,
                exit_connection_id: connection_id,
            });

        let Some(arrival) = [direct, seated, transfer]
            .into_iter()
            .flatten()
            .min_by_key(|arrival| order_criterion(arrival.arrival_ms, arrival.leg_count))
        else {
            continue;
        };

        let candidate = Profile {
            leg: Leg {
                enter_connection_id: connection_id,
                exit_connection_id: arrival.exit_connection_id,
            },
            leg_count: arrival.leg_count,
            departure_ms: connection.departure_ms,
            arrival_ms: arrival.arrival_ms,
        };

        let stop_profiles = &mut profiles[connection.departure];

        // A candidate departs at his connection's departure_ms (no footpath variation).
        // Since connections are scanned by decreasing departure_ms, the candidate can only be
        // inserted at the end and we only need to compare it with the last profile.
        match stop_profiles.last_mut() {
            Some(last) => {
                if !last.dominates(&candidate, order_criterion) {
                    if last.departure_ms == candidate.departure_ms {
                        *last = candidate
                    } else {
                        stop_profiles.push(candidate);
                    }
                }
            }
            None => {
                stop_profiles.push(candidate);
            }
        }

        trip_arrivals[connection.trip] = Some(arrival);
    }

    profiles
}

/// Rebuilds the journey starting at `starting_profile`, leg by leg, until it reaches `end`.
fn extract_journey(
    profiles: &[Vec<Profile>],
    connections: &[Connection],
    transfer_ms: u32,
    end: StopId,
    starting_profile: &Profile,
) -> Vec<Leg> {
    let mut journey = Vec::new();
    let mut stop_profile = starting_profile;

    loop {
        journey.push(stop_profile.leg);
        let exit_connection = connections[stop_profile.leg.exit_connection_id];

        if exit_connection.arrival == end {
            return journey;
        }

        let next = profiles[exit_connection.arrival]
            .iter()
            .rfind(|profile| profile.departure_ms >= exit_connection.arrival_ms + transfer_ms);

        stop_profile = next.expect("next existence is guaranteed by the scan");
    }
}
