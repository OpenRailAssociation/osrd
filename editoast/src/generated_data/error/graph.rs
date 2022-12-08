use std::collections::{HashMap, HashSet};

use crate::infra_cache::InfraCache;
use crate::schema::TrackEndpoint;

#[derive(Default, Clone, Debug)]
pub struct Graph<'a> {
    links: HashMap<&'a TrackEndpoint, HashSet<&'a TrackEndpoint>>,
}

impl<'a> Graph<'a> {
    /// Add a new link to the graph given two `TrackEndpoint`.
    fn link(&mut self, src: &'a TrackEndpoint, dst: &'a TrackEndpoint) {
        self.links.entry(src).or_default().insert(dst);
    }

    /// Create a graph from an `InfraCache`.
    pub fn load(infra_cache: &'a InfraCache) -> Self {
        let mut graph = Self::default();

        for link in infra_cache.track_section_links().values() {
            let link = link.unwrap_track_section_link();
            graph.link(&link.src, &link.dst);
            graph.link(&link.dst, &link.src);
        }

        for switch in infra_cache.switches().values() {
            let switch = switch.unwrap_switch();
            let switch_type = infra_cache
                .switch_types()
                .get(&switch.switch_type)
                .unwrap()
                .unwrap_switch_type();
            for group in switch_type.groups.values() {
                for connection in group {
                    let src = switch.ports.get::<String>(&connection.src).unwrap();
                    let dst = switch.ports.get::<String>(&connection.dst).unwrap();
                    graph.link(src, dst);
                    graph.link(dst, src);
                }
            }
        }

        graph
    }

    /// Retrieve the neighbours of a trackendpoint.
    /// This function returns `None` when:
    /// - the trackendpoint has no neighbours
    /// - the trackendpoint doesn't exist
    pub fn get_neighbours(
        &'a self,
        track_endpoint: &'a TrackEndpoint,
    ) -> Option<&'a HashSet<&TrackEndpoint>> {
        self.links.get(&track_endpoint)
    }
}

#[cfg(test)]
mod tests {
    use std::collections::{HashMap, HashSet};

    use crate::infra_cache::{
        tests::{create_small_infra_cache, create_track_endpoint},
        InfraCache,
    };
    use crate::schema::Endpoint;

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

        let res = HashMap::from([
            (&track_a_end, HashSet::from([&track_b_begin])),
            (&track_b_begin, HashSet::from([&track_a_end])),
            (
                &track_b_end,
                HashSet::from([&track_c_begin, &track_d_begin]),
            ),
            (&track_c_begin, HashSet::from([&track_b_end])),
            (&track_d_begin, HashSet::from([&track_b_end])),
        ]);

        for track in 'A'..='D' {
            for endpoint in [Endpoint::Begin, Endpoint::End] {
                let track_endpoint = create_track_endpoint(endpoint, track.to_string());
                let branch = graph.get_neighbours(&track_endpoint);
                let expected_branch = res.get(&track_endpoint);
                assert_eq!(expected_branch, branch);
            }
        }
    }
}
