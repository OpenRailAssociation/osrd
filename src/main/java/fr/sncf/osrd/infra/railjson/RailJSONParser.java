package fr.sncf.osrd.infra.railjson;

import static fr.sncf.osrd.infra.trackgraph.TrackSection.linkEdges;

import com.squareup.moshi.*;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.railjson.schema.ID;
import fr.sncf.osrd.infra.railjson.schema.RJSRoot;
import fr.sncf.osrd.infra.railjson.schema.RJSRoute;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalExpr;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalExprType;
import fr.sncf.osrd.infra.railjson.schema.signaling.RJSSignalFunction;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSBufferStop;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSRouteWaypoint;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSTrackObject;
import fr.sncf.osrd.infra.railjson.schema.trackobjects.RJSTrainDetector;
import fr.sncf.osrd.infra.railjson.schema.trackranges.RJSTrackRange;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.routegraph.RouteStatus;
import fr.sncf.osrd.infra.signaling.*;
import fr.sncf.osrd.infra.signaling.expr.Expr;
import fr.sncf.osrd.infra.signaling.expr.ExprVisitor;
import fr.sncf.osrd.infra.signaling.expr.value.AspectSet;
import fr.sncf.osrd.infra.signaling.expr.value.BooleanValue;
import fr.sncf.osrd.infra.signaling.expr.value.ValueType;
import fr.sncf.osrd.infra.signaling.expr.Function;
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
        int aspectCount = 0;
        for (var rjsAspect : railJSON.aspects) {
            var aspect = new Aspect(aspectCount++, rjsAspect.id);
            aspectsMap.put(aspect.id, aspect);
        }

        // parse signal functions
        var signalFunctions = new HashMap<String, Function<?>>();
        for (var rjsSignalFunction : railJSON.signalFunctions) {
            var signalFunction = parseSignalFunction(aspectsMap, rjsSignalFunction);
            signalFunctions.put(signalFunction.functionName, signalFunction);
        }

        var waypointsMap = new HashMap<String, Waypoint>();

        // create track sections
        var infraTrackSections = new HashMap<String, TrackSection>();
        var signals = new ArrayList<Signal>();
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
                var expr = parseAspectSetExpr(aspectsMap, null, null, rjsSignal.expr);
                var signal = new Signal(signals.size(), rjsSignal.id, expr);
                signalsBuilder.add(rjsSignal.position, signal);
                signals.add(signal);
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

        // build name maps to prepare resolving names in expressions
        var signalNames = new HashMap<String, Signal>();
        for (var signal : signals)
            signalNames.put(signal.id, signal);

        var routeNames = new HashMap<String, Route>();
        for (var route : routeGraph.routeGraph.iterEdges())
            routeNames.put(route.id, route);

        // resolve names
        var nameResolver = new ExprVisitor() {
            @Override
            public void visit(Expr.SignalRefExpr expr) throws InvalidInfraException {
                expr.resolve(signalNames);
            }

            @Override
            public void visit(Expr.RouteRefExpr expr) throws InvalidInfraException {
                expr.resolve(routeNames);
            }
        };
        for (var function : signalFunctions.values())
            function.body.accept(nameResolver);
        for (var signal : signals)
            signal.expr.accept(nameResolver);

        return new Infra(trackGraph, waypointGraph, routeGraph.build(), tvdSectionsMap, aspectsMap, signals);
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

    private static Function<?> parseSignalFunction(
            HashMap<String, Aspect> aspectsMap,
            RJSSignalFunction rjsSignalFunction
    ) throws InvalidInfraException {
        var arguments = rjsSignalFunction.arguments;

        // type check rules
        var argumentTypes = new ValueType[arguments.length];
        var argumentNames = new String[arguments.length];
        for (int i = 0; i < arguments.length; i++) {
            argumentNames[i] = arguments[i].name;
            argumentTypes[i] = parseExprType(arguments[i].type);
        }

        var expr = parseExpr(aspectsMap, argumentNames, argumentTypes, rjsSignalFunction.body);
        return Function.from(
                rjsSignalFunction.name,
                argumentNames,
                argumentTypes,
                parseExprType(rjsSignalFunction.returnType),
                expr
        );
    }

    private static ValueType parseExprType(RJSSignalExprType type) {
        switch (type) {
            case BOOLEAN:
                return ValueType.BOOLEAN;
            case SIGNAL:
                return ValueType.SIGNAL;
            case ASPECT_SET:
                return ValueType.ASPECT_SET;
        }
        throw new RuntimeException("unknown RJSSignalExprType");
    }

    private static int findArgIndex(
            String[] arguments,
            String argument
    ) throws InvalidInfraException {
        for (int i = 0; i < arguments.length; i++)
            if (arguments[i].equals(argument))
                return i;

        throw new InvalidInfraException(String.format("signal function argument not found: %s", argument));
    }

    private static Expr<?> parseExpr(
            HashMap<String, Aspect> aspectsMap,
            String[] argNames,
            ValueType[] argTypes,
            RJSSignalExpr expr
    ) throws InvalidInfraException {
        var type = expr.getClass();

        // boolean operators
        if (type == RJSSignalExpr.OrExpr.class)
            return new Expr.OrExpr(parseInfixOp(aspectsMap, argNames, argTypes, (RJSSignalExpr.InfixOpExpr) expr));
        if (type == RJSSignalExpr.AndExpr.class)
            return new Expr.AndExpr(parseInfixOp(aspectsMap, argNames, argTypes, (RJSSignalExpr.InfixOpExpr) expr));
        if (type == RJSSignalExpr.NotExpr.class) {
            var notExpr = (RJSSignalExpr.NotExpr) expr;
            return new Expr.NotExpr(parseBooleanExpr(aspectsMap, argNames, argTypes, notExpr.expr));
        }

        // value constructors
        if (type == RJSSignalExpr.TrueExpr.class)
            return Expr.TrueExpr.INSTANCE;
        if (type == RJSSignalExpr.FalseExpr.class)
            return Expr.FalseExpr.INSTANCE;
        if (type == RJSSignalExpr.AspectSetExpr.class)
            return parseAspectSet(aspectsMap, argNames, argTypes, (RJSSignalExpr.AspectSetExpr) expr);
        if (type == RJSSignalExpr.SignalRefExpr.class)
            return new Expr.SignalRefExpr(((RJSSignalExpr.SignalRefExpr) expr).signal.id);
        if (type == RJSSignalExpr.RouteRefExpr.class)
            return new Expr.RouteRefExpr(((RJSSignalExpr.RouteRefExpr) expr).route.id);

        // control flow
        if (type == RJSSignalExpr.IfExpr.class)
            return parseIfExpr(aspectsMap, argNames, argTypes, (RJSSignalExpr.IfExpr) expr);

        // function-specific
        if (type == RJSSignalExpr.ArgumentRefExpr.class) {
            var argumentExpr = (RJSSignalExpr.ArgumentRefExpr) expr;
            var argIndex = findArgIndex(argNames, argumentExpr.argumentName);
            return new Expr.ArgumentRefExpr<>(argIndex);
        }

        // primitives
        if (type == RJSSignalExpr.SignalAspectCheckExpr.class) {
            var signalExpr = (RJSSignalExpr.SignalAspectCheckExpr) expr;
            var aspect = aspectsMap.get(signalExpr.aspect.id);
            var signal = parseSignalExpr(aspectsMap, argNames, argTypes, signalExpr.signal);
            return new Expr.SignalAspectCheckExpr(signal, aspect);
        }
        if (type == RJSSignalExpr.RouteStateCheckExpr.class) {
            var routeStateExpr = (RJSSignalExpr.RouteStateCheckExpr) expr;
            var route = parseRouteExpr(aspectsMap, argNames, argTypes, routeStateExpr.route);
            var routeState = parseRouteState(routeStateExpr.state);
            return new Expr.RouteStateCheckExpr(route, routeState);
        }
        if (type == RJSSignalExpr.AspectSetContainsExpr.class) {
            var aspectSetContainsExpr = (RJSSignalExpr.AspectSetContainsExpr) expr;
            var aspectSet = parseAspectSetExpr(aspectsMap, argNames, argTypes, aspectSetContainsExpr.aspectSet);
            var aspect = aspectsMap.get(aspectSetContainsExpr.aspect.id);
            return new Expr.AspectSetContainsExpr(aspectSet, aspect);
        }

        throw new InvalidInfraException("unsupported signal expression");
    }

    private static RouteStatus parseRouteState(RJSRoute.State state) {
        switch (state) {
            case FREE:
                return RouteStatus.FREE;
            case RESERVED:
                return RouteStatus.RESERVED;
            case OCCUPIED:
                return RouteStatus.OCCUPIED;
        }
        throw new RuntimeException("unsupported RailJSON route state");
    }

    private static Expr<?> parseIfExpr(
            HashMap<String, Aspect> aspectsMap,
            String[] argumentNames,
            ValueType[] argumentTypes,
            RJSSignalExpr.IfExpr ifExpr
    ) throws InvalidInfraException {
        var condition = parseBooleanExpr(aspectsMap, argumentNames, argumentTypes, ifExpr.condition);
        var branchTrue = parseExpr(aspectsMap, argumentNames, argumentTypes, ifExpr.branchTrue);
        var branchFalse = parseExpr(aspectsMap, argumentNames, argumentTypes, ifExpr.branchFalse);
        var branchTrueType = branchTrue.getType(argumentTypes);
        var branchFalseType = branchFalse.getType(argumentTypes);
        if (branchTrueType != branchFalseType)
            throw new InvalidInfraException(String.format(
                    "then branch has type %s but else has type %s", branchTrueType, branchFalseType));

        // typing is dynamically checked
        @SuppressWarnings({"unchecked", "rawtypes"})
        var res = new Expr.IfExpr(condition, branchTrue, branchFalse);
        return res;
    }

    private static Expr<?> parseAspectSet(
            HashMap<String, Aspect> aspectsMap,
            String[] argumentNames,
            ValueType[] argumentTypes,
            RJSSignalExpr.AspectSetExpr expr
    ) throws InvalidInfraException {
        var memberCount = expr.members.length;
        var aspects = new Aspect[memberCount];
        @SuppressWarnings("unchecked")
        Expr<BooleanValue>[] conditions = (Expr<BooleanValue>[]) new Expr<?>[memberCount];

        for (int i = 0; i < memberCount; i++) {
            var member = expr.members[i];
            aspects[i] = aspectsMap.get(member.aspect.id);
            if (member.condition != null)
                conditions[i] = parseBooleanExpr(aspectsMap, argumentNames, argumentTypes, member.condition);
        }

        return new Expr.AspectSetExpr(aspects, conditions);
    }

    private static void checkExprType(
            ValueType expectedType,
            ValueType[] argumentTypes,
            Expr<?> expr
    ) throws InvalidInfraException {
        var exprType = expr.getType(argumentTypes);
        if (exprType != expectedType)
            throw new InvalidInfraException(String.format(
                    "type mismatch: expected %s, got %s", expectedType.toString(), exprType.toString()));
    }

    @SuppressWarnings("unchecked")
    private static Expr<BooleanValue> parseBooleanExpr(
            HashMap<String, Aspect> aspectsMap,
            String[] argumentNames,
            ValueType[] argumentTypes,
            RJSSignalExpr rjsExpr
    ) throws InvalidInfraException {
        Expr<?> expr = parseExpr(aspectsMap, argumentNames, argumentTypes, rjsExpr);
        checkExprType(ValueType.BOOLEAN, argumentTypes, expr);
        return (Expr<BooleanValue>) expr;
    }

    @SuppressWarnings("unchecked")
    private static Expr<Signal.State> parseSignalExpr(
            HashMap<String, Aspect> aspectsMap,
            String[] argumentNames,
            ValueType[] argumentTypes,
            RJSSignalExpr rjsExpr
    ) throws InvalidInfraException {
        Expr<?> expr = parseExpr(aspectsMap, argumentNames, argumentTypes, rjsExpr);
        checkExprType(ValueType.SIGNAL, argumentTypes, expr);
        return (Expr<Signal.State>) expr;
    }

    @SuppressWarnings("unchecked")
    private static Expr<Route.State> parseRouteExpr(
            HashMap<String, Aspect> aspectsMap,
            String[] argumentNames,
            ValueType[] argumentTypes,
            RJSSignalExpr rjsExpr
    ) throws InvalidInfraException {
        Expr<?> expr = parseExpr(aspectsMap, argumentNames, argumentTypes, rjsExpr);
        checkExprType(ValueType.ROUTE, argumentTypes, expr);
        return (Expr<Route.State>) expr;
    }

    @SuppressWarnings("unchecked")
    private static Expr<AspectSet> parseAspectSetExpr(
            HashMap<String, Aspect> aspectsMap,
            String[] argumentNames,
            ValueType[] argumentTypes,
            RJSSignalExpr rjsExpr
    ) throws InvalidInfraException {
        Expr<?> expr = parseExpr(aspectsMap, argumentNames, argumentTypes, rjsExpr);
        checkExprType(ValueType.ASPECT_SET, argumentTypes, expr);
        return (Expr<AspectSet>) expr;
    }

    private static Expr<BooleanValue>[] parseInfixOp(
            HashMap<String, Aspect> aspectsMap,
            String[] argumentNames,
            ValueType[] argumentTypes,
            RJSSignalExpr.InfixOpExpr expr
    ) throws InvalidInfraException {
        var arity = expr.exprs.length;
        @SuppressWarnings("unchecked")
        var expressions = (Expr<BooleanValue>[]) new Expr<?>[arity];
        for (int i = 0; i < arity; i++)
            expressions[i] = parseBooleanExpr(aspectsMap, argumentNames, argumentTypes, expr.exprs[i]);
        return expressions;
    }
}
