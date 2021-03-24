package fr.sncf.osrd.infra.routegraph;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
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
            return getNode(route.tvdSectionsPath.get(0).startNode).stopToStartRoutes;
        return getNode(route.tvdSectionsPath.get(route.tvdSectionsPath.size() - 1).endNode).startToStopRoutes;
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
                Route.TransitType transitType,
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

            // Create route
            var route = new Route(
                    id,
                    routeGraph,
                    length,
                    transitType,
                    tvdSectionsPath,
                    tvdSectionsPathDirection,
                    switchesPosition
            );

            routeGraph.routeMap.put(id, route);

            // Link route to the starting waypoint
            var startWaypoint = waypointGraph.getNode(tvdSectionsPath.get(0).startNode);
            var firstTVDSectionPath = tvdSectionsPath.get(0);
            var waypointDirection = firstTVDSectionPath.startNodeDirection;
            if (tvdSectionsPathDirection.get(0) == EdgeDirection.STOP_TO_START)
                waypointDirection = firstTVDSectionPath.endNodeDirection;
            startWaypoint.getRouteNeighbors(waypointDirection).add(route);

            // Link route to track sections and tvd sections
            for (var tvdSectionPath : route.tvdSectionsPath) {
                tvdSectionPath.tvdSection.routes.add(route);
                for (var trackSection : tvdSectionPath.trackSections)
                    trackSection.edge.routes.add(route);
            }

            return route;
        }

        public RouteGraph build() {
            return routeGraph;
        }
    }
}
