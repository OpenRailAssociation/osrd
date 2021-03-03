package fr.sncf.osrd.infra.railjson;

import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;

import com.squareup.moshi.*;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.RJSRoot;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalExpr;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalExprType;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalFunction;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSBufferStop;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSTrackObject;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSTrainDetector;
import fr.sncf.osrd.infra.railjson.schema.trackranges.RJSTrackRange;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.signaling.*;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.infra.trackgraph.*;
import fr.sncf.osrd.utils.PointSequence;
import fr.sncf.osrd.utils.RangeSequence;
import okio.BufferedSource;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;

public class RailJSONParser {
    private static final class TrackRangeAttrBuilder<T> {
        private final RangeSequence.Builder<T>[] builders;

        @SuppressWarnings({"unchecked", "rawtypes"})
        TrackRangeAttrBuilder(TrackSection trackSection, RangeAttrGetter<T> getter) {
            this.builders = new RangeSequence.Builder[]{
                    getter.getAttr(trackSection, EdgeDirection.START_TO_STOP).builder(),
                    getter.getAttr(trackSection, EdgeDirection.STOP_TO_START).builder(),
            };
        }

        void add(RJSTrackRange range, T value) {
            var navigability = range.getNavigability();
            for (var direction : navigability.directionSet) {
                var builder = builders[direction.id];
                builder.add(range.begin, range.end, value);
            }
        }

        void build() throws InvalidInfraException {
            for (var builder : builders)
                builder.build();
        }
    }

    @SuppressWarnings("unchecked")
    private static final class TrackPointAttrBuilder<T> {
        private final PointSequence.Builder<T>[] builders;

        @SuppressWarnings({"unchecked", "rawtypes"})
        TrackPointAttrBuilder(TrackSection trackSection, PointAttrGetter<T> getter) {
            this.builders = new PointSequence.Builder[]{
                    getter.getAttr(trackSection, EdgeDirection.START_TO_STOP).builder(),
                    getter.getAttr(trackSection, EdgeDirection.STOP_TO_START).builder(),
            };
        }

        void add(RJSTrackObject object, T value) {
            var navigability = object.getNavigability();
            for (var direction : navigability.directionSet) {
                var builder = builders[direction.id];
                builder.add(object.position, value);
            }
        }

        void build() throws InvalidInfraException {
            for (var builder : builders)
                builder.build();
        }
    }

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
        var railJSON = RJSRoot.adapter.fromJson(jsonReader);
        if (railJSON == null)
            throw new InvalidInfraException("the railJSON source does not contain any data");
        return RailJSONParser.parse(railJSON);
    }

    /**
     * Parses a structured railJSON into the internal representation
     * @param railJSON a railJSON infrastructure
     * @return an OSRD infrastructure
     */
    public static Infra parse(RJSRoot railJSON) throws InvalidInfraException {
        var trackGraph = new TrackGraph();
        var tvdSectionsMap = new HashMap<String, TVDSection>();
        var aspectsMap = new HashMap<String, Aspect>();

        // register operational points
        for (var operationalPoint : railJSON.operationalPoints) {
            var op = new OperationalPoint(operationalPoint.id);
            trackGraph.operationalPoints.put(op.id, op);
        }

        // create a unique identifier for all track intersection nodes
        var nodeIDs = TrackNodeIDs.from(railJSON.trackSectionLinks, railJSON.trackSections);
        trackGraph.resizeNodes(nodeIDs.numberOfNodes);

        // TODO: parse switches

        // fill nodes with placeholders
        for (int i = 0; i < nodeIDs.numberOfNodes; i++)
            if (trackGraph.getNode(i) == null)
                trackGraph.makePlaceholderNode(i, String.valueOf(i));

        // parse aspects
        for (var rjsAspect : railJSON.aspects) {
            var aspect = new Aspect(rjsAspect.id);
            aspectsMap.put(aspect.id, aspect);
        }

        // parse signal functions
        var signalFunctions = new HashMap<String, SignalFunction>();
        for (var rjsSignalFunction : railJSON.signalFunctions) {
            var signalFunction = parseSignalFunction(aspectsMap, rjsSignalFunction);
            signalFunctions.put(signalFunction.functionName, signalFunction);
        }

        var waypointsMap = new HashMap<String, Waypoint>();

        // create track sections
        var infraTrackSections = new HashMap<String, TrackSection>();
        for (var trackSection : railJSON.trackSections) {
            var beginID = nodeIDs.get(trackSection.beginEndpoint());
            var endID = nodeIDs.get(trackSection.endEndpoint());
            var infraTrackSection = trackGraph.makeTrackSection(beginID, endID, trackSection.id,
                    trackSection.length);
            infraTrackSections.put(trackSection.id, infraTrackSection);

            for (var rjsOp : trackSection.operationalPoints) {
                var op = trackGraph.operationalPoints.get(rjsOp.ref.id);
                // add the reference from the OperationalPoint to the TrackSection,
                // add from the TrackSection to the OperationalPoint
                op.addRef(infraTrackSection, rjsOp.begin, rjsOp.end);
            }

            // Parse waypoints
            var waypointsBuilder = infraTrackSection.waypoints.builder();
            // Need a unique index for waypoint graph
            int index = 0;
            for (var rjsRouteWaypoint : trackSection.routeWaypoints) {
                if (rjsRouteWaypoint.getClass() == RJSTrainDetector.class) {
                    var detector = new Detector(index, rjsRouteWaypoint.id);
                    waypointsMap.put(detector.id, detector);
                    waypointsBuilder.add(rjsRouteWaypoint.position, detector);
                } else if (rjsRouteWaypoint.getClass() == RJSBufferStop.class) {
                    var bufferStop = new BufferStop(index, rjsRouteWaypoint.id);
                    waypointsMap.put(bufferStop.id, bufferStop);
                    waypointsBuilder.add(rjsRouteWaypoint.position, bufferStop);

                }
                index++;
            }
            waypointsBuilder.build();

            // Parse signals
            var signalsBuilder = infraTrackSection.signals.builder();
            for (var rjsSignal : trackSection.signals) {
                var function = signalFunctions.get(rjsSignal.evaluationFunction.id);
                // find the entity associated with each argument, by name
                var argc = function.argumentNames.length;
                var arguments = new String[argc];
                for (int i = 0; i < argc; i++)
                    arguments[i] = rjsSignal.arguments.get(function.argumentNames[i]).id;
                var signal = new Signal(rjsSignal.id, function, arguments);
                signalsBuilder.add(rjsSignal.position, signal);
            }
            signalsBuilder.build();
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
        for (var rjsonTVD : railJSON.tvdSections) {
            var tvdWaypoints = new ArrayList<Waypoint>();
            findWaypoints(tvdWaypoints, waypointsMap, rjsonTVD.trainDetectors);
            findWaypoints(tvdWaypoints, waypointsMap, rjsonTVD.bufferStops);
            var tvd = new TVDSection(rjsonTVD.id, tvdWaypoints, rjsonTVD.isBerthingTrack);
            tvdSectionsMap.put(tvd.id, tvd);
        }

        // Build waypoint Graph
        var waypointGraph = Infra.buildWaypointGraph(trackGraph, tvdSectionsMap);

        // Build route Graph
        var routeGraph = new RouteGraph.Builder(waypointGraph);

        for (var rjsRoute : railJSON.routes) {
            var waypoints = new ArrayList<Waypoint>();
            for (var waypoint : rjsRoute.waypoints)
                waypoints.add(waypointsMap.get(waypoint.id));
            var tvdSections = new SortedArraySet<TVDSection>();
            for (var tvdSection : rjsRoute.tvdSections)
                tvdSections.add(tvdSectionsMap.get(tvdSection.id));
            routeGraph.makeRoute(rjsRoute.id, waypoints, tvdSections);
        }

        return new Infra(trackGraph, waypointGraph, routeGraph.build(), tvdSectionsMap, aspectsMap);
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

    private static SignalFunction parseSignalFunction(
            HashMap<String, Aspect> aspectsMap,
            RJSSignalFunction rjsSignalFunction
    ) throws InvalidInfraException {
        var arguments = rjsSignalFunction.arguments;

        var expr = parseSignalExpr(aspectsMap, arguments, rjsSignalFunction.body);

        // type check rules
        var argumentTypes = new SignalExprType[arguments.length];
        var argumentNames = new String[arguments.length];
        for (int i = 0; i < arguments.length; i++) {
            argumentNames[i] = arguments[i].name;
            argumentTypes[i] = parseExprType(arguments[i].type);
        }

        return SignalFunction.from(
                rjsSignalFunction.name,
                argumentNames,
                argumentTypes,
                parseExprType(rjsSignalFunction.returnsType),
                expr
        );
    }

    private static SignalExprType parseExprType(RJSSignalExprType type) {
        switch (type) {
            case BOOLEAN:
                return SignalExprType.BOOLEAN;
            case SIGNAL:
                return SignalExprType.SIGNAL;
            case ASPECT_SET:
                return SignalExprType.ASPECT_SET;
        }
        throw new RuntimeException("unknown RJSSignalExprType");
    }

    private static int findArgIndex(
            RJSSignalFunction.Argument[] arguments,
            String argument
    ) throws InvalidInfraException {
        for (int i = 0; i < arguments.length; i++)
            if (arguments[i].name.equals(argument))
                return i;

        throw new InvalidInfraException(String.format("signal function argument not found: %s", argument));
    }

    private static SignalExpr parseSignalExpr(
            HashMap<String, Aspect> aspectsMap,
            RJSSignalFunction.Argument[] arguments,
            RJSSignalExpr expr
    ) throws InvalidInfraException {
        var type = expr.getClass();

        // boolean operators
        if (type == RJSSignalExpr.OrExpr.class)
            return new SignalExpr.OrExpr(parseInfixOp(aspectsMap, arguments, (RJSSignalExpr.InfixOpExpr) expr));
        if (type == RJSSignalExpr.AndExpr.class)
            return new SignalExpr.AndExpr(parseInfixOp(aspectsMap, arguments, (RJSSignalExpr.InfixOpExpr) expr));
        if (type == RJSSignalExpr.NotExpr.class) {
            var notExpr = (RJSSignalExpr.NotExpr) expr;
            return new SignalExpr.NotExpr(parseSignalExpr(aspectsMap, arguments, notExpr.expr));
        }

        // value constructors
        if (type == RJSSignalExpr.TrueExpr.class)
            return new SignalExpr.TrueExpr();
        if (type == RJSSignalExpr.FalseExpr.class)
            return new SignalExpr.FalseExpr();
        // TODO aspectset

        // control flow
        if (type == RJSSignalExpr.IfExpr.class) {
            var ifExpr = (RJSSignalExpr.IfExpr) expr;
            var condition = parseSignalExpr(aspectsMap, arguments, ifExpr.condition);
            var branchTrue = parseSignalExpr(aspectsMap, arguments, ifExpr.branchTrue);
            var branchFalse = parseSignalExpr(aspectsMap, arguments, ifExpr.branchFalse);
            return new SignalExpr.IfExpr(condition, branchTrue, branchFalse);
        }

        // function-specific
        // TODO

        // signals
        if (type == RJSSignalExpr.SignalAspectCheckExpr.class) {
            var signalExpr = (RJSSignalExpr.SignalAspectCheckExpr) expr;
            var aspect = aspectsMap.get(signalExpr.aspect.id);
            var signal = parseSignalExpr(aspectsMap, arguments, signalExpr.signal);
            return new SignalExpr.SignalAspectCheckExpr(signal, aspect);
        }

        throw new InvalidInfraException("unsupported signal expression");
    }

    private static SignalExpr[] parseInfixOp(
            HashMap<String, Aspect> aspectsMap,
            RJSSignalFunction.Argument[] arguments,
            RJSSignalExpr.InfixOpExpr expr
    ) throws InvalidInfraException {
        var arity = expr.exprs.length;
        var expressions = new SignalExpr[arity];
        for (int i = 0; i < arity; i++)
            expressions[i] = parseSignalExpr(aspectsMap, arguments, expr.exprs[i]);
        return expressions;
    }
}
