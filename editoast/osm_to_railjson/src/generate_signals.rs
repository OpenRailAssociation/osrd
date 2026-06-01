//! Some definitions:
//! - Track: a group of track sections connected by link switches.
//! - Intersection: a group of switches close to each other.
//!
//! The algorithm to generate signals is as follows:
//! 1. Identify tracks:
//!    a. Create a map of track endpoints connected by link switches.
//!    b. For each track endpoint not connected to a link switch, follow the track sections and link switches to create a track.
//! 2. Create signals on each track:
//!   - Block signals are placed at regular intervals based on the track speed limit.
//!   - Intersection signals are placed at the end of tracks that have switches.
//!     If the track is shorter than some threshold, we consider the switches at both ends
//!     to be part of the same intersection, and no intersection signals are created.

use std::collections::HashMap;
use std::collections::HashSet;

use schemas::infra::Direction;
use schemas::infra::Endpoint;
use schemas::infra::LogicalSignal;
use schemas::infra::Side;
use schemas::infra::Signal;
use schemas::infra::SignalExtensions;
use schemas::infra::SignalSncfExtension;
use schemas::infra::Speed;
use schemas::infra::SpeedSection;
use schemas::infra::Switch;
use schemas::infra::TrackEndpoint;
use schemas::infra::TrackSection;
use schemas::primitives::Identifier;
use schemas::primitives::NonBlankString;

use itertools::Itertools as _;
use uuid::Uuid;

/// Default block length (in meters).
/// It correspond to the distance needed to stop a train at 160 km/h.
const DEFAULT_BLOCK_LENGTH: f64 = 1500.0;
/// Block length for TVM (from the French “Transmission Voie-Machine” or in English “Track-to-Train Transmission”) signals (in meters).
const TVM_BLOCK_LENGTH: f64 = 1500.0;
/// Distance from the intersection to the signal (in meters).
const DEFAULT_INTERSECTION_SIGNAL_DISTANCE: f64 = 100.0;
/// Maximum distance between two switches to consider them in the same intersection (in meters).
const INTERSECTION_MAX_SWITCH_DISTANCE: f64 = 500.0;

/// List of deceleration values (in m/s²) for rolling stock and their corresponding speed limits (in m/s).
/// Those values are based on the open-data rolling stock
/// [here](https://github.com/OpenRailAssociation/osrd/tree/dev/tests/data/rolling_stocks/realistic).
const ROLLING_STOCK_DECELERATION: [(f64, f64); 6] = [
    // The speed limit is converted from km/h to m/s for readability.
    (km_per_h_into_m_per_s(100.0), 0.3),
    (km_per_h_into_m_per_s(120.0), 0.3),
    (km_per_h_into_m_per_s(140.0), 0.3),
    (km_per_h_into_m_per_s(160.0), 0.5),
    (km_per_h_into_m_per_s(200.0), 0.3),
    (km_per_h_into_m_per_s(320.0), 0.5),
];

/// Reaction time of the driver (in seconds).
const REACTION_TIME: f64 = 5.0;

/// Safety margin for the signaling distance.
const SAFETY_MARGIN: f64 = 1.2;

/// Get the ***minimal signaling distance*** for that `speed` (in m/s).
///
/// If the `speed` is higher than the maximum supported speed, the function returns `None`.
fn get_minimal_signaling_distance(speed: Speed) -> Option<f64> {
    ROLLING_STOCK_DECELERATION
        .iter()
        .filter(|(speed_limit, _)| speed.0 <= *speed_limit)
        .map(|(_, deceleration)| {
            // We use the formula d = v² / (2 * a) to calculate the braking distance.
            ((speed.0 * speed.0) / (2.0 * deceleration) + (REACTION_TIME * speed.0)) * SAFETY_MARGIN
        })
        .max_by(|a, b| a.partial_cmp(b).unwrap())
}

/// Convert speed from km/h to m/s.
const fn km_per_h_into_m_per_s(speed: f64) -> f64 {
    speed / 3.6
}

/// Represents a group of track sections connected by link switches.
struct Track<'a> {
    /// The track sections making up this track. They are ordered from the start to the end of the track.
    ///
    /// The direction of each track section in the track
    /// (i.e., whether or not the track section has the same direction as the track).
    track_sections: Vec<(&'a TrackSection, Direction)>,
    /// Whether there is a switch at the beginning of the track.
    switch_at_begin: bool,
    /// Whether there is a switch at the end of the track.
    switch_at_end: bool,
    /// The highest speed limit along the track, if it exists. This is used to determine the block length for signal generation.
    highest_speed_limit: Option<Speed>,
}

impl<'a> Track<'a> {
    /// Add a track section to the track.
    ///
    /// `track_endpoint` specifies which track section to add and by which end.
    ///
    /// Returns the new `track_endpoint` at the end of the track.
    fn push_track_section(
        &mut self,
        track_sections: &'a [TrackSection],
        track_endpoint: &TrackEndpoint,
    ) -> TrackEndpoint {
        let track_section = track_sections
            .iter()
            .find(|ts| ts.id == track_endpoint.track)
            .unwrap();
        let direction = match track_endpoint.endpoint {
            Endpoint::Begin => Direction::StartToStop,
            Endpoint::End => Direction::StopToStart,
        };
        self.track_sections.push((track_section, direction));

        TrackEndpoint {
            endpoint: match track_endpoint.endpoint {
                Endpoint::Begin => Endpoint::End,
                Endpoint::End => Endpoint::Begin,
            },
            track: track_section.id.clone(),
        }
    }

    /// Total length of the track.
    fn length(&self) -> f64 {
        self.track_sections
            .iter()
            .map(|(track_section, _)| track_section.length)
            .sum()
    }

    /// Get the `track section`, `direction`, optional `speed limit`, and `pk` at a given `distance` along the track.
    fn get_track_section_at_distance(
        &self,
        distance: f64,
    ) -> Option<(&'a TrackSection, Direction, f64)> {
        let mut accumulated_distance = 0.0;

        for (track_section, direction) in &self.track_sections {
            let ts_length = track_section.length;
            if accumulated_distance + ts_length >= distance {
                let pk = match direction {
                    Direction::StartToStop => distance - accumulated_distance,
                    Direction::StopToStart => ts_length - (distance - accumulated_distance),
                };
                return Some((track_section, *direction, pk));
            }
            accumulated_distance += ts_length;
        }

        None
    }

    /// Generate block signals along the track.
    ///
    /// The block length is determined based on the speed limit of the track.
    ///
    /// Due to a limitation of the current route generation, every signal must have its equivalent in the opposite direction.
    /// But if we generate signals in both directions independently, and then double each of them, we might end up with signals that
    /// are too close to each other, resulting in blocks smaller than the minimal signaling distance.
    /// To avoid this, we need to generate signals at positions that work for both directions at the same time.
    /// The easiest way to do this is the one described below.
    /// To make it work, we need to assume that the speed limit is the same in both directions and along the whole track.
    /// This is a reasonable assumption for most of the tracks, but it might not be true for some of them.
    /// And for the speed limit, we take the highest speed limit along the track, which is the most restrictive one.
    ///
    /// We divide the track into N blocks of length `block_length`.
    /// Then iterate over the multiples of `block_length`, (N - 1) times, starting from `block_length` + `DEFAULT_INTERSECTION_SIGNAL_DISTANCE`.
    /// This will give us the position of the signals, ignoring the first and last positions.
    ///
    /// ```
    /// // |<-O--------------------- track_length ---------------------O->|
    /// //    |<- block_length ->|<- block_length ->|<- block_length ->|
    /// //                       X                  X
    ///
    /// // O = intersection signals.
    /// // X = block signals.
    /// ```
    /// If:
    /// - **speed <= 160 km/h**: we use BAL signals with a block length equal to the minimal signaling distance for that speed limit.
    /// - **160 km/h < speed <= 220 km/h**: we use jaune_cli BAL signals with a block length equal to the minimal signaling distance for 160 km/h.
    /// - **speed > 220 km/h**: we use TVM signals with a block length of 1500 m.
    /// - **If there is no speed limit**: we use BAL signals with a block length of 1500 m.
    ///
    fn generate_block_signals(&self) -> Vec<Signal> {
        const BAL_WITHOUT_JAUNE_CLI_SPEED_LIMIT_UPPER_BOND: f64 = km_per_h_into_m_per_s(160.0);
        const BAL_WITH_JAUNE_CLI_SPEED_LIMIT_UPPER_BOND: f64 = km_per_h_into_m_per_s(220.0);

        let (block_length, signal_type) = if let Some(speed_limit) = self.highest_speed_limit {
            match speed_limit.0 {
                speed if speed <= BAL_WITHOUT_JAUNE_CLI_SPEED_LIMIT_UPPER_BOND => (
                    get_minimal_signaling_distance(speed_limit).unwrap(),
                    SignalType::Bal { jaune_cli: false },
                ),
                speed if speed <= BAL_WITH_JAUNE_CLI_SPEED_LIMIT_UPPER_BOND => (
                    get_minimal_signaling_distance(Speed(km_per_h_into_m_per_s(160.0))).unwrap(),
                    SignalType::Bal { jaune_cli: true },
                ),
                _ => (TVM_BLOCK_LENGTH, SignalType::Tvm),
            }
        } else {
            (DEFAULT_BLOCK_LENGTH, SignalType::Bal { jaune_cli: false })
        };

        let track_length = self.length() - 2.0 * DEFAULT_INTERSECTION_SIGNAL_DISTANCE;
        let num_blocks = (track_length / block_length).floor();
        let block_length = track_length / num_blocks;

        std::iter::successors(
            Some(block_length + DEFAULT_INTERSECTION_SIGNAL_DISTANCE),
            |&d| Some(d + block_length),
        )
        .take((num_blocks - 1.0) as usize)
        .filter_map(|step| self.get_track_section_at_distance(step))
        .flat_map(|(track_section, _direction, pk)| {
            [
                new_signal(
                    signal_type,
                    track_section.id.clone(),
                    pk,
                    Direction::StartToStop,
                    false,
                ),
                new_signal(
                    signal_type,
                    track_section.id.clone(),
                    pk,
                    Direction::StopToStart,
                    false,
                ),
            ]
        })
        .collect()
    }

    /// Generate intersection signals at both ends of the track.
    fn generate_intersection_signals(&self) -> Vec<Signal> {
        const {
            assert!(
                2.0 * DEFAULT_INTERSECTION_SIGNAL_DISTANCE < INTERSECTION_MAX_SWITCH_DISTANCE,
                "This is to avoid the case where the intersection signals are generated too close to each other, leading to unrealistic signal placement."
            );
        }

        let mut signals = Vec::new();

        let track_length = self.length();
        if track_length < INTERSECTION_MAX_SWITCH_DISTANCE {
            return signals;
        }

        if self.switch_at_begin
            && let Some((track_section, direction, pk)) =
                self.get_track_section_at_distance(DEFAULT_INTERSECTION_SIGNAL_DISTANCE)
        {
            // FIXME: This signals should not be generated.
            // It's here as a temporary solution to a problem with the current route generation.
            // Link to the issue: https://github.com/OpenRailAssociation/osrd/issues/15465
            signals.push(new_signal(
                SignalType::Bal { jaune_cli: false },
                track_section.id.clone(),
                pk,
                direction,
                true,
            ));

            signals.push(new_signal(
                SignalType::Bal { jaune_cli: false },
                track_section.id.clone(),
                pk,
                direction.toggle(),
                true,
            ));
        }

        if self.switch_at_end
            && let Some((track_section, direction, pk)) = self
                .get_track_section_at_distance(track_length - DEFAULT_INTERSECTION_SIGNAL_DISTANCE)
        {
            signals.push(new_signal(
                SignalType::Bal { jaune_cli: false },
                track_section.id.clone(),
                pk,
                direction,
                true,
            ));

            // FIXME: This signals should not be generated.
            // It's here as a temporary solution to a problem with the current route generation.
            // Link to the issue: https://github.com/OpenRailAssociation/osrd/issues/15465
            signals.push(new_signal(
                SignalType::Bal { jaune_cli: false },
                track_section.id.clone(),
                pk,
                direction.toggle(),
                true,
            ));
        }

        signals
    }
}

fn create_tracks<'a>(
    track_sections: &'a [TrackSection],
    switches: &'a [Switch],
    speed_sections: &'a [SpeedSection],
) -> Vec<Track<'a>> {
    // Map of track endpoints connected by link switches.
    let mut link_switches: HashMap<&TrackEndpoint, &TrackEndpoint> = HashMap::new();
    // Set of track endpoints that are connected to intersection.
    let mut endpoints_linked_to_intersection: HashSet<&TrackEndpoint> = HashSet::new();

    for switch in switches {
        if switch.switch_type == Identifier::from("link") {
            let (endpoint_0, endpoint_1) = switch
                .ports
                .values()
                .next_tuple()
                .expect("Link switch must have at least two ports");
            link_switches.insert(endpoint_0, endpoint_1);
            link_switches.insert(endpoint_1, endpoint_0);
        } else {
            endpoints_linked_to_intersection.extend(switch.ports.values());
        }
    }

    // List of track endpoints not linked to a link switch.
    // Meaning they are the boundary of a track.
    let mut track_boundaries = Vec::new();
    for track_section in track_sections {
        for endpoint in [Endpoint::Begin, Endpoint::End] {
            let track_endpoint = TrackEndpoint {
                endpoint,
                track: track_section.id.clone(),
            };
            if !link_switches.contains_key(&track_endpoint) {
                track_boundaries.push(track_endpoint);
            }
        }
    }

    let mut tracks: Vec<Track<'a>> = Vec::new();

    // Get a track boundary. It will act as the starting point of a track.
    while let Some(mut endpoint) = track_boundaries.pop() {
        let mut track = Track {
            track_sections: Vec::new(),
            // Check if there is a intersection at the beginning of the track.
            switch_at_begin: endpoints_linked_to_intersection.contains(&endpoint),
            switch_at_end: false,
            highest_speed_limit: None,
        };

        endpoint = track.push_track_section(track_sections, &endpoint);
        // Follow the track sections and link switches until there are no more link switches.
        while let Some(linked_endpoint) = link_switches.get(&endpoint) {
            endpoint = track.push_track_section(track_sections, linked_endpoint);
        }

        // Remove the endpoint from the track boundaries, so that we don't start a track from it.
        track_boundaries.retain(|ep| ep != &endpoint);
        // Check if there is a intersection at the end of the track.
        track.switch_at_end = endpoints_linked_to_intersection.contains(&endpoint);

        track.highest_speed_limit = track
            .track_sections
            .iter()
            .filter_map(|(track_section, _)| {
                speed_sections.iter().find(|speed_section| {
                    speed_section
                        .track_ranges
                        .iter()
                        .any(|track_range| track_range.track == track_section.id)
                })
            })
            .filter_map(|speed_section| speed_section.speed_limit)
            .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

        tracks.push(track);
    }

    tracks
}

fn create_signals<'a>(tracks: &Vec<Track<'a>>) -> Vec<Signal> {
    tracks.iter().fold(Vec::new(), |mut signals, track| {
        signals.extend(track.generate_block_signals());
        signals.extend(track.generate_intersection_signals());
        signals
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SignalType {
    Bal { jaune_cli: bool },
    Tvm,
}

/// Helper function to create a signal with some default parameters.
fn new_signal(
    signal_type: SignalType,
    track: Identifier,
    position: f64,
    direction: Direction,
    nf: bool,
) -> Signal {
    let mut settings = HashMap::new();
    settings.insert(
        NonBlankString::from("Nf"),
        NonBlankString::from(if nf { "true" } else { "false" }),
    );

    let mut default_parameters = HashMap::new();
    if let SignalType::Bal { jaune_cli } = signal_type {
        default_parameters.insert(
            NonBlankString::from("jaune_cli"),
            NonBlankString::from(if jaune_cli { "true" } else { "false" }),
        );
    }

    let (sight_distance, signaling_system) = match signal_type {
        SignalType::Bal { jaune_cli: _ } => (400.0, "BAL".to_string()),
        SignalType::Tvm => (0.0, "TVM430".to_string()),
    };

    Signal {
        id: Identifier::from(Uuid::new_v4()),
        direction,
        track,
        position,
        sight_distance,
        logical_signals: vec![LogicalSignal {
            signaling_system,
            settings,
            default_parameters,
            ..Default::default()
        }],
        extensions: SignalExtensions {
            sncf: Some(SignalSncfExtension {
                label: "".to_string(),
                side: Side::Left,
                kp: "".to_string(),
            }),
        },
    }
}

/// Generate signals from the track sections, switches and speed sections.
pub fn generate_signals(
    track_sections: &[TrackSection],
    switches: &[Switch],
    speed_sections: &[SpeedSection],
) -> Vec<Signal> {
    let tracks = create_tracks(track_sections, switches, speed_sections);

    create_signals(&tracks)
}

#[cfg(test)]
mod tests {

    use rstest::rstest;

    use schemas::infra::Direction;
    use schemas::primitives::Identifier;
    use schemas::primitives::NonBlankString;

    #[test]
    fn generate_signals_switches() {
        let railjson =
            crate::osm_to_railjson::parse_osm("src/tests/switches.osm.pbf".into(), true).unwrap();

        assert_eq!(railjson.signals.len(), 382);
        assert_eq!(railjson.detectors.len(), 382);
    }

    fn signal_exists(
        railjson: &schemas::infra::RailJson,
        track: &Identifier,
        position: f64,
        direction: &Direction,
    ) -> bool {
        const FLOAT_EPSILON: f64 = 1.0;
        railjson.signals.iter().any(|signal| {
            signal.track == *track
                && (signal.position - position).abs() < FLOAT_EPSILON
                && signal.direction == *direction
        })
    }

    #[rstest]
    #[case(Identifier::from("5496-2"), 100.0, Direction::StartToStop)]
    #[case(Identifier::from("5496-2"), 100.0, Direction::StopToStart)]
    #[case(Identifier::from("5496-0"), 259.2, Direction::StartToStop)]
    #[case(Identifier::from("5496-0"), 259.2, Direction::StopToStart)]
    #[case(Identifier::from("5491-0"), 348.2, Direction::StartToStop)]
    #[case(Identifier::from("5491-0"), 348.2, Direction::StopToStart)]
    #[case(Identifier::from("5491-2"), 100.0, Direction::StartToStop)]
    #[case(Identifier::from("5491-2"), 100.0, Direction::StopToStart)]
    fn generate_signals_intersection(
        #[case] expected_track: Identifier,
        #[case] expected_position: f64,
        #[case] expected_direction: Direction,
    ) {
        let railjson =
            crate::osm_to_railjson::parse_osm("src/tests/intersection.osm.pbf".into(), true)
                .unwrap();

        assert!(signal_exists(
            &railjson,
            &expected_track,
            expected_position,
            &expected_direction
        ));
    }

    #[test]
    fn generate_signals_intersection_nf() {
        let railjson =
            crate::osm_to_railjson::parse_osm("src/tests/intersection.osm.pbf".into(), true)
                .unwrap();

        assert_eq!(railjson.signals.len(), 8);

        assert!(railjson.signals.iter().all(|signal| {
            if let Some(logical_signal) = signal.logical_signals.first() {
                logical_signal.signaling_system == "BAL"
                    && logical_signal.settings.get(&NonBlankString::from("Nf"))
                        == Some(&NonBlankString::from("true"))
            } else {
                false
            }
        }));
    }

    #[rstest]
    #[case(Identifier::from("614-0"), 2399.7, Direction::StartToStop)]
    #[case(Identifier::from("614-0"), 2399.7, Direction::StopToStart)]
    #[case(Identifier::from("614-0"), 528.2, Direction::StartToStop)]
    #[case(Identifier::from("614-0"), 528.2, Direction::StopToStart)]
    #[case(Identifier::from("612-0"), 2402.2, Direction::StartToStop)]
    #[case(Identifier::from("612-0"), 2402.2, Direction::StopToStart)]
    #[case(Identifier::from("612-0"), 530.4, Direction::StartToStop)]
    #[case(Identifier::from("612-0"), 530.4, Direction::StopToStart)]
    fn tvm_signal(
        #[case] expected_track: Identifier,
        #[case] expected_position: f64,
        #[case] expected_direction: Direction,
    ) {
        let railjson =
            crate::osm_to_railjson::parse_osm("src/tests/tvm_signal.osm.pbf".into(), true).unwrap();

        assert!(signal_exists(
            &railjson,
            &expected_track,
            expected_position,
            &expected_direction
        ));
    }
}
