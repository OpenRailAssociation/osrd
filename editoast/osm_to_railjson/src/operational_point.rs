use osm4routing::NodeId;
use osm4routing::osmpbfreader::OsmPbfReader;
use osm4routing::osmpbfreader::Relation;
use schemas::infra::OperationalPoint;
use schemas::infra::OperationalPointPart;
use schemas::infra::TrackSection;
use schemas::primitives::Identifier;
use schemas::primitives::NonBlankString;

use std::collections::HashMap;
use std::collections::HashSet;
use std::str::FromStr as _;

use tracing::warn;
use uuid::Uuid;

use crate::utils::NodeToTrack;

/// We use OSM relations with the tag [public_transport=stop_area](https://wiki.openstreetmap.org/wiki/Tag:public_transport%3Dstop_area) as operational points.
pub(crate) fn operational_points(
    osm_pbf_in: &std::path::PathBuf,
    nodes_to_tracks: &NodeToTrack,
    track_sections: &[TrackSection],
) -> Vec<OperationalPoint> {
    let file = std::fs::File::open(osm_pbf_in).unwrap();
    let mut pbf: OsmPbfReader<std::fs::File> = osm4routing::osmpbfreader::OsmPbfReader::new(file);
    let node_id_to_main_code = map_node_id_to_main_code(&mut pbf);
    let mut marked_uic: HashSet<u32> = Default::default();
    let mut marked_domestic: HashSet<(NonBlankString, NonBlankString)> = Default::default();
    pbf.rewind().expect("Could not rewind file.");
    pbf.iter()
        .flatten()
        .filter(|obj| obj.tags().contains("public_transport", "stop_area"))
        .flat_map(|obj| match obj {
            osm4routing::osmpbfreader::OsmObj::Relation(rel) => Some(rel), // Only consider OSM relations
            _ => None,                                                     // Discard Nodes and Ways
        })
        .flat_map(|rel| {
            let parts = parts(&rel, nodes_to_tracks, track_sections);
            let main_code = main_code(&rel, &node_id_to_main_code);
            // Parts can be empty when the stop_area references stops that are not railway (e.g. bus station)
            if parts.is_empty() {
                return None;
            }
            let (identifier_name, mut identifier_uic) = identifier(&rel.tags);

            // Check uic uniqueness. If the uic is already used, we set it to None to avoid duplicates.
            if let Some(uic) = identifier_uic
                && !marked_uic.insert(uic)
            {
                identifier_uic = None;
                warn!(
                    "UIC code {uic} is already used. Setting it to None for operational point {}",
                    rel.id.0
                );
            }

            // Check domestic code uniqueness. If the domestic code is already used, we add a suffix to it to avoid duplicates.
            let country_code: NonBlankString = "FR".into();
            let mut suffix = 1;
            let mut unique_main_code = main_code.clone();
            loop {
                if marked_domestic.insert((country_code.clone(), unique_main_code.clone())) {
                    break;
                }
                unique_main_code = format!("{main_code}-{suffix}").into();
                suffix += 1;
            }

            Some(OperationalPoint {
                id: rel.id.0.to_string().into(),
                parts,
                weight: None,
                name: identifier_name,
                uic: identifier_uic,
                plc: None,
                country_code,
                main_code: unique_main_code,
                is_passenger_station: true,
                secondary_code: None,
                secondary_name: None,
            })
        })
        .collect()
}

/// Find all nodes that have a `railway:ref` tag and create a mapping from their id to the value of this tag.
fn map_node_id_to_main_code(
    pbf: &mut OsmPbfReader<std::fs::File>,
) -> HashMap<osm4routing::osmpbfreader::NodeId, NonBlankString> {
    pbf.iter()
        .flatten()
        .filter_map(|obj| match obj {
            osm4routing::osmpbfreader::OsmObj::Node(node) => node
                .tags
                .get("railway:ref")
                .map(|tag| (node.id, NonBlankString::from(tag.to_string()))),
            _ => None,
        })
        .collect()
}

fn parts(
    relation: &Relation,
    nodes_to_tracks: &NodeToTrack,
    track_sections: &[TrackSection],
) -> Vec<OperationalPointPart> {
    relation
		.refs
		.iter()
		.filter(|r| r.role == "stop") // We ignore other members of the relation
		.flat_map(|r| match r.member {
			osm4routing::osmpbfreader::OsmId::Node(id) => Some(id),
			_ => {
				warn!("OpenStreetMap relation ({}) has a member ({:?}) with role `stop` that isn’t a node", relation.id.0, r.member);
				None
			},
		})
		.flat_map(|node| {
			nodes_to_tracks
				.track_and_position(node)
				.map(|(track, position, local_track_name)| OperationalPointPart {
					track: track.clone(),
					position,
					local_track_name: local_track_name.unwrap_or_else(|| local_track_name_fallback(&track, track_sections)),
					extensions: Default::default()
				})
		})
		.collect()
}

/// If the local_track_name is None, we try to find if the track_section associated with this operational_point_part has a track_name.
/// If no track_name is found, we generate a random one.
fn local_track_name_fallback(
    track: &Identifier,
    track_sections: &[TrackSection],
) -> NonBlankString {
    track_sections
        .iter()
        .find(|track_section| track_section.id == *track)
        .and_then(|track_section| {
            if let Some(sncf) = &track_section.extensions.sncf
                && sncf.track_name != "??".into()
            {
                Some(sncf.track_name.clone())
            } else {
                None
            }
        })
        .unwrap_or(NonBlankString::from(Uuid::new_v4().to_string()))
}

/// Get operational point main_code.
/// Look through the nodes members of the relation and find one that has a "railway:ref" tag.
fn main_code(
    relation: &Relation,
    node_id_to_main_code: &HashMap<NodeId, NonBlankString>,
) -> NonBlankString {
    relation
        .refs
        .iter()
        .filter_map(|r| match r.member {
            osm4routing::osmpbfreader::OsmId::Node(id) => Some(id),
            _ => None,
        })
        .find_map(|node_id| node_id_to_main_code.get(&node_id).cloned())
        .unwrap_or(NonBlankString::from(Uuid::new_v4().to_string()))
}

/// Extract UIC and name from tags
fn identifier(tags: &osm4routing::osmpbfreader::Tags) -> (NonBlankString, Option<u32>) {
    let uic = tags
        .get("uic_ref")
        .and_then(|uic| match u32::from_str(uic.as_str()) {
            Ok(uic) => Some(uic),
            Err(_) => {
                warn!("Could not parse {uic} uic code as integer");
                None
            }
        });

    tags.get("name").map_or(
        // Generate a fake name from the UIC
        ("unknown".into(), uic),
        |name| (name.as_str().into(), uic),
    )
}
