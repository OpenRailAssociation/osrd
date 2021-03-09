package fr.sncf.osrd.railml;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railjson.schema.*;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSSignal;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.railml.routegraph.RMLRouteGraph;
import fr.sncf.osrd.railml.routegraph.RMLRouteGraphBuilder;
import fr.sncf.osrd.railml.routegraph.RMLRouteWaypoint;
import fr.sncf.osrd.railml.routegraph.RMLTVDSectionPath;
import fr.sncf.osrd.railml.tracksectiongraph.RMLTrackSectionGraph;

import fr.sncf.osrd.railml.tracksectiongraph.TrackNetElement;
import fr.sncf.osrd.utils.graph.*;
import fr.sncf.osrd.utils.graph.path.*;
import org.dom4j.Document;
import org.dom4j.Element;

import java.util.*;

public class RMLRoute {
    static ArrayList<RJSRoute> parse(
            RMLTrackSectionGraph graph,
            Document document,
            HashMap<String, RJSTrackSection> rjsTrackSections
    ) throws InvalidInfraException {
        var rmlRouteGraph = new RMLRouteGraph();
        var overlayBuilder = new RMLRouteGraphBuilder(rjsTrackSections, graph, rmlRouteGraph);
        overlayBuilder.build();

        // Create Map : waypoint id ==> rjsWaypoints
        var rjsWaypointsMap = new HashMap<String, ID<RJSRouteWaypoint>>();
        for (var rjsTrackSection : rjsTrackSections.values()) {
            for (var rjsWaypoint  : rjsTrackSection.routeWaypoints)
                rjsWaypointsMap.put(rjsWaypoint.id, ID.from(rjsWaypoint));
        }

        // Create Map : signal id ==> TrackNetElement the signal is on
        var signalTrackNetElementMap = new HashMap<String, TrackNetElement>();
        for (var rjsTrackSection : rjsTrackSections.values()) {
            for (var rjsSignal  : rjsTrackSection.signals)
                signalTrackNetElementMap.put(rjsSignal.id, graph.trackNetElementMap.get(rjsTrackSection.id));
        }

        var res = new ArrayList<RJSRoute>();
        var xpath = "/railML/interlocking/assetsForIL/routes/route";
        for (var routeNode :  document.selectNodes(xpath)) {
            var route = (Element) routeNode;
            var id = route.attributeValue("id");

            var tvdSections = parseTVDSections(route);
            var switchesPosition = parseSwitchesPosition(route);

            var entryWaypoint = parseEntryExitWaypoint(
                    true, route, rmlRouteGraph, rjsTrackSections, graph, signalTrackNetElementMap);
            var exitWaypoint = parseEntryExitWaypoint(
                    false, route, rmlRouteGraph, rjsTrackSections, graph, signalTrackNetElementMap);
            var rmlRouteWaypoints = computeRouteWaypoints(entryWaypoint, exitWaypoint, rmlRouteGraph);
            var routeWaypoints = rmlToRjsWaypoints(rmlRouteWaypoints, rjsWaypointsMap);

            res.add(new RJSRoute(id, tvdSections, switchesPosition, routeWaypoints));
        }
        return res;
    }

    private static ArrayList<ID<RJSRouteWaypoint>> rmlToRjsWaypoints(
            List<RMLRouteWaypoint> rmlRouteWaypoints,
            HashMap<String, ID<RJSRouteWaypoint>> rjsWaypointsMap
    ) {
        var waypoints = new ArrayList<ID<RJSRouteWaypoint>>();
        for (var rmlWaypoint : rmlRouteWaypoints)
            waypoints.add(rjsWaypointsMap.get(rmlWaypoint.id));
        return waypoints;
    }

    @SuppressFBWarnings(value = {"BC_UNCONFIRMED_CAST"}, justification = "it's a linter bug, there's no cast")
    private static ArrayList<RMLRouteWaypoint> computeRouteWaypoints(
            RMLRouteWaypoint entryWaypoint,
            RMLRouteWaypoint exitWaypoint,
            RMLRouteGraph rmlRouteGraph
    ) throws InvalidInfraException {
        var waypoints = new ArrayList<RMLRouteWaypoint>();
        var goalEdges = rmlRouteGraph.waypointToTvdSectionPath.get(exitWaypoint.index);
        var startingPoints = new ArrayList<BasicPathStart<RMLTVDSectionPath>>();
        // Find starting edges
        for (var edge : rmlRouteGraph.waypointToTvdSectionPath.get(entryWaypoint.index)) {
            if (edge.startNode == entryWaypoint.index)
                startingPoints.add(new BasicPathStart<>(0, edge, EdgeDirection.START_TO_STOP, 0));
            else
                startingPoints.add(new BasicPathStart<>(0, edge, EdgeDirection.STOP_TO_START, edge.length));
        }
        // Prepare for dijkstra
        var costFunction = new DistCostFunction<RMLTVDSectionPath>();
        var availablePaths = new ArrayList<
                FullPathArray<RMLTVDSectionPath, BasicPathStart<RMLTVDSectionPath>, BasicPathEnd<RMLTVDSectionPath>>>();

        // Compute the paths from the entry waypoint to the exit waypoint
        BiGraphDijkstra.findPaths(
                rmlRouteGraph,
                startingPoints,
                costFunction,
                (pathNode) -> {
                    for (var goalEdge : goalEdges) {
                        if (goalEdge == pathNode.edge) {
                            var addedCost = costFunction.evaluate(goalEdge, pathNode.position, goalEdge.length);
                            return new BasicPathEnd<>(addedCost, goalEdge, pathNode.direction, 0, pathNode);
                        }
                    }
                    return null;
                },
                (pathToGoal) -> {
                    availablePaths.add(FullPathArray.from(pathToGoal));
                    return false;
                });

        // If multiple or none path is found then throw an error
        if (availablePaths.isEmpty())
            throw new InvalidInfraException(String.format(
                    "No path found to construct the route from '%s' to '%s'",
                    entryWaypoint.id, exitWaypoint.id));

        // Convert path nodes to a list of waypoints
        // Ignore last node since it's a duplicated edge of the second last.
        var nodes = availablePaths.get(0).pathNodes;
        for (var i = 0; i < nodes.size() - 1; i++) {
            var node = nodes.get(i);
            if (node.direction == EdgeDirection.START_TO_STOP)
                waypoints.add(rmlRouteGraph.getNode(node.edge.startNode));
            else
                waypoints.add(rmlRouteGraph.getNode(node.edge.endNode));
        }
        waypoints.add(exitWaypoint);

        return waypoints;
    }

    private static RMLRouteWaypoint parseEntryExitWaypoint(
            boolean isEntry,
            Element route,
            RMLRouteGraph rmlRouteGraph,
            HashMap<String, RJSTrackSection> rjsTrackSections,
            RMLTrackSectionGraph rmlTrackSectionGraph,
            HashMap<String, TrackNetElement> signalTrackNetElementMap
    ) throws InvalidInfraException {
        var element = isEntry ? "routeEntry" : "routeExit";
        var entryElement = route.element(element).element("refersTo").attributeValue("ref");
        return findAssociatedWaypoint(
                entryElement,
                rmlRouteGraph,
                rjsTrackSections,
                rmlTrackSectionGraph,
                signalTrackNetElementMap
        );
    }

    private static RMLRouteWaypoint findAssociatedWaypoint(
            String elementID,
            RMLRouteGraph rmlRouteGraph,
            HashMap<String, RJSTrackSection> rjsTrackSections,
            RMLTrackSectionGraph rmlTrackSectionGraph,
            HashMap<String, TrackNetElement> signalTrackNetElementMap
    ) throws InvalidInfraException {
        // If a buffer stop waypoint then return it
        var waypoint = rmlRouteGraph.waypointsMap.get(elementID);
        if (waypoint != null)
            return waypoint;

        var trackNetElement = signalTrackNetElementMap.get(elementID);
        if (trackNetElement == null)
            throw new InvalidInfraException(
                    String.format("ElementID '%s' not found, should refer a buffer stop or signal", elementID));

        // Find signal
        var signal = findSignal(elementID, trackNetElement, rjsTrackSections);

        var direction = EdgeDirection.START_TO_STOP;
        if (signal.navigability == ApplicableDirections.REVERSE) {
            direction = EdgeDirection.STOP_TO_START;
        }

        var rjsWaypoint = findNextWaypointDirection(
                trackNetElement,
                direction,
                signal.position,
                rjsTrackSections,
                rmlTrackSectionGraph
        );
        return rmlRouteGraph.waypointsMap.get(rjsWaypoint.id);
    }

    private static RJSRouteWaypoint findNextWaypointDirection(
            TrackNetElement trackNetElement,
            EdgeDirection direction,
            double signalPosition,
            HashMap<String, RJSTrackSection> rjsTrackSections,
            RMLTrackSectionGraph rmlTrackSectionGraph
    ) throws InvalidInfraException {
        var trackSection = rjsTrackSections.get(trackNetElement.id);
        if (direction == EdgeDirection.START_TO_STOP) {
            for (var waypoint : trackSection.routeWaypoints)
                if (waypoint.position > signalPosition)
                    return waypoint;
        } else {
            RJSRouteWaypoint resWaypoint = null;
            for (var waypoint : trackSection.routeWaypoints) {
                if (waypoint.position < signalPosition) {
                    resWaypoint = waypoint;
                } else {
                    break;
                }
            }
            if (resWaypoint != null)
                return resWaypoint;
        }

        // No way point on this trackSection
        var endpoint = direction == EdgeDirection.START_TO_STOP ? EdgeEndpoint.END : EdgeEndpoint.BEGIN;
        var neighbors = rmlTrackSectionGraph.getNeighborRels(trackNetElement, endpoint);
        if (neighbors.size() != 1)
            throw new InvalidInfraException("Couldn't find associated waypoint. None or more than one possibilities");
        var neighbor = neighbors.get(0);
        var neighborDirection = neighbor.getDirection(trackNetElement, direction);
        var newSignalPos = neighborDirection == EdgeDirection.START_TO_STOP ? -1 : Double.MAX_VALUE;
        return findNextWaypointDirection(
                neighbor.getEdge(trackNetElement, direction),
                neighborDirection,
                newSignalPos,
                rjsTrackSections,
                rmlTrackSectionGraph
        );
    }

    private static RJSSignal findSignal(
            String signalID,
            TrackNetElement trackNetElement,
            HashMap<String, RJSTrackSection> rjsTrackSections
    ) {
        var rjsTrackSection = rjsTrackSections.get(trackNetElement.id);
        for (var signal : rjsTrackSection.signals) {
            if (signal.id.equals(signalID))
                return signal;
        }
        return null;
    }

    private static ArrayList<ID<RJSTVDSection>> parseTVDSections(Element route) {
        var tvdSections = new ArrayList<ID<RJSTVDSection>>();
        for (var tvdSection : route.elements("hasTvdSection")) {
            var tvdSectionID = new ID<RJSTVDSection>(tvdSection.attributeValue("ref"));
            tvdSections.add(tvdSectionID);
        }
        return tvdSections;
    }

    private static Map<ID<RJSSwitch>, RJSSwitch.Position> parseSwitchesPosition(Element route) {
        var switchesPosition = new HashMap<ID<RJSSwitch>, RJSSwitch.Position>();
        for (var switchPosition : route.elements("facingSwitchInPosition")) {
            var switchID = new ID<RJSSwitch>(switchPosition.element("refersToSwitch").attributeValue("ref"));
            var positionStr = switchPosition.attributeValue("inPosition");
            var position = RJSSwitch.Position.valueOf(positionStr.toUpperCase(Locale.ENGLISH));
            switchesPosition.put(switchID, position);
        }
        return switchesPosition;
    }
}
