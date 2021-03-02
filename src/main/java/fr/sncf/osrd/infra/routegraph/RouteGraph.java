package fr.sncf.osrd.infra.routegraph;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.graph.BiNGraph;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import fr.sncf.osrd.infra.waypointgraph.WaypointGraph;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class RouteGraph extends BiNGraph<Route, Waypoint> {

    @Override
    public List<Route> getNeighborRels(Route route, EdgeEndpoint endpoint) {
        if (endpoint == EdgeEndpoint.BEGIN)
            return getNode(route.tvdSectionPaths.get(0).startNode).stopToStartRoutes;
        return getNode(route.tvdSectionPaths.get(route.tvdSectionPaths.size() - 1).endNode).startToStopRoutes;
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
        public Route makeRoute(String id, List<Waypoint> waypoints, SortedArraySet<TVDSection> tvdSections)
                throws InvalidInfraException {
            if (waypoints.size() < 2) {
                throw new InvalidInfraException(String.format("Route '%s' doesn't contains enough waypoints", id));
            }
            var length = 0;
            var tvdSectionsPath = new ArrayList<TVDSectionPath>();

            // Find the list of tvd section path
            for (var i = 1; i < waypoints.size(); i++) {
                var startIndex = waypoints.get(i - 1).index;
                var endIndex = waypoints.get(i).index;
                var tvdSectionPath = waypointGraph.getTVDSectionPath(startIndex, endIndex);
                if (tvdSectionPath == null)
                    throw new InvalidInfraException(String.format(
                            "Route: '%s' couldn't find tvd section path: (%d, %d)", id, startIndex, endIndex));
                if (tvdSections.intersect(tvdSectionPath.tvdSections).isEmpty())
                    throw new InvalidInfraException(
                            String.format("Route '%s' has a tvd section path outside tvd section", id));
                tvdSectionsPath.add(tvdSectionPath);
                length += tvdSectionPath.length;
            }

            // Create route
            var route = new Route(id, routeGraph, length, tvdSectionsPath);

            // Add route to the waypoints start and end nodes
            var startWaypoint = waypointGraph.getNode(tvdSectionsPath.get(0).startNode);
            var endWaypoint = waypointGraph.getNode(tvdSectionsPath.get(tvdSectionsPath.size() - 1).endNode);
            startWaypoint.startToStopRoutes.add(route);
            endWaypoint.stopToStartRoutes.add(route);
            return route;
        }

        public RouteGraph build() {
            return routeGraph;
        }
    }
}
