use osm4routing::osmpbfreader::Node;
use schemas::infra::Direction;
use schemas::infra::LogicalSignal;
use schemas::infra::Side;
use schemas::infra::Signal;
use schemas::infra::SignalExtensions;
use schemas::infra::SignalSncfExtension;
use std::collections::HashMap;

use crate::utils::NodeAdjacencies;
use crate::utils::NodeToTrack;

pub(crate) fn signals(
    osm_pbf_in: &std::path::PathBuf,
    nodes_to_tracks: &NodeToTrack,
    adjacencies: &HashMap<osm4routing::NodeId, NodeAdjacencies>,
) -> Vec<Signal> {
    let file = std::fs::File::open(osm_pbf_in).unwrap();
    let mut pbf = osm4routing::osmpbfreader::OsmPbfReader::new(file);
    pbf.iter()
        .flatten()
        .filter(main_signal)
        .flat_map(|obj| match obj {
            osm4routing::osmpbfreader::OsmObj::Node(node) => Some(node),
            _ => None,
        })
        .filter(|node| adjacencies.get(&node.id).map_or(0, |adj| adj.edges.len()) != 1) // Ignore all the nodes that are at the end of a track, as it will be buffer stops
        .flat_map(|node| {
            if let Some((track, position, _local_ref)) = nodes_to_tracks.track_and_position(node.id)
            {
                let mut settings = HashMap::new();
                settings.insert("Nf".into(), "true".into());

                let mut default_parameters = HashMap::new();
                default_parameters.insert("jaune_cli".into(), "false".into());

                Some(Signal {
                    id: node.id.0.to_string().into(),
                    direction: direction(&node),
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
                        sncf: Some(sncf_extensions(&node)),
                    },
                })
            } else {
                None
            }
        })
        .collect()
}

fn main_signal(node: &osm4routing::osmpbfreader::OsmObj) -> bool {
    node.tags().contains_key("railway:signal:main")
        || node.tags().contains_key("railway:signal:combined")
}

fn direction(node: &osm4routing::osmpbfreader::Node) -> Direction {
    let direction_tag = node
        .tags
        .get("railway:signal:direction")
        .map(|tag| tag.as_str())
        .unwrap_or("forward");
    if direction_tag == "forward" || direction_tag == "both" {
        Direction::StartToStop
    } else {
        Direction::StopToStart
    }
}

fn sncf_extensions(node: &Node) -> SignalSncfExtension {
    let label = node
        .tags
        .get("ref")
        .map(|r| r.as_str())
        .unwrap_or_default()
        .into();
    let side = node
        .tags
        .get("railway:signal:position")
        .map(|s| {
            if s == "left" {
                Side::Left
            } else if s == "right" {
                Side::Right
            } else {
                Side::Center
            }
        })
        .unwrap_or_default();
    SignalSncfExtension {
        label,
        side,
        ..Default::default()
    }
}
