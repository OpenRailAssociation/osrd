//! Implementation of the [Profile Connection Scan Algorithm][csa] described in
//! Section 4 of the linked paper.
//!
//! Initially ported from this implementation:
//! https://github.com/Tristramg/csa-rust/blob/72ee6d54de6652da81bc41d53b81ab721dcef479/src/algo.rs
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

type ConnectionId = usize;
type StopId = usize;
type TripId = usize;

/// Constant time for a transfer/footpath in the same stop in milliseconds.
///
/// The implementation assumes that changing from one trip to another in a stop
/// always take this constant time.
const TRANSFER_MS: u32 = 5 * 60 * 1000;

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

/// A Profile documents part of a route travelers can take to reach the destination.
///
/// More specifically, at `departure_ms`, a traveler can take the train
/// connection `out_connection` to reach the destination at `arrival_ms`.
#[derive(Clone, Debug)]
struct Profile {
    /// The connection taken at the departure stop
    out_connection: Option<ConnectionId>,

    /// The departure time at a given stop.
    departure_ms: TimeOfDayMs,

    /// The arrival time at the target (of the algorithm input, not the connection).
    arrival_ms: TimeOfDayMs,
}

impl Profile {
    /// Whether [self] is superior to [other] both in arrival time and departure time.
    fn dominates(&self, other: &Self) -> bool {
        self.departure_ms >= other.departure_ms && self.arrival_ms <= other.arrival_ms
    }
}

/// This returns a list of journeys, each journey in the form of a list of connections to take.
///
/// Some pre-conditions are required:
///
/// - [`connections`] must be sorted by descending `departure_ms`
/// - All connections' `trip`s must be strictly lower than [`trip_count`]
/// - All connections' `departure`s and `arrival`s must be strictly lower than [`stop_count`]
///
/// See asserts below for more pre-conditions.
pub fn journey_list(
    stop_count: usize,
    trip_count: usize,
    connections: Vec<Connection>,
    start_ms: u32,
    start_tolerance: u32,
    start: StopId,
    end: StopId,
) -> Vec<Vec<Connection>> {
    assert!(start < stop_count);
    assert!(end < stop_count);

    // stop index -> profiles
    // profiles are ordered by decreasing departure_ms
    // they are also ordered by increasing arrival_ms
    let mut profiles: Vec<Vec<Profile>> = vec![Vec::new(); stop_count];
    profiles[end].push(Profile {
        out_connection: None,
        departure_ms: u32::MAX,
        arrival_ms: 0,
    });

    // This maps trips to the earliest arrival time possible when taking this trip.
    let mut trip_min_arrival_ms = vec![u32::MAX; trip_count];

    for (connection_id, connection) in connections.iter().enumerate() {
        let t1 = trip_min_arrival_ms[connection.trip];

        let t2 = profiles[connection.arrival]
            .iter()
            .rfind(|profile| profile.departure_ms > connection.arrival_ms + TRANSFER_MS)
            .map_or(u32::MAX, |profile| {
                if profile.out_connection.is_some() {
                    profile.arrival_ms
                } else {
                    connection.arrival_ms
                }
            });

        let t = u32::min(t1, t2);

        if t == u32::MAX {
            continue;
        }

        let candidate = Profile {
            out_connection: Some(connection_id),
            departure_ms: connection.departure_ms,
            arrival_ms: t,
        };

        let profiles = &mut profiles[connection.departure];

        let pivot = profiles
            .iter()
            .rposition(|profile| profile.departure_ms >= candidate.departure_ms);

        let mut earlier_profiles = match pivot {
            Some(position) => profiles
                .drain(position + 1..)
                .filter(|profile| candidate.dominates(profile))
                .collect(),
            None => Vec::new(),
        };

        let insert_candidate = match profiles.last() {
            Some(profile) => !profile.dominates(&candidate),
            None => true,
        };

        if insert_candidate {
            profiles.push(candidate);
            trip_min_arrival_ms[connection.trip] = t;
        }

        profiles.append(&mut earlier_profiles);
    }

    to_journey_list(&profiles, &connections, start, end)
        .filter(|journey| {
            let departure_ms = journey[0].departure_ms;

            u32::abs_diff(departure_ms, start_ms) <= start_tolerance
        })
        .collect()
}

/// Explore the profile graph to create the list of journeys that a traveler can take to go from start to end.
fn to_journey_list<'a>(
    profiles: &'a [Vec<Profile>],
    connections: &'a [Connection],
    start: StopId,
    end: StopId,
) -> impl Iterator<Item = Vec<Connection>> + 'a {
    profiles[start].iter().flat_map(move |profile| {
        let Some(out_connection) = profile.out_connection else {
            return Vec::new();
        };
        to_journey_list_rec(
            profiles,
            connections,
            end,
            vec![connections[out_connection]],
        )
    })
}

fn to_journey_list_rec(
    profiles: &[Vec<Profile>],
    connections: &[Connection],
    end: StopId,
    path: Vec<Connection>,
) -> Vec<Vec<Connection>> {
    let start: StopId = path.last().unwrap().arrival;
    let time: TimeOfDayMs = path.last().unwrap().arrival_ms + TRANSFER_MS;

    if start == end {
        return vec![path];
    }

    profiles[start]
        .iter()
        .flat_map(|profile| {
            let out_conn_id = profile
                .out_connection
                .expect("expected start != end to imply out_connection is Some");

            let out_conn = connections[out_conn_id];

            let next_stop = out_conn.arrival;

            if path
                .iter()
                .any(|connection| connection.departure == next_stop)
                || start == next_stop
                || out_conn.departure_ms < time
            {
                return Vec::new();
            }

            let mut new_path = path.clone();
            new_path.push(out_conn);

            to_journey_list_rec(profiles, connections, end, new_path)
        })
        .collect()
}
