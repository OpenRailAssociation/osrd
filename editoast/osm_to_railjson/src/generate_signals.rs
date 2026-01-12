//! Some definitions:
//! - Track: a group of track sections connected by link switches.
//! - Intersection: a group of switches close to each other.
//!
//! The algorithm to generate signals is as follows:
//! 1. Identify tracks:
//!    a. Create a map of track endpoints connected by link switches.
//!    b. For each track endpoint not connected to a link switch, follow the track sections and link switches to create a track.
//! 2. Create signals on each track:
//!   - Block signals are placed at regular intervals.
//!   - Intersection signals are placed at the end of tracks that have switches.
//!     If the track is shorter than some threshold, we consider the switches at both ends
//!     to be part of the same intersection, and no intersection signals are created.

use std::collections::HashMap;
use std::collections::HashSet;

use schemas::infra::Direction;
use schemas::infra::Endpoint;
use schemas::infra::LogicalSignal;
use schemas::infra::RailJson;
use schemas::infra::Side;
use schemas::infra::Signal;
use schemas::infra::SignalExtensions;
use schemas::infra::SignalSncfExtension;
use schemas::infra::TrackEndpoint;
use schemas::infra::TrackSection;
use schemas::primitives::Identifier;
use schemas::primitives::NonBlankString;

use itertools::Itertools as _;
use uuid::Uuid;

/// Length of a block (in meters).
const BLOCK_LENGTH: f64 = 1500.0;
/// Distance from the intersection to the signal (in meters).
const INTERSECTION_SIGNAL_DISTANCE: f64 = 100.0;
/// Maximum distance between two switches to consider them in the same intersection (in meters).
const INTERSECTION_MAX_SWITCH_DISTANCE: f64 = 500.0;

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
}

impl<'a> Track<'a> {
    /// Add a track section to the track.
    ///
    /// `track_endpoint` specifies which track section to add and by which end.
    ///
    /// Returns the new `track_endpoint` at the end of the track.
    fn push_track_section(
        &mut self,
        railjson: &'a RailJson,
        track_endpoint: &TrackEndpoint,
    ) -> TrackEndpoint {
        let track_section = railjson
            .track_sections
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

    /// Get the `track section`, `direction`, and `pk` at a given `distance` along the track.
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
    fn generate_block_signals(&self) -> Vec<Signal> {
        let track_length = self.length();
        let num_blocks = (track_length / BLOCK_LENGTH).floor();
        let block_length = BLOCK_LENGTH + ((track_length % BLOCK_LENGTH) / num_blocks);

        // We divide the track into N blocks of length `block_length`.
        // Then iterate over the multiples of `block_length`, (N - 1) times, starting from `block_length`.
        // This will give us the position of the signals, ignoring positions 0 and `track_length`.

        // |<-------------------- track_length -------------------->|
        // |<- block_length ->|<- block_length ->|<- block_length ->|
        //                    X                  X

        std::iter::successors(Some(block_length), |&d| Some(d + block_length))
            .take((num_blocks - 1.0) as usize)
            .filter_map(|step| self.get_track_section_at_distance(step))
            .flat_map(|(track_section, _direction, pk)| {
                [
                    new_bal(track_section.id.clone(), pk, Direction::StartToStop, false),
                    new_bal(track_section.id.clone(), pk, Direction::StopToStart, false),
                ]
            })
            .collect()
    }

    /// Generate intersection signals at both ends of the track.
    fn generate_intersection_signals(&self) -> Vec<Signal> {
        const {
            assert!(
                2.0 * INTERSECTION_SIGNAL_DISTANCE < INTERSECTION_MAX_SWITCH_DISTANCE,
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
                self.get_track_section_at_distance(INTERSECTION_SIGNAL_DISTANCE)
        {
            signals.push(new_bal(
                track_section.id.clone(),
                pk,
                direction.toggle(),
                true,
            ));
        }

        if self.switch_at_end
            && let Some((track_section, direction, pk)) =
                self.get_track_section_at_distance(track_length - INTERSECTION_SIGNAL_DISTANCE)
        {
            signals.push(new_bal(track_section.id.clone(), pk, direction, true));
        }

        signals
    }
}

fn create_tracks<'a>(railjson: &'a RailJson) -> Vec<Track<'a>> {
    // Map of track endpoints connected by link switches.
    let mut link_switches: HashMap<&TrackEndpoint, &TrackEndpoint> = HashMap::new();
    // Set of track endpoints that are connected to intersection.
    let mut endpoints_linked_to_intersection: HashSet<&TrackEndpoint> = HashSet::new();

    for switch in &railjson.switches {
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
    for track_section in &railjson.track_sections {
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
        };

        endpoint = track.push_track_section(railjson, &endpoint);
        // Follow the track sections and link switches until there are no more link switches.
        while let Some(linked_endpoint) = link_switches.get(&endpoint) {
            endpoint = track.push_track_section(railjson, linked_endpoint);
        }

        // Remove the endpoint from the track boundaries, so that we don't start a track from it.
        track_boundaries.retain(|ep| ep != &endpoint);
        // Check if there is a intersection at the end of the track.
        track.switch_at_end = endpoints_linked_to_intersection.contains(&endpoint);

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

/// Helper function to create a signal with some default parameters.
fn new_bal(track: Identifier, position: f64, direction: Direction, nf: bool) -> Signal {
    let mut settings = HashMap::new();
    settings.insert(
        NonBlankString::from("Nf"),
        NonBlankString::from(if nf { "true" } else { "false" }),
    );

    let mut default_parameters = HashMap::new();
    default_parameters.insert(
        NonBlankString::from("jaune_cli"),
        NonBlankString::from("false"),
    );

    Signal {
        id: Identifier::from(Uuid::new_v4()),
        direction,
        track,
        position,
        sight_distance: 400.,
        logical_signals: vec![LogicalSignal {
            signaling_system: "BAL".to_string(),
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

/// Override the signals and detectors and generate them from the track sections and switches.
pub fn generate_signals(railjson: &mut RailJson) {
    let tracks = create_tracks(railjson);

    let signals = create_signals(&tracks);

    railjson.detectors = signals.iter().map(crate::utils::detector).collect();
    railjson.signals = signals;
}

#[cfg(test)]
mod tests {

    use rstest::rstest;

    use schemas::infra::Direction;
    use schemas::primitives::Identifier;
    use schemas::primitives::NonBlankString;

    #[test]
    fn generate_signals_switches() {
        let mut railjson =
            crate::osm_to_railjson::parse_osm("src/tests/switches.osm.pbf".into(), true).unwrap();
        super::generate_signals(&mut railjson);
        assert_eq!(railjson.signals.len(), 371);
        assert_eq!(railjson.detectors.len(), 371);
    }

    #[rstest]
    #[case(Identifier::from("8598-0"), 306.7, Direction::StartToStop)]
    #[case(Identifier::from("8616-0"), 251.2, Direction::StartToStop)]
    #[case(Identifier::from("8597-1"), 100.0, Direction::StopToStart)]
    #[case(Identifier::from("8599-0"), 100.0, Direction::StopToStart)]
    #[case(Identifier::from("8603-0"), 12.4, Direction::StopToStart)]
    #[case(Identifier::from("8600-0"), 12.5, Direction::StopToStart)]
    fn generate_signals_intersection(
        #[case] expected_track: Identifier,
        #[case] expected_position: f64,
        #[case] expected_direction: Direction,
    ) {
        let mut railjson =
            crate::osm_to_railjson::parse_osm("src/tests/intersection.osm.pbf".into(), true)
                .unwrap();
        super::generate_signals(&mut railjson);

        assert!(signal_exists(
            &railjson,
            &expected_track,
            expected_position,
            &expected_direction
        ));
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

    #[test]
    fn generate_signals_intersection_nf() {
        let mut railjson =
            crate::osm_to_railjson::parse_osm("src/tests/intersection.osm.pbf".into(), true)
                .unwrap();
        super::generate_signals(&mut railjson);
        assert_eq!(railjson.signals.len(), 6);

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
}
