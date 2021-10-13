package fr.sncf.osrd.infra.routegraph;

import static fr.sncf.osrd.utils.graph.EdgeDirection.START_TO_STOP;
import static fr.sncf.osrd.utils.graph.EdgeDirection.STOP_TO_START;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.*;
import fr.sncf.osrd.infra.TVDSectionPath;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.DirNGraph;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.*;

public class RouteGraph extends DirNGraph<Route, Waypoint> {
    public final HashMap<String, Route> routeMap = new HashMap<>();

    @Override
    public List<Route> getNeighbors(Route route) {
        var lastTvdSectionPath = route.tvdSectionsPaths.get(route.tvdSectionsPaths.size() - 1);
        var lastWaypoint = lastTvdSectionPath.endWaypoint;
        return lastWaypoint.getRouteNeighbors(lastTvdSectionPath.getEndTrackDirection());
    }

    public static class Builder {
        // result
        private final RouteGraph routeGraph = new RouteGraph();

        // internal state
        private final HashMap<Waypoint, TrackSectionLocation> waypointLocations = new HashMap<>();

        // parameters
        private final TrackGraph trackGraph;

        /**
         * A helper to help build RouteGraph instances.
         */
        public Builder(TrackGraph trackGraph, int nbWaypoints) {
            this.trackGraph = trackGraph;
            // Register nodes from the waypoints
            routeGraph.resizeNodes(nbWaypoints);
            for (var track : trackGraph.trackSectionMap.values()) {
                for (var waypoint : track.waypoints) {
                    routeGraph.registerNode(waypoint.value);
                    waypointLocations.put(waypoint.value, new TrackSectionLocation(track, waypoint.position));
                }
            }
        }

        /**
         * Add a route to the Route Graph
         */
        public Route makeRoute(
                String id,
                SortedArraySet<TVDSection> tvdSections,
                List<SortedArraySet<TVDSection>> releaseGroups,
                HashMap<Switch, String> switchesGroup,
                Waypoint entryPoint,
                Waypoint exitPoint,
                Signal entrySignal,
                EdgeDirection entryDirection
        ) throws InvalidInfraException {
            try {
                var tvdSectionsPath = generatePath(id, entryPoint, exitPoint, entryDirection, switchesGroup);

                var length = 0;
                for (var tvdSectionPath : tvdSectionsPath)
                    length += tvdSectionPath.length;

                // Checks the path goes through all TVDSections
                var pathTvdSections = new SortedArraySet<TVDSection>();
                for (var tvdSectionPath : tvdSectionsPath)
                    pathTvdSections.add(tvdSectionPath.tvdSection);
                if (pathTvdSections.size() != tvdSections.size())
                    throw new InvalidInfraException(
                            "Route has a tvd section that is not part of any of its release groups");

                // Get start waypoint and start direction
                var firstTVDSectionPath = tvdSectionsPath.get(0);
                var startWaypoint = firstTVDSectionPath.startWaypoint;
                var startWaypointDirection = firstTVDSectionPath.getStartTrackDirection();

                // Get end waypoint and end direction
                var lastTVDSectionPath = tvdSectionsPath.get(tvdSectionsPath.size() - 1);
                var endWaypoint = lastTVDSectionPath.endWaypoint;
                var endWaypointDirection = lastTVDSectionPath.getEndTrackDirection();

                // Create route
                var route = new Route(
                        id,
                        routeGraph,
                        length,
                        releaseGroups,
                        tvdSectionsPath,
                        switchesGroup,
                        entrySignal);

                routeGraph.routeMap.put(id, route);

                // Link route to the starting waypoint
                startWaypoint.getRouteNeighbors(startWaypointDirection).add(route);

                // Link route to the ending waypoint
                endWaypoint.getIncomingRouteNeighbors(endWaypointDirection).add(route);

                // Link route to track sections and tvd sections
                double routeOffset = 0;
                for (int i = 0; i < route.tvdSectionsPaths.size(); i++) {
                    var tvdSectionPath = route.tvdSectionsPaths.get(i);
                    tvdSectionPath.tvdSection.routeSubscribers.add(route);
                    for (var trackSectionRange : tvdSectionPath.trackSections) {
                        var trackSection = trackSectionRange.edge;
                        var trackBegin = Math.min(trackSectionRange.getBeginPosition(),
                                trackSectionRange.getEndPosition());
                        var trackEnd = Math.max(trackSectionRange.getBeginPosition(),
                                trackSectionRange.getEndPosition());
                        var routeFragment = new TrackSection.RouteFragment(
                                route, routeOffset, trackBegin, trackEnd, trackSectionRange.direction);
                        trackSection.getRoutes(trackSectionRange.direction).insert(routeFragment);
                        routeOffset += trackSectionRange.length();
                    }
                }
                return route;
            } catch (InvalidInfraException e) {
                // Forwards the exception and adds the route ID to the message, this helps with identifying problems
                var msg = String.format("Error when building route %s: %s", id, e);
                throw new InvalidInfraException(msg);
            }
        }

        public RouteGraph build() {
            return routeGraph;
        }

        /** Generates the tvd section path for the route. */
        private List<TVDSectionPath> generatePath(
                String routeId,
                Waypoint startWaypoint,
                Waypoint exitWaypoint,
                EdgeDirection entryDirection,
                HashMap<Switch, String> switchPositions
        ) throws InvalidInfraException {
            var res = new ArrayList<TVDSectionPath>();

            var curDirection = entryDirection;
            var curWaypoint = startWaypoint;

            // for each TVD section in our path
            while (true) {
                // use the current waypoint and direction to find the next tvd section
                var curTvdSection = curWaypoint.getTVDSection(curDirection);
                // if current waypoint is the exit point of the route we stop the algorithm
                if (curWaypoint == exitWaypoint)
                    break;

                var pathStartWaypoint = curWaypoint;
                Waypoint pathEndWaypoint = null;

                // get the location of the current waypoint
                var location = waypointLocations.get(curWaypoint);
                var curTrackSection = location.edge;
                var curOffset = location.offset;

                // for each track until we meet a new waypoint
                var tvdSectionPathSegments = new ArrayList<TrackSectionRange>();
                while (true) {
                    // try to the next waypoint relative to the current position
                    pathEndWaypoint = findEdgeNextWaypoint(curTrackSection, curDirection, curOffset);
                    // if we found one, add the segment of the track section between
                    // the current point and the waypoint to the TVDSectionPath and finalize it
                    if (pathEndWaypoint != null) {
                        var nextLocation = waypointLocations.get(pathEndWaypoint);
                        tvdSectionPathSegments.add(new TrackSectionRange(
                                curTrackSection,
                                curDirection,
                                curTrackSection.clamp(curOffset),
                                nextLocation.offset
                        ));
                        break;
                    }

                    // otherwise, add a segment that goes up to the end of the track section
                    tvdSectionPathSegments.add(new TrackSectionRange(
                            curTrackSection,
                            curDirection,
                            curTrackSection.clamp(curOffset),
                            curDirection == START_TO_STOP ? curTrackSection.length : 0
                    ));

                    // and find the next track section using given switch positions
                    var nextTrackSection = nextTrackSection(routeId, curTrackSection, curDirection, switchPositions);
                    // setup the loop for the next TVDSectionPath
                    curDirection = nextTrackSection.getDirection(curTrackSection, curDirection);
                    curTrackSection = nextTrackSection;
                    curOffset = Double.NEGATIVE_INFINITY;
                    if (curDirection == STOP_TO_START)
                        curOffset = Double.POSITIVE_INFINITY;
                }
                res.add(new TVDSectionPath(curTvdSection, tvdSectionPathSegments, pathStartWaypoint, pathEndWaypoint));
                curWaypoint = pathEndWaypoint;
            }
            return res;
        }

        private static Waypoint findEdgeNextWaypoint(
                TrackSection trackSection,
                EdgeDirection direction,
                double offset
        ) {
            var waypoints = trackSection.waypoints;
            if (direction == START_TO_STOP) {
                for (int i = 0; i < waypoints.size(); i++) {
                    var waypoint = waypoints.get(i);
                    if (waypoint.position > offset)
                        return waypoint.value;
                }
            } else {
                for (int i = waypoints.size() - 1; i >= 0; i--) {
                    var waypoint = waypoints.get(i);
                    if (waypoint.position < offset)
                        return waypoint.value;
                }
            }
            return null;
        }


        /** Moves forward by one track section, following switches position. Returns null if it can't be determined. */
        private TrackSection nextTrackSection(
                String routeId,
                TrackSection edge,
                EdgeDirection direction,
                HashMap<Switch, String> switchPositions
        ) throws InvalidInfraException {
            var trackSectionEndNode = direction == START_TO_STOP ? edge.endNode : edge.startNode;
            var neighbors = direction == START_TO_STOP ? edge.endNeighbors : edge.startNeighbors;
            if (neighbors.size() == 0)
                throw new InvalidInfraException(
                        "couldn't reach the end waypoint of route " + routeId
                        + ", got stuck at the end of track section " + edge.id
                                + " with direction " + direction.name());

            if (neighbors.size() == 1)
                return neighbors.get(0);

            var intersectionNode = trackGraph.getNode(trackSectionEndNode);
            if (intersectionNode.getClass() != Switch.class)
                throw new InvalidInfraException("route " + routeId + " stumbled upon an intersection without a switch");

            var switchNode = (Switch) intersectionNode;
            var groupPosition = switchPositions.get(switchNode);
            if (groupPosition == null)
                throw new InvalidInfraException(
                        String.format("Missing switch position '%s' for route: %s", switchNode.id, routeId));
            for (var link : switchNode.groups.get(groupPosition)) {
                if (link.src.trackSection.id.equals(edge.id)) {
                    return link.dst.trackSection;
                }
            }

            throw new InvalidInfraException("The next track section is not defined by the current group");
        }
    }
}
