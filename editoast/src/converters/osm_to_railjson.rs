use super::utils::*;
use crate::{converters::generate_routes, schema::*};
use log::{error, info};

use std::{collections::HashMap, error::Error, path::PathBuf};
/// Run the osm-to-railjson subcommand
/// Converts OpenStreetMap pbf file to railjson
pub fn osm_to_railjson(
    osm_pbf_in: PathBuf,
    railjson_out: PathBuf,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    info!(
        "🗺️ Converting {} to {}",
        osm_pbf_in.display(),
        railjson_out.display()
    );
    let railjson = parse_osm(osm_pbf_in)?;
    let file = std::fs::File::create(railjson_out)?;
    serde_json::to_writer(file, &railjson)?;
    Ok(())
}

pub fn parse_osm(osm_pbf_in: PathBuf) -> Result<RailJson, Box<dyn Error + Send + Sync>> {
    let (nodes, edges) = osm4routing::Reader::new()
        .reject("building", "*")
        .reject("area", "yes")
        .reject("railway", "Rangierbezirk")
        .reject("railway", "station_area")
        .reject("railway", "workshop")
        .reject("railway", "container_terminal")
        .reject("railway", "turntable")
        .reject("railway", "traverser")
        .reject("railway", "proposed")
        .reject("railway", "disused")
        .reject("railway", "abandoned")
        .reject("railway", "razed")
        .reject("railway", "platform")
        .reject("railway", "platform_edge")
        .reject("railway", "tram")
        .reject("railway", "subway")
        .reject("railway", "miniature")
        .reject("railway", "light_rail")
        .reject("railway", "narrow_gauge")
        .reject("service", "yard")
        .reject("service", "siding")
        .reject("service", "spur")
        .reject("railway", "loading_ramp")
        .reject("gauge", "600")
        .reject("railway", "Wendeanlage")
        .reject("roller_coaster", "*")
        .reject("construction", "*")
        .read_tag("maxspeed")
        .read_tag("maxspeed:forward")
        .read_tag("maxspeed:backward")
        .read_tag("voltage")
        .read(osm_pbf_in.to_str().unwrap())?;
    info!("🗺️ We have {} nodes and {} edges", nodes.len(), edges.len());

    let rail_edges = edges
        .iter()
        .filter(|e| e.properties.train == osm4routing::TrainAccessibility::Allowed)
        .filter(|e| e.source != e.target);

    let mut adjacencies = HashMap::<osm4routing::NodeId, NodeAdjacencies>::new();
    for edge in rail_edges.clone() {
        adjacencies.entry(edge.source).or_default().edges.push(edge);
        adjacencies.entry(edge.target).or_default().edges.push(edge);
    }

    let signals = signals(osm_pbf_in, &edges, &adjacencies);
    let mut railjson = RailJson {
        switch_types: default_switch_types(),
        detectors: signals.iter().map(detector).collect(),
        signals,
        speed_sections: rail_edges.clone().flat_map(speed_sections).collect(),
        catenaries: rail_edges.clone().flat_map(catenaries).collect(),
        ..Default::default()
    };

    railjson.track_sections = rail_edges
        .map(|e| {
            let geo = geos::geojson::Geometry::new(geos::geojson::Value::LineString(
                e.geometry.iter().map(|c| vec![c.lon, c.lat]).collect(),
            ));
            TrackSection {
                id: e.id.as_str().into(),
                length: e.length(),
                geo: geo.clone(),
                sch: geo,
                ..Default::default()
            }
        })
        .collect();

    for (node, mut adj) in adjacencies {
        for e1 in &adj.edges {
            for e2 in &adj.edges {
                if e1.id < e2.id {
                    if let Some(branch) = try_into_branch(node, e1, e2) {
                        adj.branches.push(branch);
                    }
                }
            }
        }

        let id = node.0;
        let edges_count = adj.edges.len();
        let branches_count = adj.branches.len();
        match (edges_count, branches_count) {
            (0, _) => error!("node {id} without edge"),
            (1, 0) => railjson
                .buffer_stops
                .push(edge_to_buffer(&node, adj.edges[0], 0)),
            (2, 0) => {
                // This can happens when data is trucated (e.g. cropped to a region, or the output track is a service track)
                railjson
                    .buffer_stops
                    .push(edge_to_buffer(&node, adj.edges[0], 0));
                railjson
                    .buffer_stops
                    .push(edge_to_buffer(&node, adj.edges[1], 1));
            }
            (2, 1) => railjson.track_section_links.push(TrackSectionLink {
                id: node.0.to_string().into(),
                src: adj.branches[0].0.clone(),
                dst: adj.branches[0].1.clone(),
            }),
            (3, 2) => railjson.switches.push(point_switch(node, &adj.branches)),
            (4, 2) => railjson.switches.push(cross_switch(node, &adj.branches)),
            (4, 4) => railjson
                .switches
                .push(double_slip_switch(node, &adj.branches)),
            _ => log::debug!("node {id} with {edges_count} edges and {branches_count} branches"),
        }
    }
    log::debug!("Start generating routes");
    railjson.routes = generate_routes::routes(&railjson);
    log::debug!("Done, got {} routes", railjson.routes.len());
    Ok(railjson)
}

#[cfg(test)]
mod tests {
    use crate::{
        converters::*,
        schema::{utils::Identifier, *},
    };
    use std::collections::HashMap;

    use super::parse_osm;
    #[test]
    fn convert_osm_to_railjson() {
        let output = tempfile::NamedTempFile::new().unwrap();
        assert!(osm_to_railjson(
            "src/tests/minimal_rail.osm.pbf".into(),
            output.path().into()
        )
        .is_ok());

        let data = std::fs::read_to_string(output.path()).unwrap();
        let railjson: RailJson = serde_json::from_str(&data).unwrap();
        assert_eq!(1, railjson.track_sections.len());
    }

    #[test]
    fn parse_switches() {
        fn port_eq(ports: &HashMap<Identifier, TrackEndpoint>, name: &str, expected: &str) -> bool {
            ports.get(&name.into()).unwrap().track.0 == expected
        }
        let mut railjson = parse_osm("src/tests/switches.osm.pbf".into()).unwrap();
        assert_eq!(3, railjson.switch_types.len());
        assert_eq!(3, railjson.switches.len());
        assert_eq!(18, railjson.buffer_stops.len());

        // Switches can be in a random order, we sort them to be sure to extract the expected ones
        railjson
            .switches
            .sort_by(|a, b| a.switch_type.as_str().cmp(b.switch_type.as_str()));

        let switch = &railjson.switches[2];
        assert_eq!("point", switch.switch_type.as_str());
        assert_eq!(3, switch.ports.len());
        assert!(port_eq(&switch.ports, "BASE", "-103478-0"));
        let a = port_eq(&switch.ports, "LEFT", "-103478-1")
            && port_eq(&switch.ports, "RIGHT", "-103477-0");
        let b = port_eq(&switch.ports, "LEFT", "-103477-0")
            && port_eq(&switch.ports, "RIGHT", "-103478-1");
        assert!(a || b);

        let cross = &railjson.switches[0];
        assert_eq!("cross_over", cross.switch_type.as_str());
        assert_eq!(4, cross.ports.len());
        let a = port_eq(&cross.ports, "NORTH", "-103476-0")
            && port_eq(&cross.ports, "SOUTH", "-103476-1");
        let b = port_eq(&cross.ports, "NORTH", "-103476-1")
            && port_eq(&cross.ports, "SOUTH", "-103476-0");
        let c = port_eq(&cross.ports, "NORTH", "103475-0")
            && port_eq(&cross.ports, "SOUTH", "103475-1");
        let d = port_eq(&cross.ports, "NORTH", "103475-1")
            && port_eq(&cross.ports, "SOUTH", "103475-0");
        assert!(a || b || c || d);

        let double = &railjson.switches[1];
        assert_eq!("double_slip", double.switch_type.as_str());
        assert_eq!(4, double.ports.len());
        let a = ["-103474-0", "-103474-1"]
            .iter()
            .any(|t| port_eq(&double.ports, "NORTH-1", t))
            && ["-103473-0", "-103473-1"]
                .iter()
                .any(|t| port_eq(&double.ports, "NORTH-2", t));
        let b = ["-103473-0", "-103473-1"]
            .iter()
            .any(|t| port_eq(&double.ports, "NORTH-1", t))
            && ["-103474-0", "-103474-1"]
                .iter()
                .any(|t| port_eq(&double.ports, "NORTH-2", t));
        assert!(a || b);
    }

    #[test]
    fn parse_signals() {
        let railjson = parse_osm("src/tests/signals.osm.pbf".into()).unwrap();
        assert_eq!(1, railjson.signals.len());
        assert_eq!(1, railjson.detectors.len());
        assert_eq!(
            railjson.signals[0].linked_detector,
            Some(railjson.detectors[0].id.to_string())
        )
    }

    #[test]
    fn ignore_signals_at_end_of_line() {
        let railjson = parse_osm("src/tests/signal_at_end_of_line.osm.pbf".into()).unwrap();
        assert!(railjson.signals.is_empty());
        assert_eq!(2, railjson.buffer_stops.len());
    }

    #[test]
    fn parse_speed() {
        let rj = parse_osm("src/tests/minimal_rail.osm.pbf".into()).unwrap();
        assert_eq!(2, rj.speed_sections.len());
        let forward = rj
            .speed_sections
            .iter()
            .find(|s| s.track_ranges[0].applicable_directions == ApplicableDirections::StartToStop)
            .unwrap();
        assert!((120. / 3.6 - forward.speed_limit.unwrap()).abs() < 0.1);
        let backward = rj
            .speed_sections
            .iter()
            .find(|s| s.track_ranges[0].applicable_directions == ApplicableDirections::StopToStart)
            .unwrap();
        assert!((60. / 3.6 - backward.speed_limit.unwrap()).abs() < 0.1);
    }

    #[test]
    fn parse_catenaries() {
        let rj = parse_osm("src/tests/minimal_rail.osm.pbf".into()).unwrap();
        assert_eq!(1, rj.catenaries.len());
        assert_eq!("15000", rj.catenaries[0].voltage);
    }
}
