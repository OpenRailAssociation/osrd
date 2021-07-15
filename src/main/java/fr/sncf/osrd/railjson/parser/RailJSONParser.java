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
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.RJSTVDSection;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSBufferStop;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSTrackRange;
import fr.sncf.osrd.utils.DoubleRangeMap;
import fr.sncf.osrd.utils.RangeValue;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.graph.ApplicableDirection;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import okio.BufferedSource;
import java.io.IOException;
import java.util.*;
import java.util.stream.Collector;
import java.util.stream.Collectors;

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
        var trackGraph = new TrackGraph();

        // register operational points
        for (var operationalPoint : railJSON.operationalPoints) {
            var op = new OperationalPoint(operationalPoint.id);
            trackGraph.operationalPoints.put(op.id, op);
        }

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

        // parse speed sections
        var speedSections = new HashMap<String, SpeedSection>();
        for (var rjsSpeedSection : railJSON.speedSections) {
            var speedSection = new SpeedSection(rjsSpeedSection.isSignalized, rjsSpeedSection.speed);
            speedSections.put(rjsSpeedSection.id, speedSection);
        }

        // parse electrical profile types
        var catenaryTypes = new HashMap<String, CatenaryType>();
        for (var rjsCatenaryType : railJSON.catenaryTypes) {
            var catenaryType = new CatenaryType(rjsCatenaryType.type, rjsCatenaryType.voltage);
            catenaryTypes.put(rjsCatenaryType.id, catenaryType);
        }

        var waypointsMap = new HashMap<String, Waypoint>();
        var detectorIdToSignalNormalMap = new HashMap<String, Signal>();
        var detectorIdToSignalReverseMap = new HashMap<String, Signal>();

        // create track sections
        var infraTrackSections = new HashMap<String, TrackSection>();
        var signals = new ArrayList<Signal>();
        // Need a unique index for waypoint graph
        int waypointIndex = 0;
        for (var trackSection : railJSON.trackSections) {
            var beginID = nodeIDs.get(trackSection.beginEndpoint());
            var endID = nodeIDs.get(trackSection.endEndpoint());
            var infraTrackSection = trackGraph.makeTrackSection(beginID, endID, trackSection.id,
                    trackSection.length, trackSection.endpointCoords);
            infraTrackSections.put(trackSection.id, infraTrackSection);

            // Parse operational points
            if (trackSection.operationalPoints == null)
                trackSection.operationalPoints = new ArrayList<>();
            var opBuilder = infraTrackSection.operationalPoints.builder();
            for (var rjsOp : trackSection.operationalPoints) {
                var op = trackGraph.operationalPoints.get(rjsOp.ref.id);
                // add the reference from the OperationalPoint to the TrackSection,
                // add from the TrackSection to the OperationalPoint
                op.addRef(infraTrackSection, rjsOp.position, opBuilder);
            }
            opBuilder.build();

            // Parse speed limits
            if (trackSection.speedSections == null)
                trackSection.speedSections = new ArrayList<>();
            for (var rjsSpeedLimits : trackSection.speedSections) {
                var speedSection = speedSections.get(rjsSpeedLimits.ref.id);
                var rangeSpeedLimit = new RangeValue<>(rjsSpeedLimits.begin, rjsSpeedLimits.end, speedSection);
                if (rjsSpeedLimits.applicableDirection.appliesToNormal())
                    infraTrackSection.forwardSpeedSections.add(rangeSpeedLimit);
                if (rjsSpeedLimits.applicableDirection.appliesToReverse())
                    infraTrackSection.backwardSpeedSections.add(rangeSpeedLimit);
            }

            // Parser the type of electrical profile in the TrackSection
            if (trackSection.catenarySections == null)
                trackSection.catenarySections = new ArrayList<>();
            for (var rjsCatenarySections : trackSection.catenarySections) {
                var catenarySection = catenaryTypes.get(rjsCatenarySections.ref.id);
                var rangeCatenarySection = new RangeValue<>(rjsCatenarySections.begin, rjsCatenarySections.end, catenarySection);
                if (rjsCatenarySections.applicableDirection.appliesToNormal())
                    infraTrackSection.forwardCatenarySections.add(rangeCatenarySection);
                if (rjsCatenarySections.applicableDirection.appliesToReverse())
                    infraTrackSection.backwardCatenarySections.add(rangeCatenarySection);
            }

            // Parse waypoints
            var waypointsBuilder = infraTrackSection.waypoints.builder();
            if (trackSection.routeWaypoints == null)
                trackSection.routeWaypoints = new ArrayList<>();
            for (var rjsRouteWaypoint : trackSection.routeWaypoints) {
                if (rjsRouteWaypoint.getClass() == RJSTrainDetector.class) {
                    var detector = new Detector(waypointIndex, rjsRouteWaypoint.id);
                    waypointsMap.put(detector.id, detector);
                    waypointsBuilder.add(rjsRouteWaypoint.position, detector);
                } else if (rjsRouteWaypoint.getClass() == RJSBufferStop.class) {
                    var bufferStop = new BufferStop(waypointIndex, rjsRouteWaypoint.id);
                    waypointsMap.put(bufferStop.id, bufferStop);
                    waypointsBuilder.add(rjsRouteWaypoint.position, bufferStop);
                }
                waypointIndex++;
            }

            waypointsBuilder.buildUnique((duplicates) -> {
                var ids = duplicates.stream().map(e -> e.id).collect(Collectors.joining(", "));
                throw new InvalidInfraException("duplicate waypoints " + ids);
            });

            // Parse signals
            var signalsBuilder = infraTrackSection.signals.builder();
            if (trackSection.signals == null)
                trackSection.signals = new ArrayList<>();

            for (var rjsSignal : trackSection.signals) {

                if (rjsSignal.applicableDirection == ApplicableDirection.BOTH) {
                    throw new InvalidInfraException("A signal cannot be applicable in both directions.");
                }

                EdgeDirection direction = null;
                if (rjsSignal.applicableDirection == ApplicableDirection.NORMAL) {
                    direction = EdgeDirection.START_TO_STOP;
                } else {
                    direction = EdgeDirection.STOP_TO_START;
                }

                var expr = RailScriptExprParser.parseStatefulSignalExpr(aspectsMap, scriptFunctions, rjsSignal.expr);

                // get linked detector
                Detector linkedDetector = null;
                if (rjsSignal.linkedDetector != null)
                    linkedDetector = (Detector) waypointsMap.get(rjsSignal.linkedDetector.id);

                var signal = new Signal(
                        signals.size(),
                        rjsSignal.id,
                        expr,
                        direction,
                        rjsSignal.sightDistance,
                        linkedDetector
                );
                signalsBuilder.add(rjsSignal.position, signal);
                signals.add(signal);
                if (rjsSignal.linkedDetector != null) {
                    if (rjsSignal.applicableDirection == ApplicableDirection.NORMAL)
                        detectorIdToSignalNormalMap.put(rjsSignal.linkedDetector.id, signal);
                    else if (rjsSignal.applicableDirection == ApplicableDirection.REVERSE)
                        detectorIdToSignalReverseMap.put(rjsSignal.linkedDetector.id, signal);
                }
            }
            signalsBuilder.build();

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
        }

        // Fill switch ports (ie connected track section endpoints)
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
                        infraTrackSections.get(port.section.id),
                        port.endpoint
                ));
            }
        }

        // Fill switch groups
        for (var rjsSwitch : railJSON.switches) {
            var switchRef = switchNames.get(rjsSwitch.id);
            var portMap = new HashMap<String, Switch.Port>();
            for (var entry : rjsSwitch.ports.entrySet()) {
                var portName = entry.getKey();
                var port = entry.getValue();
                portMap.put(
                        portName,
                        new Switch.Port(
                            portName,
                            infraTrackSections.get(port.section.id),
                            port.endpoint
                        )
                );
            }
            for (var entry : railJSON.switchTypes.get(rjsSwitch.switchType).groups.entrySet()) {
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
        }

        // link track sections together
        for (var trackSectionLink : railJSON.trackSectionLinks) {
            var begin = trackSectionLink.begin;
            var end = trackSectionLink.end;
            var beginEdge = infraTrackSections.get(begin.section.id);
            var endEdge = infraTrackSections.get(end.section.id);
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

        for (var rjsRoute : railJSON.routes) {
            // Parse release groups
            var releaseGroups = new ArrayList<SortedArraySet<TVDSection>>();
            var routeTvdSections = new SortedArraySet<TVDSection>();
            for (var rjsReleaseGroup : rjsRoute.releaseGroups) {
                var releaseGroup = new SortedArraySet<TVDSection>();
                for (var rjsTvdSection : rjsReleaseGroup) {
                    var tvdSection = tvdSectionsMap.get(rjsTvdSection.id);
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

            var switchesGroup = new HashMap<Switch, String>();
            for (var switchGrp : rjsRoute.switchesGroup.entrySet()) {
                var switchRef = switchNames.get(switchGrp.getKey().id);
                var group = switchGrp.getValue();
                if (!switchRef.groups.containsKey(group)) {
                    throw new InvalidInfraException("This group is not compatible with this switch");
                }
                switchesGroup.put(switchRef, group);
            }

            var entryPoint = waypointsMap.get(rjsRoute.entryPoint.id);
            var exitPoint = waypointsMap.get(rjsRoute.exitPoint.id);

            var entrySignal = detectorIdToSignalNormalMap.getOrDefault(entryPoint.id, null);
            if (rjsRoute.entryDirection == EdgeDirection.STOP_TO_START)
                entrySignal = detectorIdToSignalReverseMap.getOrDefault(entryPoint.id, null);

            routeGraphBuilder.makeRoute(
                    rjsRoute.id,
                    routeTvdSections,
                    releaseGroups,
                    switchesGroup,
                    entryPoint,
                    exitPoint,
                    entrySignal,
                    rjsRoute.entryDirection
            );
        }

        var routeGraph = routeGraphBuilder.build();

        var routeNames = new HashMap<String, Route>();
        for (var route : routeGraph.iterEdges())
            routeNames.put(route.id, route);

        // resolve names of routes and signals
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

        return Infra.build(trackGraph, routeGraphBuilder.build(),
                tvdSectionsMap, aspectsMap, signals, switches);
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
                indexKeys.add(waypointMap.get(rjsDetector.id).index);
            for (var rjsBufferStop : rjsTVD.bufferStops)
                indexKeys.add(waypointMap.get(rjsBufferStop.id).index);
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
}
