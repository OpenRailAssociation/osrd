use osm4routing::NodeId;
use osm4routing::osmpbfreader::OsmPbfReader;
use osm4routing::osmpbfreader::Relation;
use schemas::infra::OperationalPoint;
use schemas::infra::OperationalPointPart;
use schemas::infra::TrackSection;
use schemas::primitives::Identifier;
use schemas::primitives::NonBlankString;

use std::collections::HashMap;
use std::str::FromStr;
use std::sync::atomic::AtomicU32;
use std::sync::atomic::Ordering;

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
                None
            } else {
                let (identifier_name, identifier_uic) = identifier(&rel.tags);
                Some(OperationalPoint {
                    id: rel.id.0.to_string().into(),
                    parts,
                    weight: None,
                    name: identifier_name,
                    uic: Some(identifier_uic),
                    plc: None,
                    country_code: "FR".into(),
                    main_code: main_code.into(),
                    secondary_code: Some("BV".into()),
                    is_passenger_station: true,
                    secondary_name: Some("BV".into()),
                })
            }
        })
        .collect()
}

/// Find all nodes that have a `railway:ref` tag and create a mapping from their id to the value of this tag.
fn map_node_id_to_main_code(
    pbf: &mut OsmPbfReader<std::fs::File>,
) -> HashMap<osm4routing::osmpbfreader::NodeId, String> {
    pbf.iter()
        .flatten()
        .filter_map(|obj| match obj {
            osm4routing::osmpbfreader::OsmObj::Node(node) => node
                .tags
                .get("railway:ref")
                .map(|tag| (node.id, tag.to_string())),
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

/// If the local_track_name is None, we try to find if the track_section associated to this operational_point_part has a track_name.
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
/// Look through the nodes member of the relation and find one that has a "railway:ref" tag.
fn main_code(relation: &Relation, node_id_to_main_code: &HashMap<NodeId, String>) -> String {
    relation
        .refs
        .iter()
        .filter_map(|r| match r.member {
            osm4routing::osmpbfreader::OsmId::Node(id) => Some(id),
            _ => None,
        })
        .find_map(|node_id| node_id_to_main_code.get(&node_id).cloned())
        .unwrap_or_default()
}

// TODO: the generation of fake UIC and name is here as a temporary solution.
// The front crashes when this function return None.
// This function will probably be changed when the data model will change.
// The necessity of a fake UIC and name should be re-evaluated at that time.
fn identifier(tags: &osm4routing::osmpbfreader::Tags) -> (NonBlankString, u32) {
    let uic = tags
        .get("uic_ref")
        .and_then(|uic| match u32::from_str(uic.as_str()) {
            Ok(uic) => Some(uic),
            Err(_) => {
                warn!("Could not parse {uic} uic code as integer");
                None
            }
        })
        .unwrap_or_else(|| {
            // Generate a fake UIC with code 11
            static UIC_COUNTER: AtomicU32 = AtomicU32::new(0);
            11_00000 + UIC_COUNTER.fetch_add(1, Ordering::Relaxed)
        });

    tags.get("name").map_or(
        // Generate a fake name from the UIC
        (format!("op_{}", uic).into(), uic),
        |name| (name.as_str().into(), uic),
    )
}
