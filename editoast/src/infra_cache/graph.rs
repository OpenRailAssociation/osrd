use std::collections::HashMap;

use crate::infra_cache::object_cache::SwitchCache;
use crate::infra_cache::InfraCache;
use editoast_schemas::infra::TrackEndpoint;
use editoast_schemas::primitives::Identifier;

#[derive(Default, Clone, Debug)]
pub struct Graph<'a> {
    /// The graph of links between `TrackEndpoint`.
    /// The first key is the source `TrackEndpoint`.
    /// The second key is the group of the link.
    /// The group is the group of the switch.
    links: HashMap<&'a TrackEndpoint, HashMap<&'a Identifier, &'a TrackEndpoint>>,
    switches: HashMap<&'a TrackEndpoint, &'a SwitchCache>,
}

impl<'a> Graph<'a> {
    /// Add a new link to the graph given two `TrackEndpoint`.
    fn link(&mut self, group: &'a Identifier, src: &'a TrackEndpoint, dst: &'a TrackEndpoint) {
        self.links.entry(src).or_default().insert(group, dst);
    }

    /// Create a graph from an `InfraCache`.
    pub fn load(infra_cache: &'a InfraCache) -> Self {
        let mut graph = Self::default();

        for switch in infra_cache.switches().values() {
            let switch = switch.unwrap_switch();
            let switch_type = match infra_cache.switch_types().get(&switch.switch_type) {
                Some(switch_type) => switch_type.unwrap_switch_type(),
                None => continue,
            };
            for (group, connections) in switch_type.groups.iter() {
                for connection in connections {
                    let Some(src) = switch.ports.get::<String>(&connection.src) else {
                        continue;
                    };
                    let Some(dst) = switch.ports.get::<String>(&connection.dst) else {
                        continue;
                    };
                    graph.link(group, src, dst);
                    graph.link(group, dst, src);
                    graph.switches.insert(src, switch);
                    graph.switches.insert(dst, switch);
                }
            }
        }
        graph
    }

    /// Check if a track endpoint has neighbours.
    pub fn has_neighbour(&'a self, track_endpoint: &TrackEndpoint) -> bool {
        self.links.contains_key(&track_endpoint)
    }

    /// Return the switch linked to the given endpoint.
    pub fn get_switch(&'a self, track_endpoint: &TrackEndpoint) -> Option<&'a SwitchCache> {
        self.switches.get(&track_endpoint).copied()
    }

    /// Given an endpoint and a group retrieve the neighbour endpoint.
    pub fn get_neighbour(
        &'a self,
        track_endpoint: &TrackEndpoint,
        group: &Identifier,
    ) -> Option<&'a TrackEndpoint> {
        self.links
            .get(&track_endpoint)
            .and_then(|groups| groups.get(&group).copied())
    }

    /// Given an endpoint return a list of groups.
    /// If the endpoint has no neightbours return an empty `Vec`.
    /// Otherwise returns a `Vec` with all the switch groups.
    pub fn get_neighbour_groups(
        &'a self,
        track_endpoint: &'a TrackEndpoint,
    ) -> Vec<&'a Identifier> {
        self.links
            .get(&track_endpoint)
            .map(|groups| groups.keys().cloned().collect())
            .unwrap_or_default()
    }

    /// Given an endpoint return all its neighbours indiscriminately
    /// of their group.
    pub fn get_all_neighbours(&'a self, track_endpoint: &TrackEndpoint) -> Vec<&'a TrackEndpoint> {
        let groups = self.links.get(track_endpoint);
        if let Some(groups) = groups {
            groups.values().copied().collect::<Vec<_>>()
        } else {
            Vec::new()
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::Graph;
    use crate::infra_cache::tests::create_small_infra_cache;
    use crate::infra_cache::tests::create_track_endpoint;
    use crate::infra_cache::InfraCache;
    use editoast_schemas::infra::Endpoint;
    use editoast_schemas::primitives::Identifier;

    #[test]
    fn create_empty_graph() {
        let empty_infra_cache = InfraCache::default();
        let empty_graph = Graph::load(&empty_infra_cache);
        assert!(empty_graph.links.is_empty());
    }

    #[test]
    fn create_small_graph() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);

        let track_a_end = create_track_endpoint(Endpoint::End, "A");
        let track_b_begin = create_track_endpoint(Endpoint::Begin, "B");
        let track_b_end = create_track_endpoint(Endpoint::End, "B");
        let track_c_begin = create_track_endpoint(Endpoint::Begin, "C");
        let track_d_begin = create_track_endpoint(Endpoint::Begin, "D");

        let link: Identifier = "LINK".into();
        let left: Identifier = "A_B1".into();
        let right: Identifier = "A_B2".into();

        let res = HashMap::from([
            ((&track_a_end, &link), &track_b_begin),
            ((&track_b_begin, &link), &track_a_end),
            ((&track_b_end, &left), &track_c_begin),
            ((&track_b_end, &right), &track_d_begin),
            ((&track_c_begin, &left), &track_b_end),
            ((&track_d_begin, &right), &track_b_end),
        ]);

        for track in 'A'..='D' {
            for endpoint in [Endpoint::Begin, Endpoint::End] {
                for group in [&link, &left, &right] {
                    let track_endpoint = create_track_endpoint(endpoint, track.to_string());
                    let branch = graph.get_neighbour(&track_endpoint, group);
                    let expected_branch = res.get(&(&track_endpoint, group)).cloned();
                    assert_eq!(expected_branch, branch);
                }
            }
        }
    }

    #[test]
    fn get_switch() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);

        let track_b_end = create_track_endpoint(Endpoint::End, "B");
        let switch = graph.get_switch(&track_b_end).unwrap();
        assert_eq!(switch.obj_id, "switch".to_string());

        let track_a_begin = create_track_endpoint(Endpoint::Begin, "A");
        assert!(graph.get_switch(&track_a_begin).is_none());

        let track_a_end = create_track_endpoint(Endpoint::End, "A");
        let link = graph.get_switch(&track_a_end).unwrap();
        assert_eq!(link.obj_id, "link".to_string());
    }

    #[test]
    fn get_neighbour_groups() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);

        let track_b_end = create_track_endpoint(Endpoint::End, "B");
        let groups = graph.get_neighbour_groups(&track_b_end);
        assert_eq!(groups.len(), 2);
        assert!(groups.contains(&&"A_B1".into()));
        assert!(groups.contains(&&"A_B2".into()));

        let track_a_begin = create_track_endpoint(Endpoint::Begin, "A");
        let groups = graph.get_neighbour_groups(&track_a_begin);
        assert_eq!(groups.len(), 0);

        let track_a_end = create_track_endpoint(Endpoint::End, "A");
        let groups = graph.get_neighbour_groups(&track_a_end);
        assert_eq!(groups.len(), 1);
        assert!(groups.contains(&&"LINK".into()));
    }
}
