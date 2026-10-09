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
    let node_id_to_metadata = map_node_id_to_metadata(&mut pbf);

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
            let main_code = main_code(&rel, &node_id_to_metadata);
            // Parts can be empty when the stop_area references stops that are not railway (e.g. bus station)
            if parts.is_empty() {
                return None;
            }
            let identifier_name = name(&rel.tags);
            let mut identifier_uic = uic(&rel, &node_id_to_metadata);

            if identifier_uic.is_none() {
                warn!("Operational point {identifier_name} has no UIC code. Setting it to None.");
            }

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
            let country_code: NonBlankString = identifier_uic.map_or("??".into(), contry_code);
            let mut suffix = 1;
            let mut unique_main_code = main_code.clone();
            loop {
                if marked_domestic.insert((country_code.clone(), unique_main_code.clone())) {
                    break;
                }
                unique_main_code = format!("{main_code}-{suffix}").into();
                suffix += 1;
            }

            let (secondary_code, secondary_name) = default_secondary_code_and_name(&country_code);

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
                secondary_code,
                secondary_name,
            })
        })
        .collect()
}

fn default_secondary_code_and_name(
    country_code: &NonBlankString,
) -> (Option<NonBlankString>, Option<NonBlankString>) {
    match country_code.as_str() {
        "FR" => (Some("BV".into()), Some("BV".into())),
        _ => (None, None),
    }
}

struct NodeMetadata {
    main_code: Option<NonBlankString>,
    uic: Option<u32>,
}

/// Find all nodes that have a `railway:ref` and `uic_ref` tag and create a mapping from their id to their metadata.
fn map_node_id_to_metadata(
    pbf: &mut OsmPbfReader<std::fs::File>,
) -> HashMap<osm4routing::osmpbfreader::NodeId, NodeMetadata> {
    pbf.iter()
        .flatten()
        .filter_map(|obj| match obj {
            osm4routing::osmpbfreader::OsmObj::Node(node) => Some(node),
            _ => None,
        })
        .filter_map(|node| {
            let main_code = node
                .tags
                .get("railway:ref")
                .map(|tag| NonBlankString::from(tag.to_string()));
            let uic = node
                .tags
                .get("uic_ref")
                .and_then(|tag| tag.parse::<u32>().ok());
            if uic.is_none() && main_code.is_none() {
                None
            } else {
                Some((node.id, NodeMetadata { main_code, uic }))
            }
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
    node_id_to_metadata: &HashMap<NodeId, NodeMetadata>,
) -> NonBlankString {
    relation
        .refs
        .iter()
        .filter_map(|r| match r.member {
            osm4routing::osmpbfreader::OsmId::Node(id) => Some(id),
            _ => None,
        })
        .find_map(|node_id| {
            node_id_to_metadata
                .get(&node_id)
                .and_then(|meta| meta.main_code.clone())
        })
        .unwrap_or(NonBlankString::from(Uuid::new_v4().to_string()))
}

/// Extract UIC code.
/// Search in both the relation and nodes members of the relation.
fn uic(rel: &Relation, node_id_to_metadata: &HashMap<NodeId, NodeMetadata>) -> Option<u32> {
    let find_from_nodes = || {
        rel.refs
            .iter()
            .filter_map(|r| match r.member {
                osm4routing::osmpbfreader::OsmId::Node(id) => Some(id),
                _ => None,
            })
            .find_map(|node_id| node_id_to_metadata.get(&node_id).and_then(|meta| meta.uic))
    };

    rel.tags
        .get("uic_ref")
        .and_then(|uic| match u32::from_str(uic.as_str()) {
            Ok(uic) => Some(uic),
            Err(_) => {
                warn!("Could not parse {uic} uic code as integer");
                None
            }
        })
        .or_else(find_from_nodes)
}

/// Extract name from relation tags
fn name(tags: &osm4routing::osmpbfreader::Tags) -> NonBlankString {
    tags.get("name")
        .map_or("unknown".into(), |name| name.as_str().into())
}

/// Extract country code from UIC code. The country code is encoded in the first two digits of the UIC code.
/// If the UIC code is not recognized, we return "??" and log a warning.
fn contry_code(uic: u32) -> NonBlankString {
    let uic = uic.to_string();
    let uic_country = uic.chars().take(2).collect::<String>();
    // Source: https://en.wikipedia.org/wiki/List_of_UIC_country_codes
    match uic_country.as_str() {
        "10" => "FI", // Finland
        "20" => "RU", // Russia
        "21" => "BY", // Belarus
        "22" => "UA", // Ukraine
        "23" => "MD", // Moldova
        "24" => "LT", // Lithuania
        "25" => "LV", // Latvia
        "26" => "EE", // Estonia
        "27" => "KZ", // Kazakhstan
        "28" => "GE", // Georgia
        "29" => "UZ", // Uzbekistan
        "30" => "KP", // North Korea
        "31" => "MN", // Mongolia
        "32" => "VN", // Vietnam
        "33" => "CN", // China
        "34" => "LA", // Laos
        "40" => "CU", // Cuba
        "41" => "AL", // Albania
        "42" => "JP", // Japan
        "44" => "BA", // Bosnia and Herzegovina, Serb Republic of
        "49" => "BA", // Bosnia and Herzegovina
        "50" => "BA", // Bosnia and Herzegovina, Muslim-Croat Federation
        "51" => "PL", // Poland
        "52" => "BG", // Bulgaria
        "53" => "RO", // Romania
        "54" => "CZ", // Czech Republic
        "55" => "HU", // Hungary
        "56" => "SK", // Slovakia
        "57" => "AZ", // Azerbaijan
        "58" => "AM", // Armenia
        "59" => "KG", // Kyrgyzstan
        "60" => "IE", // Ireland
        "61" => "KR", // South Korea
        "62" => "ME", // Montenegro
        "65" => "MK", // North Macedonia
        "66" => "TJ", // Tajikistan
        "67" => "TM", // Turkmenistan
        "68" => "AF", // Afghanistan
        "70" => "GB", // United Kingdom
        "71" => "ES", // Spain
        "72" => "RS", // Serbia
        "73" => "GR", // Greece
        "74" => "SE", // Sweden
        "75" => "TR", // Turkey
        "76" => "NO", // Norway
        "78" => "HR", // Croatia
        "79" => "SI", // Slovenia
        "80" => "DE", // Germany
        "81" => "AT", // Austria
        "82" => "LU", // Luxembourg
        "83" => "IT", // Italy
        "84" => "NL", // Netherlands
        "85" => "CH", // Switzerland
        "86" => "DK", // Denmark
        "87" => "FR", // France
        "88" => "BE", // Belgium
        "89" => "TZ", // Tanzania
        "90" => "EG", // Egypt
        "91" => "TN", // Tunisia
        "92" => "DZ", // Algeria
        "93" => "MA", // Morocco
        "94" => "PT", // Portugal
        "95" => "IL", // Israel
        "96" => "IR", // Iran
        "97" => "SY", // Syria
        "98" => "LB", // Lebanon
        "99" => "IQ", // Iraq
        _ => {
            warn!("UIC code {uic} has an unknown country code {uic_country}");
            "??"
        }
    }
    .into()
}
