use derivative::Derivative;
use editoast_derive::InfraModel;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

use super::{
    Direction, DirectionalTrackRange, Endpoint, Identifier, OSRDIdentified, OSRDTyped, ObjectType,
    TrackEndpoint, Waypoint,
};
use crate::{
    infra_cache::{Cache, Graph, InfraCache, ObjectCache},
    schemas,
};

schemas! {
    Route,
}

#[derive(Debug, Derivative, Clone, Deserialize, Serialize, PartialEq, Eq, InfraModel, ToSchema)]
#[serde(deny_unknown_fields)]
#[infra_model(table = "crate::tables::infra_object_route")]
#[derivative(Default)]
pub struct Route {
    pub id: Identifier,
    pub entry_point: Waypoint,
    #[derivative(Default(value = "Direction::StartToStop"))]
    pub entry_point_direction: Direction,
    pub exit_point: Waypoint,
    pub release_detectors: Vec<Identifier>,
    pub switches_directions: HashMap<Identifier, Identifier>,
}

impl OSRDTyped for Route {
    fn get_type() -> ObjectType {
        ObjectType::Route
    }
}

impl OSRDIdentified for Route {
    fn get_id(&self) -> &String {
        &self.id
    }
}

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

#[derive(Debug, Clone)]
pub struct RoutePath {
    pub track_ranges: Vec<DirectionalTrackRange>,
    pub switches_directions: HashMap<Identifier, Identifier>,
}

impl Route {
    /// Return the track and position of a waypoint
    fn get_waypoint_location<'a>(
        waypoint: &Waypoint,
        infra_cache: &'a InfraCache,
    ) -> Option<(&'a String, f64)> {
        if waypoint.is_detector() {
            let detector = infra_cache.detectors().get(waypoint.get_id())?;
            let detector = detector.unwrap_detector();
            Some((&detector.track, detector.position))
        } else {
            let bs = infra_cache.buffer_stops().get(waypoint.get_id())?;
            let bs = bs.unwrap_buffer_stop();
            Some((&bs.track, bs.position))
        }
    }

    /// Compute the track ranges through which the route passes.
    /// If the path cannot be computed (e.g. invalid topology), returns None.
    pub fn compute_track_ranges(
        &self,
        infra_cache: &InfraCache,
        graph: &Graph,
    ) -> Option<RoutePath> {
        // Check if entry and exit points are the same
        if self.entry_point == self.exit_point {
            return None;
        }

        let mut cur_dir = self.entry_point_direction;
        let (cur_track, mut cur_offset) =
            Self::get_waypoint_location(&self.entry_point, infra_cache)?;
        let (exit_track, exit_offset) = Self::get_waypoint_location(&self.exit_point, infra_cache)?;

        // Check that the track exists
        let mut cur_track = infra_cache
            .track_sections()
            .get(cur_track)?
            .unwrap_track_section();

        // Save track ranges and used switches
        let mut track_ranges = vec![];
        let mut used_switches = HashMap::new();

        // Check path validity
        loop {
            let cur_track_id = cur_track.get_id();

            // Add track range
            let end_offset = if cur_track_id == exit_track {
                exit_offset
            } else if cur_dir == Direction::StartToStop {
                cur_track.length
            } else {
                0.
            };
            track_ranges.push(DirectionalTrackRange {
                track: cur_track_id.clone().into(),
                begin: cur_offset.min(end_offset),
                end: cur_offset.max(end_offset),
                direction: cur_dir,
            });

            // Search for the exit_point
            if cur_track_id == exit_track {
                if (cur_dir == Direction::StartToStop && cur_offset > exit_offset)
                    || (cur_dir == Direction::StopToStart && cur_offset < exit_offset)
                {
                    return None;
                }
                break;
            }

            // Search for the next track section
            let endpoint = TrackEndpoint::from_track_and_direction(cur_track_id, cur_dir);
            // No neighbour found
            if !graph.has_neighbour(&endpoint) {
                return None;
            }
            let switch = graph.get_switch(&endpoint);
            let next_endpoint = match switch {
                None => graph.get_neighbour(&endpoint, None),
                Some(switch) => {
                    let switch_id = switch.get_id();
                    // Check we found the switch in the route
                    let group = self.switches_directions.get(&switch_id.clone().into())?;
                    used_switches.insert(switch_id.clone().into(), group.clone());
                    graph.get_neighbour(&endpoint, Some(group))
                }
            }?;

            // Update current track section, offset and direction
            cur_track = infra_cache
                .track_sections()
                .get(&next_endpoint.track.0)?
                .unwrap_track_section();
            (cur_dir, cur_offset) = match next_endpoint.endpoint {
                Endpoint::Begin => (Direction::StartToStop, 0.),
                Endpoint::End => (Direction::StopToStart, cur_track.length),
            };
        }
        Some(RoutePath {
            track_ranges,
            switches_directions: used_switches,
        })
    }
}

#[cfg(test)]
mod test {

    use super::Route;
    use crate::{
        infra_cache::{tests::create_small_infra_cache, Graph},
        models::infra::tests::test_infra_transaction,
    };
    use actix_web::test as actix_test;
    use diesel_async::scoped_futures::ScopedFutureExt;

    #[actix_test]
    async fn test_persist() {
        test_infra_transaction(|conn, infra| {
            async move {
                let data = (0..10).map(|_| Route::default()).collect::<Vec<Route>>();

                assert!(Route::persist_batch(&data, infra.id.unwrap(), conn)
                    .await
                    .is_ok());
            }
            .scope_boxed()
        })
        .await;
    }

    #[test]
    fn test_compute_track_ranges_1() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);
        let r1 = infra_cache.routes().get("R1").unwrap().unwrap_route();
        let path = Route::compute_track_ranges(r1, &infra_cache, &graph).unwrap();
        assert_eq!(path.track_ranges.len(), 2);
        assert_eq!(path.track_ranges[0].track, "A".into());
        assert_eq!(path.track_ranges[0].begin, 20.);
        assert_eq!(path.track_ranges[0].end, 500.);
        assert_eq!(path.track_ranges[1].track, "B".into());
        assert_eq!(path.track_ranges[1].begin, 0.);
        assert_eq!(path.track_ranges[1].end, 250.);
        assert_eq!(path.switches_directions.len(), 0);
    }

    #[test]
    fn test_compute_track_ranges_2() {
        let infra_cache = create_small_infra_cache();
        let graph = Graph::load(&infra_cache);
        let r1 = infra_cache.routes().get("R2").unwrap().unwrap_route();
        let path = Route::compute_track_ranges(r1, &infra_cache, &graph).unwrap();
        assert_eq!(path.track_ranges.len(), 2);
        assert_eq!(path.track_ranges[0].track, "B".into());
        assert_eq!(path.track_ranges[0].begin, 250.);
        assert_eq!(path.track_ranges[0].end, 500.);
        assert_eq!(path.track_ranges[1].track, "C".into());
        assert_eq!(path.track_ranges[1].begin, 0.);
        assert_eq!(path.track_ranges[1].end, 480.);
        assert_eq!(path.switches_directions.len(), 1);
        assert!(path.switches_directions.contains_key(&"switch".into()));
    }
}
