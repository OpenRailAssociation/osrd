package fr.sncf.osrd.infra.routegraph;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.graph.BiNGraph;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.waypointgraph.WaypointGraph;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class RouteGraph extends BiNGraph<Route, Waypoint> {
    public final HashMap<String, Route> routeMap = new HashMap<>();

    @Override
    public List<Route> getNeighborRels(Route route, EdgeEndpoint endpoint) {
        if (endpoint == EdgeEndpoint.BEGIN)
            return getNode(route.tvdSectionsPaths.get(0).startNode).stopToStartRoutes;
        return getNode(route.tvdSectionsPaths.get(route.tvdSectionsPaths.size() - 1).endNode).startToStopRoutes;
    }

    public static class Builder {
        public RouteGraph routeGraph = new RouteGraph();
        public final WaypointGraph waypointGraph;

        /**
         * A helper to help build RouteGraph instances.
         */
        public Builder(WaypointGraph waypointGraph) {
            this.waypointGraph = waypointGraph;
            // Register nodes from the waypoint graph
            for (var node : waypointGraph.iterNodes())
                routeGraph.registerNode(node);
        }

        /** Add a route to the Route Graph */
        public Route makeRoute(
                String id,
                List<Waypoint> waypoints,
                SortedArraySet<TVDSection> tvdSections,
                List<SortedArraySet<TVDSection>> releaseGroups,
                HashMap<Switch, SwitchPosition> switchesPosition
        ) throws InvalidInfraException {
            if (waypoints.size() < 2) {
                throw new InvalidInfraException(String.format("Route '%s' doesn't contains enough waypoints", id));
            }
            var length = 0;
            var tvdSectionsPath = new ArrayList<TVDSectionPath>();
            var tvdSectionsPathDirection = new ArrayList<EdgeDirection>();

            // Find the list of tvd section path
            for (var i = 1; i < waypoints.size(); i++) {
                var startIndex = waypoints.get(i - 1).index;
                var endIndex = waypoints.get(i).index;
                var tvdSectionPath = waypointGraph.getTVDSectionPath(startIndex, endIndex);

                if (tvdSectionPath == null)
                    throw new InvalidInfraException(String.format(
                            "Route: '%s' couldn't find tvd section path: (%d, %d)", id, startIndex, endIndex));
                if (!tvdSections.contains(tvdSectionPath.tvdSection))
                    throw new InvalidInfraException(
                            String.format("Route '%s' has a tvd section path outside tvd section", id));

                if (tvdSectionPath.startNode == startIndex)
                    tvdSectionsPathDirection.add(EdgeDirection.START_TO_STOP);
                else
                    tvdSectionsPathDirection.add(EdgeDirection.STOP_TO_START);

                tvdSectionsPath.add(tvdSectionPath);
                length += tvdSectionPath.length;
            }

            // Checks that the release groups are consistent and complete
            var copiedTvdSections = new SortedArraySet<TVDSection>();
            for (var releaseGroup : releaseGroups) {
                for (var tvdSection : releaseGroup) {
                    if (!tvdSections.contains(tvdSection))
                        throw new InvalidInfraException(String.format(
                                "Route '%s' has a release group that doesn't match route's tvd sections", id));
                    copiedTvdSections.add(tvdSection);
                }
            }
            if (copiedTvdSections.size() != tvdSections.size())
                throw new InvalidInfraException(String.format(
                        "Route '%s' has a tvd section that is not part of any of its release groups", id));

            // Create route
            var route = new Route(
                    id,
                    routeGraph,
                    length,
                    releaseGroups,
                    tvdSectionsPath,
                    tvdSectionsPathDirection,
                    switchesPosition
            );

            routeGraph.routeMap.put(id, route);

            // Link route to the starting waypoint
            var startWaypoint = waypointGraph.getNode(tvdSectionsPath.get(0).startNode);
            var firstTVDSectionPath = tvdSectionsPath.get(0);
            var waypointDirection = firstTVDSectionPath.nodeDirection(tvdSectionsPathDirection.get(0), EdgeEndpoint.BEGIN);
            startWaypoint.getRouteNeighbors(waypointDirection).add(route);

            // Link route to track sections and tvd sections
            double routeOffset = 0;
            for (int i = 0; i < route.tvdSectionsPaths.size(); i++) {
                var tvdSectionPath = route.tvdSectionsPaths.get(i);
                var tvdSectionPathDir = route.tvdSectionsPathDirections.get(i);
                tvdSectionPath.tvdSection.routeSubscribers.add(route);
                for (var trackSectionRange : tvdSectionPath.getTrackSections(tvdSectionPathDir)) {
                    var trackSection = trackSectionRange.edge;
                    var trackBegin = Math.min(trackSectionRange.getBeginPosition(), trackSectionRange.getEndPosition());
                    var trackEnd = Math.max(trackSectionRange.getBeginPosition(), trackSectionRange.getEndPosition());
                    var routeFragment = new TrackSection.RouteFragment(route, routeOffset, trackBegin, trackEnd, trackSectionRange.direction);
                    trackSection.getRoutes(trackSectionRange.direction).insert(routeFragment);
                    routeOffset += trackSectionRange.length();
                }
            }
            return route;
        }

        public RouteGraph build() {
            return routeGraph;
        }
    }
}
