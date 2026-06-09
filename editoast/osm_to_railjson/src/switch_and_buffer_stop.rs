use osm4routing::Edge;
use osm4routing::NodeId;
use schemas::infra::BufferStop;
use schemas::infra::Switch;
use schemas::infra::TrackEndpoint;
use std::collections::HashMap;

use tracing::debug;
use tracing::error;

use crate::utils::Branch;
use crate::utils::NodeAdjacencies;

pub(crate) fn switches_and_buffer_stops(
    adjacencies: &HashMap<osm4routing::NodeId, NodeAdjacencies<'_>>,
) -> (Vec<Switch>, Vec<BufferStop>) {
    let mut switches = Vec::new();
    let mut buffer_stops = Vec::new();
    for (node, adj) in adjacencies {
        let id = node.0;
        let edges_count = adj.edges.len();
        let branches_count = adj.branches.len();
        match (edges_count, branches_count) {
            (0, _) => error!("node {id} without edge"),
            (1, 0) => buffer_stops.push(edge_to_buffer(node, adj.edges[0], 0)),
            (2, 0) => {
                // This can happens when data is truncated (e.g. cropped to a region, or the output track is a service track)
                buffer_stops.push(edge_to_buffer(node, adj.edges[0], 0));
                buffer_stops.push(edge_to_buffer(node, adj.edges[1], 1));
            }
            (2, 1) => switches.push(link_switch(*node, &adj.branches)),
            (3, 2) => switches.push(point_switch(*node, &adj.branches)),
            (4, 2) => switches.push(cross_switch(*node, &adj.branches)),
            (4, 4) => switches.push(double_slip_switch(*node, &adj.branches)),
            _ => debug!("node {id} with {edges_count} edges and {branches_count} branches"),
        }
    }
    (switches, buffer_stops)
}

fn edge_to_buffer(node: &NodeId, edge: &Edge, count: i64) -> BufferStop {
    BufferStop {
        id: format!("buffer-{}-{count}", node.0).into(),
        track: edge.id.clone().into(),
        position: if &edge.source == node {
            0.
        } else {
            edge.length()
        },
        extensions: Default::default(),
    }
}

fn link_switch(node: NodeId, branches: &[Branch]) -> Switch {
    let mut ports = HashMap::new();
    ports.insert("A".into(), branches[0].0.clone());
    ports.insert("B".into(), branches[0].1.clone());
    Switch {
        id: node.0.to_string().into(),
        switch_type: "link".into(),
        ports,
        group_change_delay: 0.,
        ..Default::default()
    }
}

fn point_switch(node: NodeId, branches: &[Branch]) -> Switch {
    let mut endpoint_count = HashMap::<&TrackEndpoint, u64>::new();
    for (src, dst) in branches {
        *endpoint_count.entry(src).or_default() += 1;
        *endpoint_count.entry(dst).or_default() += 1;
    }

    let mut sorted_endpoint: Vec<(&TrackEndpoint, u64)> = endpoint_count.into_iter().collect();
    sorted_endpoint.sort_by(|(_, count_a), (_, count_b)| count_b.cmp(count_a));
    let mut ports = HashMap::new();
    ports.insert("A".into(), sorted_endpoint[0].0.clone());
    ports.insert("B1".into(), sorted_endpoint[1].0.clone());
    ports.insert("B2".into(), sorted_endpoint[2].0.clone());

    Switch {
        id: node.0.to_string().into(),
        switch_type: "point_switch".into(),
        ports,
        group_change_delay: 4.,
        ..Default::default()
    }
}

fn cross_switch(node: NodeId, branches: &[Branch]) -> Switch {
    let mut ports = HashMap::new();
    ports.insert("A1".into(), branches[0].0.clone());
    ports.insert("B1".into(), branches[0].1.clone());
    ports.insert("B2".into(), branches[1].0.clone());
    ports.insert("A2".into(), branches[1].1.clone());

    Switch {
        id: node.0.to_string().into(),
        switch_type: "crossing".into(),
        ports,
        group_change_delay: 4.,
        ..Default::default()
    }
}

fn different_branches(a: &Branch, b: &Branch) -> bool {
    a.0 != b.0 && a.0 != b.1 && a.1 != b.0 && a.1 != b.1
}

fn double_slip_switch(node: NodeId, branches: &[Branch]) -> Switch {
    let (north1, south1) = &branches[0];
    let (north2, south2) = branches
        .iter()
        .find(|t| different_branches(t, &branches[0]))
        .expect("Double slips must have two different branches");

    let mut ports = HashMap::new();
    ports.insert("A1".into(), north1.clone());
    ports.insert("B1".into(), south1.clone());
    ports.insert("A2".into(), north2.clone());
    ports.insert("B2".into(), south2.clone());

    Switch {
        id: node.0.to_string().into(),
        switch_type: "double_slip_switch".into(),
        ports,
        group_change_delay: 4.,
        ..Default::default()
    }
}
