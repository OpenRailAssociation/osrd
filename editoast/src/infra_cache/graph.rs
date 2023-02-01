use std::collections::HashMap;

use crate::infra_cache::InfraCache;
use crate::schema::utils::Identifier;
use crate::schema::{SwitchCache, TrackEndpoint};

#[derive(Default, Clone, Debug)]
pub struct Graph<'a> {
    /// The graph of links between `TrackEndpoint`.
    /// The first key is the source `TrackEndpoint`.
    /// The second key is the group of the link.
    ///   If its a simple track section link then the group is `None`.
    ///   If its a switch then the group is the group of the switch.
    links: HashMap<&'a TrackEndpoint, HashMap<Option<&'a Identifier>, &'a TrackEndpoint>>,
    switches: HashMap<&'a TrackEndpoint, &'a SwitchCache>,
}

impl<'a> Graph<'a> {
    /// Add a new link to the graph given two `TrackEndpoint`.
    fn link(
        &mut self,
        group: Option<&'a Identifier>,
        src: &'a TrackEndpoint,
        dst: &'a TrackEndpoint,
    ) {
        self.links.entry(src).or_default().insert(group, dst);
    }

    /// Create a graph from an `InfraCache`.
    pub fn load(infra_cache: &'a InfraCache) -> Self {
        let mut graph = Self::default();

        for switch in infra_cache.switches().values() {
            let switch = switch.unwrap_switch();
            let switch_type = infra_cache
                .switch_types()
                .get(&switch.switch_type)
                .unwrap()
                .unwrap_switch_type();
            for (group, connections) in switch_type.groups.iter() {
                for connection in connections {
                    let src = switch.ports.get::<String>(&connection.src).unwrap();
                    let dst = switch.ports.get::<String>(&connection.dst).unwrap();
                    graph.link(Some(group), src, dst);
                    graph.link(Some(group), dst, src);
                    graph.switches.insert(src, switch);
                    graph.switches.insert(dst, switch);
                }
            }
        }

        for link in infra_cache.track_section_links().values() {
            let link = link.unwrap_track_section_link();
            if !graph.links.contains_key(&link.src) && !graph.links.contains_key(&link.dst) {
                graph.link(None, &link.src, &link.dst);
                graph.link(None, &link.dst, &link.src);
            }
        }

        graph
    }

    /// Check if a track endpoint has neighbours.
    pub fn has_neighbour(&'a self, track_endpoint: &TrackEndpoint) -> bool {
        self.links.get(&track_endpoint).is_some()
    }

    /// Return the switch linked to the given endpoint.
    pub fn get_switch(&'a self, track_endpoint: &TrackEndpoint) -> Option<&'a SwitchCache> {
        self.switches.get(&track_endpoint).copied()
    }

    /// Given an endpoint and a group retrieve the neighbour endpoint.
    /// If group is `None` then the searched neighbour endpoint is the one linked by a simple track section link.
    pub fn get_neighbour(
        &'a self,
        track_endpoint: &TrackEndpoint,
        group: Option<&Identifier>,
    ) -> Option<&'a TrackEndpoint> {
        self.links
            .get(&track_endpoint)
            .and_then(|groups| groups.get(&group).copied())
    }

    /// Given an endpoint return a list of groups.
    /// If the endpoint has no neightbours return an empty `Vec`.
    /// If the endpoint has as simple track section link return a `Vec` with a single `None` element.
    /// Otherwise returns a `Vec` with all the switch groups.
    pub fn get_neighbour_groups(
        &'a self,
        track_endpoint: &'a TrackEndpoint,
    ) -> Vec<Option<&'a Identifier>> {
        self.links
            .get(&track_endpoint)
            .map(|groups| groups.keys().map(|g| g.as_deref()).collect())
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::schema::Endpoint;
    use crate::{
        infra_cache::{
            tests::{create_small_infra_cache, create_track_endpoint},
            InfraCache,
        },
        schema::utils::Identifier,
    };

    use super::Graph;

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

        let left: Identifier = "LEFT".into();
        let right: Identifier = "RIGHT".into();

        let res = HashMap::from([
            ((&track_a_end, None), &track_b_begin),
            ((&track_b_begin, None), &track_a_end),
            ((&track_b_end, Some(&left)), &track_c_begin),
            ((&track_b_end, Some(&right)), &track_d_begin),
            ((&track_c_begin, Some(&left)), &track_b_end),
            ((&track_d_begin, Some(&right)), &track_b_end),
        ]);

        for track in 'A'..='D' {
            for endpoint in [Endpoint::Begin, Endpoint::End] {
                for group in [None, Some(&left), Some(&right)] {
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
        assert!(graph.get_switch(&track_a_end).is_none());
    }

    #[test]
    fn get_neighbour_groups() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);

        let track_b_end = create_track_endpoint(Endpoint::End, "B");
        let groups = graph.get_neighbour_groups(&track_b_end);
        assert_eq!(groups.len(), 2);
        assert!(groups.contains(&Some(&"LEFT".into())));
        assert!(groups.contains(&Some(&"RIGHT".into())));

        let track_a_begin = create_track_endpoint(Endpoint::Begin, "A");
        let groups = graph.get_neighbour_groups(&track_a_begin);
        assert_eq!(groups.len(), 0);

        let track_a_end = create_track_endpoint(Endpoint::End, "A");
        let groups = graph.get_neighbour_groups(&track_a_end);
        assert_eq!(groups.len(), 1);
        assert!(groups.contains(&None));
    }
}
