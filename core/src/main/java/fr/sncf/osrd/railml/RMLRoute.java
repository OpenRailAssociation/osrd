package fr.sncf.osrd.railml;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.railjson.schema.infra.RJSTVDSection;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.railml.routegraph.RMLRouteGraph;
import fr.sncf.osrd.railml.routegraph.RMLRouteGraphBuilder;
import fr.sncf.osrd.railml.routegraph.RMLRouteWaypoint;
import fr.sncf.osrd.railml.tracksectiongraph.RMLTrackSectionGraph;
import fr.sncf.osrd.railml.tracksectiongraph.TrackNetElement;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import org.dom4j.Document;
import org.dom4j.Element;
import java.util.*;

public class RMLRoute {
    static ArrayList<RJSRoute> parse(
            RMLTrackSectionGraph graph,
            Document document,
            HashMap<String, RJSTrackSection> rjsTrackSections,
            HashMap<String, RMLReleaseGroupRear> releaseGroupsRear
    ) throws InvalidInfraException {
        var rmlRouteGraph = new RMLRouteGraph();
        var overlayBuilder = new RMLRouteGraphBuilder(rjsTrackSections, graph, rmlRouteGraph);
        overlayBuilder.build();

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

            var switchesGroup = parseSwitchesPosition(route);
            var releaseGroups = parseReleaseGroups(route, releaseGroupsRear);

            var entryWaypoint = parseEntryWaypoint(route,
                    rmlRouteGraph, rjsTrackSections, graph, signalTrackNetElementMap);

            var entrySignal = parseEntrySignal(route, signalTrackNetElementMap,
                    signalTrackNetElementMap, rjsTrackSections);

            // TODO: deduce the direction from the entry waypoint
            EdgeDirection entryDirection = EdgeDirection.START_TO_STOP;

            if (entrySignal != null) {
                entrySignal.linkedDetector = new ID<>(entryWaypoint.id);
                entryDirection = EdgeDirection.from(entrySignal.applicableDirection);
            }

            var exitWaypoint = parseExitWaypoint(route,
                    rmlRouteGraph, rjsTrackSections, graph, signalTrackNetElementMap);
            res.add(new RJSRoute(id, switchesGroup, releaseGroups, entryWaypoint, exitWaypoint, entryDirection));
        }
        return res;
    }

    private static List<Set<ID<RJSTVDSection>>> parseReleaseGroups(
            Element route,
            HashMap<String, RMLReleaseGroupRear> releaseGroupsRear
    ) {
        var res = new ArrayList<Set<ID<RJSTVDSection>>>();
        for (var releaseGroup : route.elements("hasReleaseGroup")) {
            var releaseGroupId = releaseGroup.attributeValue("ref");
            res.add(releaseGroupsRear.get(releaseGroupId).tvdSections);
        }
        return res;
    }

    private static ID<RJSRouteWaypoint> parseExitWaypoint(
            Element route,
            RMLRouteGraph rmlRouteGraph,
            HashMap<String, RJSTrackSection> rjsTrackSections,
            RMLTrackSectionGraph rmlTrackSectionGraph,
            HashMap<String, TrackNetElement> signalTrackNetElementMap
    ) throws InvalidInfraException {
        var element = "routeExit";
        var entryElement = route.element(element).element("refersTo").attributeValue("ref");
        var waypoint = findAssociatedWaypoint(
                entryElement,
                rmlRouteGraph,
                rjsTrackSections,
                rmlTrackSectionGraph,
                signalTrackNetElementMap
        );
        return new ID<>(waypoint.id);
    }


    private static ID<RJSRouteWaypoint> parseEntryWaypoint(
            Element route,
            RMLRouteGraph rmlRouteGraph,
            HashMap<String, RJSTrackSection> rjsTrackSections,
            RMLTrackSectionGraph rmlTrackSectionGraph,
            HashMap<String, TrackNetElement> signalTrackNetElementMap
    ) throws InvalidInfraException {
        var element = "routeEntry";
        var entryElement = route.element(element).element("refersTo").attributeValue("ref");
        var waypoint = findAssociatedWaypoint(
                entryElement,
                rmlRouteGraph,
                rjsTrackSections,
                rmlTrackSectionGraph,
                signalTrackNetElementMap
        );
        return new ID<>(waypoint.id);
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
        assert signal != null;
        if (signal.applicableDirection == ApplicableDirection.REVERSE) {
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

    private static RJSSignal parseEntrySignal(Element route, HashMap<String, TrackNetElement> signalTrackNets,
                                              HashMap<String, TrackNetElement> signalTrackNetElementMap,
                                              HashMap<String, RJSTrackSection> rjsTrackSections)
            throws InvalidInfraException {
        var entryElement = route.element("routeEntry").element("refersTo").attributeValue("ref");
        var isSignal = signalTrackNets.containsKey(entryElement);
        if (!isSignal)
            return null;
        var trackNetElement = signalTrackNetElementMap.get(entryElement);
        if (trackNetElement == null)
            throw new InvalidInfraException(
                    String.format("ElementID '%s' not found, should refer a buffer stop or signal", entryElement));

        return findSignal(entryElement, trackNetElement, rjsTrackSections);
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

    private static Map<ID<RJSSwitch>, String> parseSwitchesPosition(Element route) {
        var switchesGroup = new HashMap<ID<RJSSwitch>, String>();
        for (var switchPosition : route.elements("facingSwitchInPosition")) {
            var switchID = new ID<RJSSwitch>(switchPosition.element("refersToSwitch").attributeValue("ref"));
            var positionStr = switchPosition.attributeValue("inPosition");
            var group = positionStr.toUpperCase(Locale.ENGLISH);
            switchesGroup.put(switchID, group);
        }
        return switchesGroup;
    }
}
