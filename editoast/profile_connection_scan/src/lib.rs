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

/// This returns up to 3 journeys, each journey being the list of connections to take given as their [ConnectionId].
///
/// Some pre-conditions are required:
///
/// - [`JourneyListParams::connections`] must be sorted by descending `departure_ms`
/// - All connections' `trip`s must be strictly lower than [`JourneyListParams::trip_count`]
/// - All connections' `departure`s and `arrival`s must be strictly lower than [`JourneyListParams::stop_count`]
///
/// See asserts below for more pre-conditions.
pub fn journey_list(p: JourneyListParams) -> Vec<Vec<ConnectionId>> {
    let JourneyListParams {
        stop_count,
        trip_count,
        connections,
        start_ms,
        start_tolerance,
        start,
        end,
        transfer_ms,
    } = p;

    assert!(start < stop_count);
    assert!(end < stop_count);

    // stop index -> profiles
    // profiles are ordered by decreasing departure_ms
    // they are also ordered by decreasing arrival_ms since they all lie on the Pareto front
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
            .rfind(|profile| profile.departure_ms >= connection.arrival_ms + transfer_ms)
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

    let mut start_profiles: Vec<&Profile> = profiles[start]
        .iter()
        .filter(|profile| u32::abs_diff(profile.departure_ms, start_ms) <= start_tolerance)
        .collect();

    // TODO: In this first version we try the departures closest to the requested time first.
    // We should use more specific criteria to select the best 3 journeys.
    start_profiles.sort_unstable_by_key(|profile| u32::abs_diff(profile.departure_ms, start_ms));

    // Explore the profile graph to create up to 3 journeys that a traveler can take to go from start to end.
    start_profiles
        .into_iter()
        .filter_map(|profile| {
            let out_connection = profile.out_connection?;
            to_journey_list_rec(
                &profiles,
                &connections,
                transfer_ms,
                end,
                vec![out_connection],
            )
        })
        .take(3)
        .collect()
}

/// Recursively extends `path`, connection by connection, into a complete journey to `end`.
///
/// `path` is the non-empty list of connection taken so far.
/// At each stop, the profiles are explored starting with the one reaching `end` earliest.
/// A candidate connection is discarded when the transfer time cannot be met or when it would make the path loop.
/// Returns `None` if no journey extends `path`.
fn to_journey_list_rec(
    profiles: &[Vec<Profile>],
    connections: &[Connection],
    transfer_ms: u32,
    end: StopId,
    path: Vec<ConnectionId>,
) -> Option<Vec<ConnectionId>> {
    let last_connection = connections[*path.last().unwrap()];
    let start: StopId = last_connection.arrival;

    if start == end {
        return Some(path);
    }

    // Try profiles from the one reaching the target earliest (see profiles construction) and stop at the first solution found
    profiles[start].iter().rev().find_map(|profile| {
        let out_conn_id = profile
            .out_connection
            .expect("expected start != end to imply out_connection is Some");

        let out_conn = connections[out_conn_id];

        let next_stop = out_conn.arrival;
        // The traveler only needs `transfer_ms` when changing trains
        let earliest_next_departure_ms = if out_conn.trip == last_connection.trip {
            last_connection.arrival_ms
        } else {
            last_connection.arrival_ms + transfer_ms
        };

        if path
            .iter()
            .any(|connection_id| connections[*connection_id].departure == next_stop)
            || start == next_stop
            || out_conn.departure_ms < earliest_next_departure_ms
        {
            return None;
        }

        let mut new_path = path.clone();
        new_path.push(out_conn_id);

        to_journey_list_rec(profiles, connections, transfer_ms, end, new_path)
    })
}
