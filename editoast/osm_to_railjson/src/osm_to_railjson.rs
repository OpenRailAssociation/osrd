use std::error::Error;
use std::path::PathBuf;

use tracing::debug;
use tracing::info;

use super::utils::*;
use crate::generate_routes;
use crate::generate_signals;
use crate::operational_point::operational_points;
use schemas::infra::RailJson;

use itertools::Itertools as _;

/// Run the osm-to-railjson subcommand
/// Converts OpenStreetMap pbf file to railjson
pub fn osm_to_railjson(
    osm_pbf_in: PathBuf,
    railjson_out: PathBuf,
    generate_signals: bool,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    info!(
        "🗺️ Converting {} to {}",
        osm_pbf_in.display(),
        railjson_out.display()
    );
    let railjson = parse_osm(osm_pbf_in, generate_signals)?;

    info!("Writing RailJson to {} with:", railjson_out.display());
    info!(
        "  - {} operational points",
        railjson.operational_points.len()
    );
    info!("  - {} routes", railjson.routes.len());
    info!(
        "  - {} extended switch types",
        railjson.extended_switch_types.len()
    );
    info!("  - {} switches", railjson.switches.len());
    info!("  - {} track sections", railjson.track_sections.len());
    info!("  - {} speed sections", railjson.speed_sections.len());
    info!("  - {} neutral sections", railjson.neutral_sections.len());
    info!("  - {} electrifications", railjson.electrifications.len());
    info!("  - {} signals", railjson.signals.len());
    info!("  - {} buffer stops", railjson.buffer_stops.len());
    info!("  - {} detectors", railjson.detectors.len());
    info!("  - {} level crossings", railjson.level_crossings.len());

    let file = std::fs::File::create(railjson_out)?;
    serde_json::to_writer(file, &railjson)?;
    Ok(())
}

pub fn parse_osm(
    osm_pbf_in: PathBuf,
    generate_signals: bool,
) -> Result<RailJson, Box<dyn Error + Send + Sync>> {
    let (nodes, edges) = osm4routing::Reader::new()
        .require("railway", "rail")
        .reject("service", "yard")
        .reject("service", "siding")
        .reject("service", "spur")
        .reject("building", "*")
        .reject("area", "yes")
        .reject("gauge", "600")
        .reject("roller_coaster", "*")
        .reject("construction", "*")
        .reject("usage", "science")
        .reject("usage", "tourism")
        .read_tag("maxspeed")
        .read_tag("maxspeed:forward")
        .read_tag("maxspeed:backward")
        .read_tag("voltage")
        .read_tag("local_ref")
        .read_tag("name")
        .read_tag("railway:track_ref")
        .read(&osm_pbf_in)?;
    info!("🗺️ We have {} nodes and {} edges", nodes.len(), edges.len());

    let edges = edges
        .into_iter()
        .filter(|e| e.properties.train == osm4routing::TrainAccessibility::Allowed)
        .filter(|e| e.source != e.target)
        .collect_vec();

    let mut adjacencies = build_adjacencies(&edges);
    let nodes_tracks = NodeToTrack::from_edges(&edges);

    let track_sections = track_sections(&edges);
    let (switches, buffer_stops) = switches_and_buffer_stops(&mut adjacencies);
    let speed_sections = edges.iter().flat_map(speed_sections).collect_vec();
    let electrifications = edges.iter().flat_map(electrifications).collect();
    let operational_points = operational_points(&osm_pbf_in, &nodes_tracks, &track_sections);
    let signals = if generate_signals {
        generate_signals::generate_signals(&track_sections, &switches, &speed_sections)
    } else {
        signals(&osm_pbf_in, &nodes_tracks, &adjacencies)
    };
    let detectors = signals.iter().map(detector).collect_vec();

    debug!("Start generating routes");
    let routes = generate_routes::routes(&track_sections, &detectors, &buffer_stops, &switches);
    debug!("Done, got {} routes", routes.len());

    Ok(RailJson {
        detectors,
        signals,
        speed_sections,
        electrifications,
        operational_points,
        track_sections,
        switches,
        buffer_stops,
        routes,
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use schemas::infra::ApplicableDirections;
    use schemas::infra::RailJson;
    use schemas::infra::TrackEndpoint;
    use schemas::primitives::Identifier;
    use std::collections::HashMap;

    use super::*;

    #[test]
    fn convert_osm_to_railjson() {
        let output = tempfile::NamedTempFile::new().unwrap();
        assert!(
            osm_to_railjson(
                "src/tests/minimal_rail.osm.pbf".into(),
                output.path().into(),
                false,
            )
            .is_ok()
        );

        let data = std::fs::read_to_string(output.path()).unwrap();
        let railjson: RailJson = serde_json::from_str(&data).unwrap();
        assert_eq!(1, railjson.track_sections.len());
    }

    #[test]
    fn parse_switches() {
        fn port_eq(ports: &HashMap<Identifier, TrackEndpoint>, name: &str, expected: &str) -> bool {
            ports.get(&name.into()).unwrap().track.0 == expected
        }
        let mut railjson = parse_osm("src/tests/switches.osm.pbf".into(), false).unwrap();
        assert_eq!(4, railjson.switches.len());
        assert_eq!(18, railjson.buffer_stops.len());

        // Switches can be in a random order, we sort them to be sure to extract the expected ones
        railjson
            .switches
            .sort_by(|a, b| a.switch_type.as_str().cmp(b.switch_type.as_str()));

        let switch = &railjson.switches[2];
        assert_eq!("link", switch.switch_type.as_str());
        assert_eq!(2, switch.ports.len());

        let switch = &railjson.switches[3];
        assert_eq!("point_switch", switch.switch_type.as_str());
        assert_eq!(3, switch.ports.len());
        assert!(port_eq(&switch.ports, "A", "-103478-0"));
        let a =
            port_eq(&switch.ports, "B1", "-103478-1") && port_eq(&switch.ports, "B2", "-103477-0");
        let b =
            port_eq(&switch.ports, "B1", "-103477-0") && port_eq(&switch.ports, "B2", "-103478-1");
        assert!(a || b);

        let cross = &railjson.switches[0];
        assert_eq!("crossing", cross.switch_type.as_str());
        assert_eq!(4, cross.ports.len());
        let a =
            port_eq(&cross.ports, "A1", "-103476-0") && port_eq(&cross.ports, "B1", "-103476-1");
        let b =
            port_eq(&cross.ports, "A1", "-103476-1") && port_eq(&cross.ports, "B1", "-103476-0");
        let c = port_eq(&cross.ports, "A1", "103475-0") && port_eq(&cross.ports, "B1", "103475-1");
        let d = port_eq(&cross.ports, "A1", "103475-1") && port_eq(&cross.ports, "B1", "103475-0");
        assert!(a || b || c || d);

        let double = &railjson.switches[1];
        assert_eq!("double_slip_switch", double.switch_type.as_str());
        assert_eq!(4, double.ports.len());
        let a = ["-103474-0", "-103474-1"]
            .iter()
            .any(|t| port_eq(&double.ports, "A1", t))
            && ["-103473-0", "-103473-1"]
                .iter()
                .any(|t| port_eq(&double.ports, "A2", t));
        let b = ["-103473-0", "-103473-1"]
            .iter()
            .any(|t| port_eq(&double.ports, "A1", t))
            && ["-103474-0", "-103474-1"]
                .iter()
                .any(|t| port_eq(&double.ports, "A2", t));
        assert!(a || b);
    }

    #[test]
    fn parse_signals() {
        let railjson = parse_osm("src/tests/signals.osm.pbf".into(), false).unwrap();
        assert_eq!(1, railjson.signals.len());
        assert_eq!(1, railjson.detectors.len());
    }

    #[test]
    fn ignore_signals_at_end_of_line() {
        let railjson = parse_osm("src/tests/signal_at_end_of_line.osm.pbf".into(), false).unwrap();
        assert!(railjson.signals.is_empty());
        assert_eq!(2, railjson.buffer_stops.len());
    }

    #[test]
    fn parse_speed() {
        let rj = parse_osm("src/tests/minimal_rail.osm.pbf".into(), false).unwrap();
        assert_eq!(2, rj.speed_sections.len());
        let forward = rj
            .speed_sections
            .iter()
            .find(|s| s.track_ranges[0].applicable_directions == ApplicableDirections::StartToStop)
            .unwrap();
        assert!((120. / 3.6 - forward.speed_limit.unwrap().0).abs() < 0.1);
        let backward = rj
            .speed_sections
            .iter()
            .find(|s| s.track_ranges[0].applicable_directions == ApplicableDirections::StopToStart)
            .unwrap();
        assert!((60. / 3.6 - backward.speed_limit.unwrap().0).abs() < 0.1);
    }

    #[test]
    fn parse_electrifications() {
        let rj = parse_osm("src/tests/minimal_rail.osm.pbf".into(), false).unwrap();
        assert_eq!(1, rj.electrifications.len());
        assert_eq!("15000V", rj.electrifications[0].voltage);
    }

    #[test]
    fn parse_stations() {
        let rj = parse_osm("src/tests/station.osm.pbf".into(), false).unwrap();
        assert_eq!(1, rj.operational_points.len());
        let op = &rj.operational_points[0];
        assert_eq!(2, op.parts.len());
        assert_eq!("atlantis", op.name);
        assert_eq!(Some(1234), op.uic);
        assert_eq!("TRI", op.main_code);
    }
}
