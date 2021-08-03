package fr.sncf.osrd.infra.routegraph;

import static fr.sncf.osrd.utils.graph.EdgeDirection.START_TO_STOP;
import static fr.sncf.osrd.utils.graph.EdgeDirection.STOP_TO_START;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.infra.waypointgraph.TVDSectionPath;
import fr.sncf.osrd.infra.waypointgraph.WaypointGraph;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.graph.DirNGraph;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;

import java.util.*;
import java.util.stream.Collectors;

public class RouteGraph extends DirNGraph<Route, Waypoint> {
    public final HashMap<String, Route> routeMap = new HashMap<>();

    @Override
    public List<Route> getNeighbors(Route route) {
        var lastTvdSectionPathIndex = route.tvdSectionsPaths.size() - 1;
        var lastTvdSectionPath = route.tvdSectionsPaths.get(lastTvdSectionPathIndex);
        var lastTvdSectionPathDir = route.tvdSectionsPathDirections.get(lastTvdSectionPathIndex);
        var node = getNode(lastTvdSectionPath.getEndNode(lastTvdSectionPathDir));
        var nodeDirection = lastTvdSectionPath.nodeDirection(lastTvdSectionPathDir, EdgeEndpoint.END);
        return node.getRouteNeighbors(nodeDirection);
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

        /**
         * Add a route to the Route Graph
         */
        public Route makeRoute(
                String id,
                SortedArraySet<TVDSection> tvdSections,
                List<SortedArraySet<TVDSection>> releaseGroups,
                HashMap<Switch, SwitchPosition> switchesPosition,
                Waypoint entryPoint,
                Signal entrySignalNormal,
                Signal entrySignalReverse
        ) throws InvalidInfraException {
            var length = 0;
            var tvdSectionsPath = new ArrayList<TVDSectionPath>();
            var tvdSectionsPathDirection = new ArrayList<EdgeDirection>();

            var waypoints = generateWaypointList(entryPoint, tvdSections, switchesPosition);

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
                    tvdSectionsPathDirection.add(START_TO_STOP);
                else
                    tvdSectionsPathDirection.add(STOP_TO_START);

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

            // Get start waypoint and start direction
            var firstTVDSectionPath = tvdSectionsPath.get(0);
            var firstTVDSectionPathDir = tvdSectionsPathDirection.get(0);
            var startWaypoint = waypointGraph.getNode(firstTVDSectionPath.getStartNode(firstTVDSectionPathDir));
            var waypointDirection = firstTVDSectionPath.nodeDirection(firstTVDSectionPathDir, EdgeEndpoint.BEGIN);

            // Create route
            var entrySignal = waypointDirection == START_TO_STOP ? entrySignalNormal : entrySignalReverse;

            var route = new Route(
                    id,
                    routeGraph,
                    length,
                    releaseGroups,
                    tvdSectionsPath,
                    tvdSectionsPathDirection,
                    switchesPosition,
                    entrySignal);

            routeGraph.routeMap.put(id, route);

            // Link route to the starting waypoint
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
                    var routeFragment = new TrackSection.RouteFragment(
                            route, routeOffset, trackBegin, trackEnd, trackSectionRange.direction);
                    trackSection.getRoutes(trackSectionRange.direction).insert(routeFragment);
                    routeOffset += trackSectionRange.length();
                }
            }
            return route;
        }

        public RouteGraph build() {
            return routeGraph;
        }

        private TrackSectionRange findInitialRange(Waypoint startPoint, Set<TVDSection> sections) throws InvalidInfraException {
            for (var edgeDirection : EdgeDirection.values()) {
                for (var path : startPoint.getTvdSectionPathNeighbors(edgeDirection)) {
                    if (sections.contains(path.tvdSection)) {
                        var direction = path.startNode == startPoint.index ? START_TO_STOP : STOP_TO_START;
                        return path.getTrackSections(direction)[0];
                    }
                }
            }
            throw new InvalidInfraException("TODO");
        }

        private TrackSection nextTrackSection(TrackSection edge,
                                              EdgeDirection direction,
                                              Map<Integer, Switch> switches,
                                              Map<Switch, SwitchPosition> positions) throws InvalidInfraException {
            var endWaypoint = direction == START_TO_STOP ? edge.endNode : edge.startNode;
            var neighbors = direction == START_TO_STOP ? edge.endNeighbors : edge.startNeighbors;
            if (neighbors.size() == 1) {
                return neighbors.get(0);
            } else {
                if (!switches.containsKey(endWaypoint))
                    return null;
                var s = switches.get(endWaypoint);
                var position = positions.get(s);
                switch (position) {
                    case LEFT:
                        return s.leftTrackSection;
                    case RIGHT:
                        return s.rightTrackSection;
                    case MOVING:
                        throw new InvalidInfraException("TODO");
                }
            }
            throw new InvalidInfraException("TODO");
        }

        /**
         * Generates a list of waypoints present on the route in the right order
         */
        private List<Waypoint> generateWaypointList(
                Waypoint startPoint,
                Set<TVDSection> tvdSections,
                HashMap<Switch, SwitchPosition> switchesPosition
        ) throws InvalidInfraException {
            var allWaypointIndexes = generateWaypointListIndexes(startPoint, tvdSections, switchesPosition);
            var res = allWaypointIndexes.stream()
                    .map(waypointGraph::getNode)
                    .collect(Collectors.toList());

            assert allWaypointIndexes.get(0) == startPoint.index;
            assert res.size() > 1;

            return res;
        }

        /** Add the waypoints on the edge to res, in the right order.
         * Only waypoints in validWaypoints (the ones on the right tvd sections) are added */
        private static void addWaypoints(TrackSection edge,
                                            EdgeDirection direction,
                                            List<Integer> res,
                                            Set<Integer> validWaypoints) {
            if (direction == START_TO_STOP) {
                for (var p : edge.waypoints) {
                    var index = p.value.index;
                    if (validWaypoints.contains(index) && !res.contains(index))
                        res.add(p.value.index);
                }
            } else {
                for (var i = edge.waypoints.size() - 1; i >= 0; i--) {
                    var index = edge.waypoints.get(i).value.index;
                    if (validWaypoints.contains(index) && !res.contains(index))
                        res.add(edge.waypoints.get(i).value.index);
                }
            }
        }

        private List<Integer> generateWaypointListIndexes(
                Waypoint startPoint,
                Set<TVDSection> tvdSections,
                HashMap<Switch, SwitchPosition> switchesPosition
        ) throws InvalidInfraException {

            // Init the maps and lists
            var switchesMap = new HashMap<Integer, Switch>();
            var res = new ArrayList<Integer>();
            var waypointsOnTVDSections = new HashSet<Integer>();
            for (var section : tvdSections)
                for (var waypoint : section.waypoints)
                    waypointsOnTVDSections.add(waypoint.index);
            if (switchesPosition != null)
                for (var s : switchesPosition.keySet())
                    switchesMap.put(s.index, s);

            // Finds the first track section
            var initialRange = findInitialRange(startPoint, tvdSections);
            var direction = initialRange.direction;
            var edge = initialRange.edge;

            var seenWaypoints = new SortedArraySet<Integer>();

            while (true) {
                addWaypoints(edge, direction, res, waypointsOnTVDSections);
                var previousEndPoint = direction == START_TO_STOP ? edge.endNode : edge.startNode;

                if (seenWaypoints.contains(previousEndPoint))
                    return res;
                seenWaypoints.add(previousEndPoint);

                edge = nextTrackSection(edge, direction, switchesMap, switchesPosition);
                if (edge == null)
                    return res;
                direction = edge.startNode == previousEndPoint ? START_TO_STOP : STOP_TO_START;
            }
        }
    }
}
