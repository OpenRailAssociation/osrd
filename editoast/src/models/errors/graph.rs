use std::collections::{HashMap, HashSet};

use crate::infra_cache::InfraCache;
use crate::railjson::TrackEndpoint;

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

        for (_link_id, link) in infra_cache.track_section_links.iter() {
            match link.navigability {
                crate::railjson::ApplicableDirections::StartToStop => {
                    graph.link(&link.src, &link.dst);
                }
                crate::railjson::ApplicableDirections::StopToStart => {
                    graph.link(&link.dst, &link.src);
                }
                crate::railjson::ApplicableDirections::Both => {
                    graph.link(&link.src, &link.dst);
                    graph.link(&link.dst, &link.src);
                }
            }
        }

        for (_switch_id, switch) in infra_cache.switches.iter() {
            if let Some(switch_type) = infra_cache.switch_types.get(&switch.switch_type) {
                for (_, group) in switch_type.groups.iter() {
                    for connection in group {
                        if let Some(src) = switch.ports.get(&connection.src) {
                            if let Some(dst) = switch.ports.get(&connection.dst) {
                                graph.link(src, dst);
                                if connection.bidirectional {
                                    graph.link(dst, src);
                                }
                            }
                        }
                    }
                }
            }
        }

        graph
    }

    /// Retrieve the neighbours of a trackendpoint.
    /// This function returns `None` when:
    /// - the trackendpoint is not part of the graph
    /// - the trackendpoint doesn't exist
    pub fn get_neighbours(
        &'a self,
        track_endpoint: &'a TrackEndpoint,
    ) -> Option<&'a HashSet<&TrackEndpoint>> {
        self.links.get(&track_endpoint)
    }
}
