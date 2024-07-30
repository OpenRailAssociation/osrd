use crate::infra_cache::Cache;
use crate::infra_cache::ObjectCache;
use editoast_schemas::infra::Route;

impl Cache for Route {
    fn get_track_referenced_id(&self) -> Vec<&String> {
        // We don't have a layer linked to this object yet.
        // So we don't need to keep track of the referenced tracks.
        vec![]
    }

    fn get_object_cache(&self) -> ObjectCache {
        ObjectCache::Route(self.clone())
    }
}

#[cfg(test)]
mod test {

    use crate::infra_cache::tests::create_small_infra_cache;
    use crate::infra_cache::Graph;

    #[test]
    fn test_compute_track_ranges_1() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);
        let r1 = infra_cache.routes().get("R1").unwrap().unwrap_route();
        let path = infra_cache
            .compute_track_ranges_on_route(r1, &graph)
            .unwrap();
        assert_eq!(path.track_ranges.len(), 2);
        assert_eq!(path.track_ranges[0].track, "A".into());
        assert_eq!(path.track_ranges[0].begin, 20.);
        assert_eq!(path.track_ranges[0].end, 500.);
        assert_eq!(path.track_ranges[1].track, "B".into());
        assert_eq!(path.track_ranges[1].begin, 0.);
        assert_eq!(path.track_ranges[1].end, 250.);
        assert_eq!(path.track_nodes_directions.len(), 1);
        assert!(path
            .track_nodes_directions
            .iter()
            .any(|(k, _)| k == &"link".into()));
    }

    #[test]
    fn test_compute_track_ranges_2() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);
        let r1 = infra_cache.routes().get("R2").unwrap().unwrap_route();
        let path = infra_cache
            .compute_track_ranges_on_route(r1, &graph)
            .unwrap();
        assert_eq!(path.track_ranges.len(), 2);
        assert_eq!(path.track_ranges[0].track, "B".into());
        assert_eq!(path.track_ranges[0].begin, 250.);
        assert_eq!(path.track_ranges[0].end, 500.);
        assert_eq!(path.track_ranges[1].track, "C".into());
        assert_eq!(path.track_ranges[1].begin, 0.);
        assert_eq!(path.track_ranges[1].end, 480.);
        assert_eq!(path.track_nodes_directions.len(), 1);
        assert!(path
            .track_nodes_directions
            .iter()
            .any(|(k, _)| k == &"track_node".into()));
    }
}
