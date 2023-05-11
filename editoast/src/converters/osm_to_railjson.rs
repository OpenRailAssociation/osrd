use osm4routing::models::Edge;

use super::utils::*;
use crate::schema::*;

use std::{error::Error, path::PathBuf};
/// Run the osm-to-railjson subcommand
/// Converts OpenStreetMap pbf file to railjson
pub fn osm_to_railjson(
    osm_pbf_in: PathBuf,
    railjson_out: PathBuf,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    println!(
        "🗺️ Converting {} to {}",
        osm_pbf_in.display(),
        railjson_out.display()
    );
    let railjson = parse_osm(osm_pbf_in)?;
    let file = std::fs::File::create(railjson_out)?;
    serde_json::to_writer(file, &railjson)?;
    Ok(())
}

fn parse_osm(osm_pbf_in: PathBuf) -> Result<RailJson, Box<dyn Error + Send + Sync>> {
    let (nodes, edges) = osm4routing::read(osm_pbf_in.to_str().unwrap())?;
    println!("🗺️ We have {} nodes and {} edges", nodes.len(), edges.len());

    let rail_edges = edges
        .iter()
        .filter(|e| e.properties.train == osm4routing::TrainAccessibility::Allowed);

    let track_sections: Vec<_> = rail_edges
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

    let mut nodes = std::collections::HashMap::<osm4routing::NodeId, Vec<(&Edge, Endpoint)>>::new();
    for edge in rail_edges {
        let source = nodes.entry(edge.source).or_default();
        source.push((edge, Endpoint::Begin));
        let target = nodes.entry(edge.target).or_default();
        target.push((edge, Endpoint::End));
    }

    let track_section_links = nodes
        .values()
        .filter(|edges| edges.len() == 2)
        .map(|edges| build_track_section_link(edges[0], edges[1]))
        .collect();

    let point_switches = nodes
        .iter()
        .filter(|(_, edges)| edges.len() == 3)
        .map(build_point_switch)
        .filter_map(|e| e.ok())
        .collect();

    // TODO: handle other switch types
    Ok(RailJson {
        track_sections,
        track_section_links,
        switch_types: default_switch_types(),
        switches: point_switches,
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use crate::{converters::osm_to_railjson, schema::RailJson};
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
}
