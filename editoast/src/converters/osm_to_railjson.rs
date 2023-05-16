use osm4routing::Edge;

use super::utils::*;
use crate::schema::*;
use log::{error, info};

use std::{collections::HashMap, error::Error, path::PathBuf};
/// Run the osm-to-railjson subcommand
/// Converts OpenStreetMap pbf file to railjson
pub fn osm_to_railjson(
    osm_pbf_in: PathBuf,
    railjson_out: PathBuf,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    env_logger::init();
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
        .reject("railway", "workshop")
        .reject("railway", "container_terminal")
        .reject("railway", "turntable")
        .reject("railway", "proposed")
        .reject("railway", "disused")
        .reject("railway", "abandoned")
        .reject("railway", "razed")
        .reject("railway", "platform")
        .reject("railway", "platform_edge")
        .reject("railway", "tram")
        .reject("railway", "subway")
        .reject("railway", "miniature")
        .read(osm_pbf_in.to_str().unwrap())?;
    info!("🗺️ We have {} nodes and {} edges", nodes.len(), edges.len());

    let rail_edges = edges
        .iter()
        .filter(|e| e.properties.train == osm4routing::TrainAccessibility::Allowed);

    let mut railjson = RailJson {
        switch_types: default_switch_types(),
        ..Default::default()
    };

    railjson.track_sections = rail_edges
        .clone()
        .map(|e| {
            let geo = geos::geojson::Geometry::new(geos::geojson::Value::LineString(
                e.geometry.iter().map(|c| vec![c.lon, c.lat]).collect(),
            ));
            TrackSection {
                id: e.id.as_str().into(),
                length: e.length(),
                geo: geo.clone(),
                sch: geo,
                slopes: vec![],
                curves: vec![],
                ..Default::default()
            }
        })
        .collect();

    let mut adjacencies = HashMap::<osm4routing::NodeId, NodeAdjacencies>::new();
    for edge in rail_edges {
        adjacencies.entry(edge.source).or_default().edges.push(edge);
        adjacencies.entry(edge.target).or_default().edges.push(edge);
    }

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

        match (adj.edges.len(), adj.tracks.len()) {
            (0, _) => error!("osm-to-railjson: node {} without edge", node.0),
            (1, _) => {} // TODO: handle buffer stops
            (2, 1) => railjson.track_section_links.push(TrackSectionLink {
                id: node.0.to_string().into(),
                src: adj.tracks[0].0.clone(),
                dst: adj.tracks[0].1.clone(),
            }),
            (2, _) => log::debug!("osm-to-railjson: node {} with 2 edges, not 1 track", node.0),
            (3, 2) => railjson.switches.push(point_switch(node, &adj.tracks)),
            (4, 2) => railjson
                .switches
                .push(build_cross_switch(node, &adj.tracks)),
            _ => {} // TODO: handle other switch types and buffers
        }
    }
    Ok(railjson)
}

#[cfg(test)]
mod tests {
    use crate::{converters::*, schema::RailJson};

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
        let railjson = parse_osm("src/tests/switches.osm.pbf".into()).unwrap();
        assert_eq!(3, railjson.switch_types.len());
        assert_eq!(2, railjson.switches.len());
        let switch = &railjson.switches[0];
        assert_eq!("point", switch.switch_type.as_str());
        assert_eq!(3, switch.ports.len());

        let cross = &railjson.switches[1];
        assert_eq!("cross_over", cross.switch_type.as_str());
        assert_eq!(4, cross.ports.len());
    }
}
