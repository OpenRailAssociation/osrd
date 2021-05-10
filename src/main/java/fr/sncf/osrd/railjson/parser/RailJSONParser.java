package fr.sncf.osrd.railjson.parser;

import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;

import com.squareup.moshi.*;
import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.railscript.DependencyBinder;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSBufferStop;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.signaling.*;
import fr.sncf.osrd.infra.railscript.RSExprVisitor;
import fr.sncf.osrd.infra.railscript.RSFunction;
import fr.sncf.osrd.utils.RangeValue;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.infra.trackgraph.*;
import fr.sncf.osrd.infra.railscript.RSExpr;
import okio.BufferedSource;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;

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
            var index = nodeIDs.get(rjsSwitch.base);
            switchNames.put(rjsSwitch.id, trackGraph.makeSwitchNode(index, rjsSwitch.id, switchIndex++,
                    rjsSwitch.positionChangeDelay));
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

        var waypointsMap = new HashMap<String, Waypoint>();

        // create track sections
        var infraTrackSections = new HashMap<String, TrackSection>();
        var signals = new ArrayList<Signal>();
        // Need a unique index for waypoint graph
        int waypointIndex = 0;
        for (var trackSection : railJSON.trackSections) {
            var beginID = nodeIDs.get(trackSection.beginEndpoint());
            var endID = nodeIDs.get(trackSection.endEndpoint());
            var infraTrackSection = trackGraph.makeTrackSection(beginID, endID, trackSection.id,
                    trackSection.length);
            infraTrackSections.put(trackSection.id, infraTrackSection);

            // Parse operational points
            if (trackSection.operationalPoints == null)
                trackSection.operationalPoints = new ArrayList<>();
            for (var rjsOp : trackSection.operationalPoints) {
                var op = trackGraph.operationalPoints.get(rjsOp.ref.id);
                // add the reference from the OperationalPoint to the TrackSection,
                // add from the TrackSection to the OperationalPoint
                op.addRef(infraTrackSection, rjsOp.begin, rjsOp.end);
            }

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
            waypointsBuilder.build();

            // Parse signals
            var signalsBuilder = infraTrackSection.signals.builder();
            if (trackSection.signals == null)
                trackSection.signals = new ArrayList<>();
            for (var rjsSignal : trackSection.signals) {
                var expr = RailScriptExprParser.parseStatefulSignalExpr(aspectsMap, scriptFunctions, rjsSignal.expr);
                var signal = new Signal(
                        signals.size(),
                        rjsSignal.id,
                        expr,
                        rjsSignal.applicableDirection,
                        rjsSignal.sightDistance
                );
                signalsBuilder.add(rjsSignal.position, signal);
                signals.add(signal);
            }
            signalsBuilder.build();
        }

        // Fill switch with their right / left track sections
        for (var rjsSwitch : railJSON.switches) {
            var switchRef = switchNames.get(rjsSwitch.id);
            switchRef.leftTrackSection = infraTrackSections.get(rjsSwitch.left.section.id);
            switchRef.rightTrackSection = infraTrackSections.get(rjsSwitch.right.section.id);
        }

        // link track sections together
        for (var trackSectionLink : railJSON.trackSectionLinks) {
            var begin = trackSectionLink.begin;
            var end = trackSectionLink.end;
            var beginEdge = infraTrackSections.get(begin.section.id);
            var endEdge = infraTrackSections.get(end.section.id);
            linkEdges(beginEdge, begin.endpoint, endEdge, end.endpoint);
        }

        // Parse TVDSections
        var tvdSectionIndex = 0;
        var tvdSectionsMap = new HashMap<String, TVDSection>();
        for (var rjsonTVD : railJSON.tvdSections) {
            var tvdWaypoints = new ArrayList<Waypoint>();
            findWaypoints(tvdWaypoints, waypointsMap, rjsonTVD.trainDetectors);
            findWaypoints(tvdWaypoints, waypointsMap, rjsonTVD.bufferStops);
            var tvd = new TVDSection(rjsonTVD.id, tvdSectionIndex++, tvdWaypoints, rjsonTVD.isBerthingTrack);
            tvdSectionsMap.put(tvd.id, tvd);
        }

        // build name maps to prepare resolving names in expressions
        var signalNames = new HashMap<String, Signal>();
        for (var signal : signals)
            signalNames.put(signal.id, signal);

        // Build waypoint Graph
        var waypointGraph = Infra.buildWaypointGraph(trackGraph, tvdSectionsMap);

        // Build route Graph
        var routeGraph = new RouteGraph.Builder(waypointGraph);

        for (var rjsRoute : railJSON.routes) {
            // Parse release groups
            var releaseGroups = new ArrayList<SortedArraySet<TVDSection>>();
            var tvdSections = new SortedArraySet<TVDSection>();
            for (var rjsReleaseGroup : rjsRoute.releaseGroups) {
                var releaseGroup = new SortedArraySet<TVDSection>();
                for (var rjsTvdSection : rjsReleaseGroup) {
                    var tvdSection = tvdSectionsMap.get(rjsTvdSection.id);
                    tvdSections.add(tvdSection);
                    if (tvdSection == null)
                        throw new InvalidInfraException(String.format(
                                "A release group contains an unknown tvd section (%s)",
                                rjsTvdSection.id
                        ));
                    releaseGroup.add(tvdSection);
                }
                releaseGroups.add(releaseGroup);
            }

            var switchesPosition = new HashMap<Switch, SwitchPosition>();
            for (var switchPos : rjsRoute.switchesPosition.entrySet()) {
                var switchRef = switchNames.get(switchPos.getKey().id);
                var position = switchPos.getValue().parse();
                switchesPosition.put(switchRef, position);
            }

            var entryPoint = waypointsMap.get(rjsRoute.entryPoint.id);

            routeGraph.makeRoute(rjsRoute.id, tvdSections, releaseGroups, switchesPosition, entryPoint);
        }

        var routeNames = new HashMap<String, Route>();
        for (var route : routeGraph.routeGraph.iterEdges())
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

        return Infra.build(trackGraph, waypointGraph, routeGraph.build(),
                tvdSectionsMap, aspectsMap, signals, switches);
    }

    private static <E extends RJSRouteWaypoint> void findWaypoints(
            ArrayList<Waypoint> foundWaypoints,
            HashMap<String, Waypoint> waypointHashMap,
            Collection<ID<E>> source
    ) throws InvalidInfraException {
        for (var waypointID : source) {
            var waypoint = waypointHashMap.get(waypointID.id);
            if (waypoint == null)
                throw new InvalidInfraException(String.format("cannot find waypoint %s", waypointID.id));
            foundWaypoints.add(waypoint);
        }
    }
}
