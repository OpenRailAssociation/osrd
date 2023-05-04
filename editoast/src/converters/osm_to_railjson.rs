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
    let (nodes, edges) = osm4routing::read(osm_pbf_in.to_str().unwrap())?;
    println!("🗺️ We have {} nodes and {} edges", nodes.len(), edges.len());

    let rail_edges = edges
        .iter()
        .filter(|e| e.properties.train == osm4routing::TrainAccessibility::Allowed);

    let track_sections: Vec<_> = rail_edges
        .clone()
        .map(|e| TrackSection {
            id: e.id.as_str().into(),
            length: e.length(),
            geo: geos::geojson::Geometry::new(geos::geojson::Value::LineString(
                e.geometry.iter().map(|c| vec![c.lon, c.lat]).collect(),
            )),
            slopes: vec![],
            curves: vec![],
            ..Default::default()
        })
        .collect();

    let railjson = RailJson {
        track_sections,
        ..Default::default()
    };

    let file = std::fs::File::create(railjson_out)?;
    serde_json::to_writer(file, &railjson)?;
    Ok(())
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
