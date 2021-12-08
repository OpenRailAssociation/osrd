package fr.sncf.osrd.railjson.parser;

import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;

import com.squareup.moshi.JsonReader;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.railscript.RSExpr;
import fr.sncf.osrd.infra.railscript.RSExprVisitor;
import fr.sncf.osrd.infra.railscript.RSFunction;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.AspectConstraint;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.*;
import fr.sncf.osrd.railjson.schema.common.Identified;
import fr.sncf.osrd.railjson.schema.common.ObjectRef;
import fr.sncf.osrd.railjson.schema.infra.*;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSTrackRange;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.DoubleRangeMap;
import fr.sncf.osrd.utils.RangeValue;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.graph.EdgeDirection;
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
                var track = parseRef(part.track, infraTrackSections);
                var trackBuilder = parseRef(part.track, infraTrackBuilders);
                op.addRef(track, part.position, trackBuilder.opBuilder);
            }
        }

        // parse aspects
        int aspectIndex = 0;
        var aspectsMap = new HashMap<String, Aspect>();
        for (var rjsAspect : railJSON.aspects) {
            var constraints = new ArrayList<AspectConstraint>();
            for (var constraint : rjsAspect.constraints)
                constraints.add(constraint.parse());
            var aspect = new Aspect(aspectIndex++, rjsAspect.id, rjsAspect.color, constraints);
            aspectsMap.put(aspect.id, aspect);
        }

        // parse signal functions
        var scriptFunctions = new HashMap<String, RSFunction<?>>();
        for (var rjsScriptFunction : railJSON.scriptFunctions) {
            var scriptFunction = RailScriptExprParser.parseFunction(
                    aspectsMap, scriptFunctions, rjsScriptFunction);
            scriptFunctions.put(scriptFunction.functionName, scriptFunction);
        }

        var waypointsMap = new HashMap<String, Waypoint>();
        int waypointIndex = 0;
        var detectorIdToSignalNormalMap = new HashMap<String, Signal>();
        var detectorIdToSignalReverseMap = new HashMap<String, Signal>();

        // Parse waypoints
        for (var rjsDetector : railJSON.detectors) {
            var detector = new Detector(waypointIndex, rjsDetector.getID());
            waypointsMap.put(detector.id, detector);
            var track = parseRef(rjsDetector.track, infraTrackBuilders);
            track.waypointsBuilder.add(rjsDetector.position, detector);
            waypointIndex++;
        }
        for (var rjsDetector : railJSON.bufferStops) {
            var bufferStop = new BufferStop(waypointIndex, rjsDetector.getID());
            waypointsMap.put(bufferStop.id, bufferStop);
            var track = parseRef(rjsDetector.track, infraTrackBuilders);
            track.waypointsBuilder.add(rjsDetector.position, bufferStop);
            waypointIndex++;
        }

        var signals = new ArrayList<Signal>();
        for (var rjsSignal : railJSON.signals) {
            var expr = RailScriptExprParser.parseStatefulSignalExpr(aspectsMap, scriptFunctions, rjsSignal.expr);

            // get linked detector
            Detector linkedDetector = null;
            if (rjsSignal.linkedDetector != null)
                linkedDetector = (Detector) parseRef(rjsSignal.linkedDetector, waypointsMap);

            var signal = new Signal(
                    signals.size(),
                    rjsSignal.id,
                    expr,
                    rjsSignal.direction,
                    rjsSignal.sightDistance,
                    linkedDetector
            );
            var trackBuilder = parseRef(rjsSignal.track, infraTrackBuilders);
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
                        parseRef(port.track, infraTrackSections),
                        port.endpoint
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
            var beginEdge = parseRef(begin.track, infraTrackSections);
            var endEdge = parseRef(end.track, infraTrackSections);
            var direction = trackSectionLink.navigability;
            linkEdges(beginEdge, begin.endpoint, endEdge, end.endpoint, direction);
        }

        // build name maps to prepare resolving names in expressions
        var signalNames = new HashMap<String, Signal>();
        for (var signal : signals)
            signalNames.put(signal.id, signal);

        // Build tvd sections
        var tvdSections = TvdSectionBuilder.build(trackGraph);

        // Link tvd sections created with tvd sections parsed
        var tvdSectionsMap = finalizeTvdSection(tvdSections, railJSON.tvdSections, waypointsMap);

        // Build route Graph
        var routeGraphBuilder = new RouteGraph.Builder(trackGraph, waypointsMap.size());

        for (var rjsRoute : railJSON.routes)
            parseRoute(routeGraphBuilder, tvdSectionsMap, infraTrackSections, trackGraph,
                    waypointsMap, detectorIdToSignalNormalMap, detectorIdToSignalReverseMap, rjsRoute);

        var routeGraph = routeGraphBuilder.build();

        resolveRailscript(signalNames, switchNames, scriptFunctions, signals, routeGraph);

        return Infra.build(trackGraph, routeGraphBuilder.build(),
                tvdSectionsMap, aspectsMap, signals, switches);
    }

    /** Resolves name of routes and signals*/
    private static void resolveRailscript(
            HashMap<String, Signal> signalNames,
            HashMap<String, Switch> switchNames,
            HashMap<String, RSFunction<?>> scriptFunctions,
            ArrayList<Signal> signals,
            RouteGraph routeGraph
    ) throws InvalidInfraException {
        var routeNames = new HashMap<String, Route>();
        for (var route : routeGraph.iterEdges())
            routeNames.put(route.id, route);
        var nameResolver = new RSExprVisitor() {
            @Override
            public void visit(RSExpr.SignalRef expr) throws InvalidInfraException {
                expr.resolve(signalNames);
            }

            @Override
            public void visit(RSExpr.RouteRef expr) throws InvalidInfraException {
                expr.resolve(routeNames);
            }

            @Override
            public void visit(RSExpr.SwitchRef expr) throws InvalidInfraException {
                expr.resolve(switchNames);
            }
        };
        for (var function : scriptFunctions.values())
            function.body.accept(nameResolver);
        for (var signal : signals)
            signal.expr.accept(nameResolver);

    }

    private static HashMap<String, TVDSection> finalizeTvdSection(
            ArrayList<TVDSection> tvdSections,
            Collection<RJSTVDSection> rjstvdSections,
            HashMap<String, Waypoint> waypointMap
    ) throws InvalidInfraException {
        var tvdSectionsMap = new HashMap<String, TVDSection>();

        // Setup map
        var waypointsToRJSTvd = new HashMap<ArrayList<Integer>, RJSTVDSection>();
        for (var rjsTVD : rjstvdSections) {
            var indexKeys = new ArrayList<Integer>();
            for (var rjsDetector : rjsTVD.trainDetectors)
                indexKeys.add(parseRef(rjsDetector, waypointMap).index);
            for (var rjsBufferStop : rjsTVD.bufferStops)
                indexKeys.add(parseRef(rjsBufferStop, waypointMap).index);
            Collections.sort(indexKeys);
            waypointsToRJSTvd.put(indexKeys, rjsTVD);
        }

        // Link tvdSection with rjsTvdSection
        for (var tvd : tvdSections) {
            var indexKeys = new ArrayList<Integer>();
            for (var waypoint : tvd.waypoints)
                indexKeys.add(waypoint.index);
            Collections.sort(indexKeys);
            var rjsTvdSection = waypointsToRJSTvd.get(indexKeys);
            if (rjsTvdSection == null)
                throw new InvalidInfraException("TVD section waypoint don't match any tvd section in railjson");
            tvd.id = rjsTvdSection.id;
            tvd.isBerthingTrack = rjsTvdSection.isBerthingTrack;
            tvdSectionsMap.put(tvd.id, tvd);
        }

        return tvdSectionsMap;
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
                gradients.put(rjsCurve.begin, floorBeginEntry.getValue() + 800. / rjsCurve.radius);

            for (var slopeEntry : gradients.subMap(rjsCurve.begin, rjsCurve.end).entrySet())
                gradients.put(slopeEntry.getKey(), slopeEntry.getValue() + 800. / rjsCurve.radius);
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
        var infraTrackSection = trackGraph.makeTrackSection(beginID, endID, trackSection.id,
                trackSection.length, null); // TODO set coords

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
            HashMap<String, TVDSection> tvdSectionsMap,
            HashMap<String, TrackSection> infraTrackSections,
            TrackGraph trackGraph, HashMap<String, Waypoint> waypointsMap,
            HashMap<String, Signal> detectorIdToSignalNormalMap,
            HashMap<String, Signal> detectorIdToSignalReverseMap,
            RJSRoute rjsRoute
    ) throws InvalidInfraException {
        // Parse release groups
        var releaseGroups = new ArrayList<SortedArraySet<TVDSection>>();
        var routeTvdSections = new SortedArraySet<TVDSection>();
        for (var rjsReleaseGroup : rjsRoute.releaseGroups) {
            var releaseGroup = new SortedArraySet<TVDSection>();
            for (var rjsTvdSection : rjsReleaseGroup) {
                var tvdSection = parseRef(rjsTvdSection, tvdSectionsMap);
                routeTvdSections.add(tvdSection);
                if (tvdSection == null)
                    throw new InvalidInfraException(String.format(
                            "A release group contains an unknown tvd section (%s)",
                            rjsTvdSection.id
                    ));
                releaseGroup.add(tvdSection);
            }
            releaseGroups.add(releaseGroup);
        }

        var path = new ArrayList<TrackSectionRange>();
        for (var step : rjsRoute.path) {
            var track = parseRef(step.track, infraTrackSections);
            path.add(new TrackSectionRange(track, step.direction, step.begin, step.end));
        }

        // Find switch positions
        var switchesGroup = new HashMap<Switch, String>();
        for (int i = 1; i < path.size(); i++) {
            var prev = path.get(i - 1);
            var next = path.get(i);
            addSwitchPosition(prev, next, trackGraph, switchesGroup);
        }

        var entryPoint = parseRef(rjsRoute.entryPoint, waypointsMap);
        var exitPoint = parseRef(rjsRoute.exitPoint, waypointsMap);

        var entrySignal = detectorIdToSignalNormalMap.getOrDefault(entryPoint.id, null);
        if (path.get(0).direction == EdgeDirection.STOP_TO_START)
            entrySignal = detectorIdToSignalReverseMap.getOrDefault(entryPoint.id, null);

        // TODO simplify makeRoute with the new parameters we have (path)
        routeGraphBuilder.makeRoute(
                rjsRoute.id,
                routeTvdSections,
                releaseGroups,
                switchesGroup,
                entryPoint,
                exitPoint,
                entrySignal,
                path.get(0).direction
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
                            parseRef(port.track, infraTrackSections),
                            port.endpoint
                    )
            );
        }
        var switchType = parseRef(rjsSwitch.switchType, switchTypeMap);
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

    private static <T extends Identified, U> U parseRef(
            ObjectRef<T> ref,
            Map<String, U> cachedObjects
    ) {
        // TODO check typing + presence
        return cachedObjects.get(ref.id.id);
    }
}
