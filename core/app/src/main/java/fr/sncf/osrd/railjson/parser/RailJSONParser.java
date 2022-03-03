package fr.sncf.osrd.railjson.parser;

import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;
import static java.lang.Math.abs;

import com.squareup.moshi.JsonReader;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.Signal;
import fr.sncf.osrd.infra.trackgraph.*;
import fr.sncf.osrd.railjson.schema.infra.*;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSTrackRange;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.DoubleRangeMap;
import fr.sncf.osrd.utils.RangeValue;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import okio.BufferedSource;
import java.io.IOException;
import java.util.*;

@SuppressFBWarnings({"NP_UNWRITTEN_PUBLIC_OR_PROTECTED_FIELD"})
public class RailJSONParser {
    /**
     * Parses some railJSON infra into the internal representation
     * @param source a data stream to read from
     * @param lenient whether to tolerate invalid yet understandable json constructs
     * @return an OSRD infrastructure
     * @throws InvalidInfraException {@inheritDoc}
     * @throws IOException {@inheritDoc}
     */
    public static Infra parse(BufferedSource source, boolean lenient) throws InvalidInfraException, IOException {
        var jsonReader = JsonReader.of(source);
        jsonReader.setLenient(lenient);
        var railJSON = RJSInfra.adapter.fromJson(jsonReader);
        if (railJSON == null)
            throw new InvalidInfraException("the railJSON source does not contain any data");
        return RailJSONParser.parse(railJSON);
    }

    /**
     * Parses a structured railJSON into the internal representation
     * @param railJSON a railJSON infrastructure
     * @return an OSRD infrastructure
     */
    public static Infra parse(RJSInfra railJSON) throws InvalidInfraException {
        if (!railJSON.version.equals(RJSInfra.CURRENT_VERSION)) {
            throw new InvalidInfraException(
                    String.format("Invalid railjson format version: got '%s' expected '%s'",
                            railJSON.version, RJSInfra.CURRENT_VERSION));
        }

        var trackGraph = new TrackGraph();

        // create a unique identifier for all track intersection nodes
        var nodeIDs = TrackNodeIDs.from(railJSON.trackSectionLinks, railJSON.trackSections);
        trackGraph.resizeNodes(nodeIDs.numberOfNodes);

        // create switch nodes
        var switchNames = new HashMap<String, Switch>();
        var switchIndex = 0;
        for (var rjsSwitch : railJSON.switches) {
            // get the first port of the switch that will be considered as the base
            if (rjsSwitch.ports.isEmpty()) {
                throw new InvalidInfraException("The switch should have at least one port");
            }
            var base = rjsSwitch.ports.entrySet().stream().findFirst().get().getValue();
            var index = nodeIDs.get(base);
            switchNames.put(
                    rjsSwitch.id,
                    trackGraph.makeSwitchNode(
                            index,
                            rjsSwitch.id,
                            switchIndex++,
                            rjsSwitch.groupChangeDelay,
                            new ArrayList<>(),
                            new HashMap<>()
                    )
            );
        }
        final var switches = new ArrayList<>(switchNames.values());

        // fill nodes with placeholders
        for (int i = 0; i < nodeIDs.numberOfNodes; i++)
            if (trackGraph.getNode(i) == null)
                trackGraph.makePlaceholderNode(i, String.valueOf(i));

        // parse tracks
        var infraTrackSections = new HashMap<String, TrackSection>();
        var infraTrackBuilders = new HashMap<String, TrackBuilder>();
        for (var trackSection : railJSON.trackSections) {
            var track = parseTrackSection(trackGraph, nodeIDs, trackSection);
            infraTrackSections.put(trackSection.id, track);
            infraTrackBuilders.put(trackSection.id, new TrackBuilder(track));
        }

        // register operational points
        for (var operationalPoint : railJSON.operationalPoints) {
            for (var part : operationalPoint.parts) {
                var op = new OperationalPoint(operationalPoint.getID());
                trackGraph.operationalPoints.put(op.id, op);
                var track = part.track.parseRef(infraTrackSections, "TrackSection");
                var trackBuilder = part.track.parseRef(infraTrackBuilders, "TrackSection");
                op.addRef(track, part.position, trackBuilder.opBuilder);
            }
        }

        var waypointsMap = new HashMap<String, Waypoint>();
        int waypointIndex = 0;
        var detectorIdToSignalNormalMap = new HashMap<String, Signal>();
        var detectorIdToSignalReverseMap = new HashMap<String, Signal>();

        // Parse waypoints
        for (var rjsDetector : railJSON.detectors) {
            var detector = new Detector(waypointIndex, rjsDetector.getID());
            waypointsMap.put(detector.id, detector);
            var track = rjsDetector.track.parseRef(infraTrackBuilders, "TrackSection");
            track.waypointsBuilder.add(rjsDetector.position, detector);
            waypointIndex++;
        }
        for (var rjsDetector : railJSON.bufferStops) {
            var bufferStop = new BufferStop(waypointIndex, rjsDetector.getID());
            waypointsMap.put(bufferStop.id, bufferStop);
            var track = rjsDetector.track.parseRef(infraTrackBuilders, "TrackSection");
            track.waypointsBuilder.add(rjsDetector.position, bufferStop);
            waypointIndex++;
        }

        var signals = new ArrayList<Signal>();
        for (var rjsSignal : railJSON.signals) {
            // get linked detector
            Detector linkedDetector = null;
            if (rjsSignal.linkedDetector != null)
                linkedDetector = (Detector) rjsSignal.linkedDetector.parseRef(waypointsMap, "Detector");

            var signal = new Signal(
                    signals.size(),
                    rjsSignal.id,
                    rjsSignal.direction,
                    rjsSignal.sightDistance,
                    linkedDetector
            );
            var trackBuilder = rjsSignal.track.parseRef(infraTrackBuilders, "TrackSection");
            trackBuilder.signalsBuilder.add(rjsSignal.position, signal);
            signals.add(signal);
            if (rjsSignal.linkedDetector != null) {
                if (rjsSignal.direction == EdgeDirection.START_TO_STOP)
                    detectorIdToSignalNormalMap.put(rjsSignal.linkedDetector.id.id, signal);
                else
                    detectorIdToSignalReverseMap.put(rjsSignal.linkedDetector.id.id, signal);
            }
        }

        for (var trackBuilder : infraTrackBuilders.values())
            trackBuilder.build();

        for (var rjsSwitch : railJSON.switches) {
            if (!switchNames.containsKey(rjsSwitch.id)) {
                throw new InvalidInfraException("The switch was not properly added in the map switchName");
            }
            var switchRef = switchNames.get(rjsSwitch.id);
            for (var entry : rjsSwitch.ports.entrySet()) {
                var portName = entry.getKey();
                var port = entry.getValue();
                switchRef.ports.add(new Switch.Port(
                        portName,
                        port.track.parseRef(infraTrackSections, "TrackSection"),
                        EdgeEndpoint.parse(port.endpoint)
                ));
            }
        }

        // Create switch type map
        var switchTypeMap = new HashMap<String, RJSSwitchType>();
        for (var rjsSwitchType : railJSON.switchTypes)
            switchTypeMap.put(rjsSwitchType.id, rjsSwitchType);

        // Fill switch groups
        for (var rjsSwitch : railJSON.switches) {
            parseSwitch(rjsSwitch, switchNames, infraTrackSections, switchTypeMap);
        }

        // link track sections together
        for (var trackSectionLink : railJSON.trackSectionLinks) {
            var begin = trackSectionLink.src;
            var end = trackSectionLink.dst;
            var beginEdge = begin.track.parseRef(infraTrackSections, "TrackSection");
            var endEdge = end.track.parseRef(infraTrackSections, "TrackSection");
            var direction = trackSectionLink.navigability;
            linkEdges(beginEdge, EdgeEndpoint.parse(begin.endpoint), endEdge,
                    EdgeEndpoint.parse(end.endpoint), ApplicableDirection.parse(direction));
        }

        // Build tvd sections
        var tvdSections = TvdSectionBuilder.build(trackGraph);

        // Build route Graph
        var routeGraphBuilder = new RouteGraph.Builder(trackGraph, waypointsMap.size());

        for (var rjsRoute : railJSON.routes)
            parseRoute(routeGraphBuilder, infraTrackSections, trackGraph,
                    waypointsMap, detectorIdToSignalNormalMap, detectorIdToSignalReverseMap, rjsRoute);

        return Infra.build(trackGraph, routeGraphBuilder.build(), tvdSections, signals, switches);
    }

    private static void addCurvesToGradients(DoubleRangeMap gradients, RJSTrackSection trackSection) {
        // Insert curves: gradient + 800 / radius
        for (var rjsCurve : trackSection.curves) {
            if (rjsCurve.radius == 0.)
                continue;

            var floorEndEntry = gradients.floorEntry(rjsCurve.end);
            gradients.put(rjsCurve.end, floorEndEntry.getValue());

            var floorBeginEntry = gradients.floorEntry(rjsCurve.begin);
            if (floorBeginEntry.getKey() < rjsCurve.begin)
                gradients.put(rjsCurve.begin, floorBeginEntry.getValue() + 800. / abs(rjsCurve.radius));

            for (var slopeEntry : gradients.subMap(rjsCurve.begin, rjsCurve.end).entrySet())
                gradients.put(slopeEntry.getKey(), slopeEntry.getValue() + 800. / abs(rjsCurve.radius));
        }
    }

    private static TrackSection parseTrackSection(
            TrackGraph trackGraph,
            TrackNodeIDs nodeIDs,
            RJSTrackSection trackSection
    )
            throws InvalidInfraException {
        var beginID = nodeIDs.get(trackSection.beginEndpoint());
        var endID = nodeIDs.get(trackSection.endEndpoint());
        var trackLine = trackSection.sch == null ? null : trackSection.sch.getLine();
        var infraTrackSection = trackGraph.makeTrackSection(beginID, endID, trackSection.id,
                trackSection.length, trackLine);

        // Parse speed limits
        for (var rjsSpeedLimits : trackSection.speedSections) {
            var speedSection = new SpeedSection(true, rjsSpeedLimits.speed); // TODO figure out if we keep this
            var rangeSpeedLimit = new RangeValue<>(rjsSpeedLimits.begin, rjsSpeedLimits.end, speedSection);
            if (rjsSpeedLimits.applicableDirections.appliesToNormal())
                infraTrackSection.forwardSpeedSections.add(rangeSpeedLimit);
            if (rjsSpeedLimits.applicableDirections.appliesToReverse())
                infraTrackSection.backwardSpeedSections.add(rangeSpeedLimit);
        }

        // Parse slopes and curves
        if (trackSection.slopes == null)
            trackSection.slopes = new ArrayList<>();
        if (trackSection.curves == null)
            trackSection.curves = new ArrayList<>();
        if (RJSTrackRange.isOverlaping(trackSection.slopes)) {
            throw new InvalidInfraException(
                    String.format("Track section '%s' has overlapping slopes", trackSection.id));
        } else if (RJSTrackRange.isOverlaping(trackSection.curves)) {
            throw new InvalidInfraException(
                    String.format("Track section '%s' has overlapping curves", trackSection.id));
        }

        // Add an initial flat gradient slope
        infraTrackSection.forwardGradients.addRange(0., infraTrackSection.length, 0.);
        infraTrackSection.backwardGradients.addRange(0., infraTrackSection.length, 0.);

        // Insert railjson slopes
        for (var rjsSlope : trackSection.slopes) {
            if (rjsSlope.gradient != 0.) {
                infraTrackSection.forwardGradients.addRange(rjsSlope.begin, rjsSlope.end, rjsSlope.gradient);
                infraTrackSection.backwardGradients.addRange(rjsSlope.begin, rjsSlope.end, -rjsSlope.gradient);
            }
        }
        addCurvesToGradients(infraTrackSection.forwardGradients, trackSection);
        addCurvesToGradients(infraTrackSection.backwardGradients, trackSection);
        // TODO add catenaries
        return infraTrackSection;
    }

    private static void parseRoute(
            RouteGraph.Builder routeGraphBuilder,
            HashMap<String, TrackSection> infraTrackSections,
            TrackGraph trackGraph,
            HashMap<String, Waypoint> waypointsMap,
            HashMap<String, Signal> detectorIdToSignalNormalMap,
            HashMap<String, Signal> detectorIdToSignalReverseMap,
            RJSRoute rjsRoute
    ) throws InvalidInfraException {
        // Parse route path
        var path = new ArrayList<TrackSectionRange>();
        for (var step : rjsRoute.path) {
            var track = step.track.parseRef(infraTrackSections, "TrackSection");
            path.add(new TrackSectionRange(track, EdgeDirection.parse(step.direction), step.begin, step.end));
        }

        // Find switch positions
        var switchesGroup = new HashMap<Switch, String>();
        for (int i = 1; i < path.size(); i++) {
            var prev = path.get(i - 1);
            var next = path.get(i);
            addSwitchPosition(prev, next, trackGraph, switchesGroup);
        }

        // Parse entry and exit point
        var options = Set.of("Detector", "BufferStop");
        var entryPoint = rjsRoute.entryPoint.parseRef(waypointsMap, options);
        var exitPoint = rjsRoute.exitPoint.parseRef(waypointsMap, options);

        var entrySignal = detectorIdToSignalNormalMap.getOrDefault(entryPoint.id, null);
        if (path.get(0).direction == EdgeDirection.STOP_TO_START)
            entrySignal = detectorIdToSignalReverseMap.getOrDefault(entryPoint.id, null);

        // Parse release detectors
        var releaseDetectors = new HashSet<Waypoint>();
        for (var rjsDetector : rjsRoute.releaseDetectors)
            releaseDetectors.add(waypointsMap.get(rjsDetector.id.id));

        // TODO simplify makeRoute with the new parameters we have (path)
        routeGraphBuilder.makeRoute(
                rjsRoute.id,
                switchesGroup,
                entryPoint,
                exitPoint,
                entrySignal,
                path.get(0).direction,
                releaseDetectors
        );
    }

    private static void addSwitchPosition(TrackSectionRange prev, TrackSectionRange next,
                                          TrackGraph trackGraph, HashMap<Switch, String> switchesGroup)
            throws InvalidInfraException {
        if (prev.edge.id.equals(next.edge.id))
            return;
        var nodeId = prev.edge.getEndNode(prev.direction);
        var node = trackGraph.getNode(nodeId);
        if (node.getClass() != Switch.class)
            return;
        var switchNode = (Switch) node;
        for (var entry : switchNode.groups.entrySet()) {
            for (var port : entry.getValue()) {
                if ((port.src.trackSection.id.equals(prev.edge.id)
                        && port.dst.trackSection.id.equals(next.edge.id))
                        || (port.dst.trackSection.id.equals(prev.edge.id)
                        && port.src.trackSection.id.equals(next.edge.id))) {
                    switchesGroup.put(switchNode, entry.getKey());
                    return;
                }
            }
        }
        throw new InvalidInfraException("There isn't any switch configuration fitting for the route");
    }

    /** Parse a given RJS switch */
    private static void parseSwitch(
            RJSSwitch rjsSwitch,
            HashMap<String, Switch> switchNames,
            HashMap<String, TrackSection> infraTrackSections,
            HashMap<String, RJSSwitchType> switchTypeMap
    ) throws InvalidInfraException {
        var switchRef = switchNames.get(rjsSwitch.id);
        var portMap = new HashMap<String, Switch.Port>();
        for (var entry : rjsSwitch.ports.entrySet()) {
            var portName = entry.getKey();
            var port = entry.getValue();
            portMap.put(
                    portName,
                    new Switch.Port(
                            portName,
                            port.track.parseRef(infraTrackSections, "TrackSection"),
                            EdgeEndpoint.parse(port.endpoint)
                    )
            );
        }
        var switchType = rjsSwitch.switchType.parseRef(switchTypeMap, "SwitchType");
        for (var entry : switchType.groups.entrySet()) {
            var group = entry.getKey();
            var edges = new ArrayList<Switch.PortEdge>();
            for (var e : entry.getValue()) {
                var src = portMap.get(e.src);
                var dst = portMap.get(e.dst);
                edges.add(new Switch.PortEdge(src, dst));
                if (e.bidirectional) {
                    edges.add(new Switch.PortEdge(dst, src));
                }
            }
            switchRef.groups.put(group, edges);
        }
        var switchTypePorts = new HashSet<>(switchType.ports);
        var switchPorts = rjsSwitch.ports.keySet();
        if (!switchTypePorts.equals(switchPorts))
            throw new InvalidInfraException(String.format(
                    "Switch %s doesn't have the right ports for type %s (expected %s, got %s)",
                    rjsSwitch.id, switchType.id, switchTypePorts, switchPorts
            ));
    }
}
