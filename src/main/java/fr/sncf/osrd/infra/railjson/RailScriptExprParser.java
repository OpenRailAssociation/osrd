package fr.sncf.osrd.infra.railjson;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railjson.schema.RJSRoute;
import fr.sncf.osrd.infra.railjson.schema.railscript.RJSRSExpr;
import fr.sncf.osrd.infra.railjson.schema.railscript.RJSRSFunction;
import fr.sncf.osrd.infra.railjson.schema.railscript.RJSRSType;
import fr.sncf.osrd.infra.railscript.RSExpr;
import fr.sncf.osrd.infra.railscript.RSFunction;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra.railscript.value.RSBool;
import fr.sncf.osrd.infra.railscript.value.RSType;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.routegraph.RouteStatus;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.Signal;

import java.util.HashMap;

public class RailScriptExprParser {
    private final HashMap<String, Aspect> aspectsMap;
    private final HashMap<String, RSFunction<?>> scriptFunctions;
    private final String[] argNames;
    private final RSType[] argTypes;

    /** The number of slots required to evaluate the function */
    public int slotsCount = 0;

    /** Allocates some slots */
    public int reserveSlots(int newSlots) {
        var slotRangeStart = slotsCount;
        slotsCount += newSlots;
        return slotRangeStart;
    }

    private RailScriptExprParser(
            HashMap<String, Aspect> aspectsMap,
            HashMap<String, RSFunction<?>> scriptFunctions,
            String[] argNames,
            RSType[] argTypes
    ) {
        this.aspectsMap = aspectsMap;
        this.scriptFunctions = scriptFunctions;
        this.argNames = argNames;
        this.argTypes = argTypes;
    }

    public RailScriptExprParser(HashMap<String, Aspect> aspectsMap, HashMap<String, RSFunction<?>> scriptFunctions) {
        this(aspectsMap, scriptFunctions, null, null);
    }

    /** Parse a serialize Json function */
    public static RSFunction<?> parseFunction(
            HashMap<String, Aspect> aspectsMap,
            HashMap<String, RSFunction<?>> scriptFunctions,
            RJSRSFunction rjsSignalFunction
    ) throws InvalidInfraException {
        var arguments = rjsSignalFunction.arguments;

        // type check rules
        var argumentTypes = new RSType[arguments.length];
        var argumentNames = new String[arguments.length];
        for (int i = 0; i < arguments.length; i++) {
            argumentNames[i] = arguments[i].name;
            argumentTypes[i] = parseExprType(arguments[i].type);
        }

        var parser = new RailScriptExprParser(aspectsMap, scriptFunctions, argumentNames, argumentTypes);

        // reserve slots for arguments before parsing
        parser.reserveSlots(arguments.length);

        var expr = parser.parse(rjsSignalFunction.body);
        return RSFunction.from(
                rjsSignalFunction.name,
                argumentNames,
                argumentTypes,
                parseExprType(rjsSignalFunction.returnType),
                expr,
                parser.slotsCount
        );
    }

    private static RSType parseExprType(RJSRSType type) {
        switch (type) {
            case BOOLEAN:
                return RSType.BOOLEAN;
            case SIGNAL:
                return RSType.SIGNAL;
            case ROUTE:
                return RSType.ROUTE;
            case ASPECT_SET:
                return RSType.ASPECT_SET;
        }
        throw new RuntimeException("unknown RJSSignalExprType");
    }

    private int findArgIndex(String argument) throws InvalidInfraException {
        for (int i = 0; i < argNames.length; i++)
            if (argNames[i].equals(argument))
                return i;

        throw new InvalidInfraException(String.format("signal function argument not found: %s", argument));
    }

    /** Turns a Json serialized expression into its runnable counterpart */
    @SuppressFBWarnings({"BC_UNCONFIRMED_CASTgit "})
    public RSExpr<?> parse(RJSRSExpr expr) throws InvalidInfraException {
        var type = expr.getClass();

        // boolean operators
        if (type == RJSRSExpr.Or.class)
            return new RSExpr.Or(parseInfixOp((RJSRSExpr.InfixOp) expr));
        if (type == RJSRSExpr.And.class)
            return new RSExpr.And(parseInfixOp((RJSRSExpr.InfixOp) expr));
        if (type == RJSRSExpr.Not.class) {
            var notExpr = (RJSRSExpr.Not) expr;
            return new RSExpr.Not(parseBooleanExpr(notExpr.expr));
        }

        // value constructors
        if (type == RJSRSExpr.True.class)
            return RSExpr.True.INSTANCE;
        if (type == RJSRSExpr.False.class)
            return RSExpr.False.INSTANCE;
        if (type == RJSRSExpr.AspectSet.class)
            return parseAspectSet((RJSRSExpr.AspectSet) expr);
        if (type == RJSRSExpr.SignalRef.class)
            return new RSExpr.SignalRef(((RJSRSExpr.SignalRef) expr).signal.id);
        if (type == RJSRSExpr.RouteRef.class)
            return new RSExpr.RouteRef(((RJSRSExpr.RouteRef) expr).route.id);

        // control flow
        if (type == RJSRSExpr.If.class)
            return parseIfExpr((RJSRSExpr.If) expr);
        if (type == RJSRSExpr.Call.class) {
            return parseCallExpr((RJSRSExpr.Call) expr);
        }

        // function-specific
        if (type == RJSRSExpr.ArgumentRef.class) {
            var argumentExpr = (RJSRSExpr.ArgumentRef) expr;
            // if the function has arguments, its argument slots are the first in line
            var argIndex = findArgIndex(argumentExpr.argumentName);
            return new RSExpr.ArgumentRef<>(argIndex);
        }

        // primitives
        if (type == RJSRSExpr.Delay.class) {
            var delayExpr = (RJSRSExpr.Delay) expr;
            var delaySlotIndex = reserveSlots(1);
            return new RSExpr.Delay<>(delayExpr.duration, parse(delayExpr.expr), delaySlotIndex);
        }
        if (type == RJSRSExpr.SignalAspectCheck.class) {
            var signalExpr = (RJSRSExpr.SignalAspectCheck) expr;
            var aspect = aspectsMap.get(signalExpr.aspect.id);
            var signal = parseSignalExpr(signalExpr.signal);
            return new RSExpr.SignalAspectCheck(signal, aspect);
        }
        if (type == RJSRSExpr.RouteStateCheck.class) {
            var routeStateExpr = (RJSRSExpr.RouteStateCheck) expr;
            var route = parseRouteExpr(routeStateExpr.route);
            var routeState = parseRouteState(routeStateExpr.state);
            return new RSExpr.RouteStateCheck(route, routeState);
        }
        if (type == RJSRSExpr.AspectSetContains.class) {
            var aspectSetContainsExpr = (RJSRSExpr.AspectSetContains) expr;
            var aspectSet = parseAspectSetExpr(aspectSetContainsExpr.aspectSet);
            var aspect = aspectsMap.get(aspectSetContainsExpr.aspect.id);
            return new RSExpr.AspectSetContains(aspectSet, aspect);
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

    private RSExpr<?> parseIfExpr(RJSRSExpr.If ifExpr) throws InvalidInfraException {
        var condition = parseBooleanExpr(ifExpr.condition);
        var branchTrue = parse(ifExpr.branchTrue);
        var branchFalse = parse(ifExpr.branchFalse);
        var branchTrueType = branchTrue.getType(argTypes);
        var branchFalseType = branchFalse.getType(argTypes);
        if (branchTrueType != branchFalseType)
            throw new InvalidInfraException(String.format(
                    "then branch has type %s but else has type %s", branchTrueType, branchFalseType));

        // typing is dynamically checked
        @SuppressWarnings({"unchecked", "rawtypes"})
        var res = new RSExpr.If(condition, branchTrue, branchFalse);
        return res;
    }

    private RSExpr<?> parseCallExpr(RJSRSExpr.Call expr) throws InvalidInfraException {
        // parse the arguments
        var rjsArgs = expr.arguments;
        var args = new RSExpr<?>[rjsArgs.length];
        for (int i = 0; i < rjsArgs.length; i++)
            args[i] = parse(rjsArgs[i]);

        // get the function
        var function = scriptFunctions.get(expr.function.id);

        // reserve enough slots for the function, and store the slot offset
        var callOffset = reserveSlots(function.slotsCount);
        return new RSExpr.Call<>(function, args, callOffset);
    }

    private RSExpr<RSAspectSet> parseAspectSet(RJSRSExpr.AspectSet expr) throws InvalidInfraException {
        var memberCount = expr.members.length;
        var aspects = new Aspect[memberCount];
        @SuppressWarnings({"unchecked"})
        var conditions = (RSExpr<RSBool>[]) new RSExpr<?>[memberCount];

        for (int i = 0; i < memberCount; i++) {
            var member = expr.members[i];
            aspects[i] = aspectsMap.get(member.aspect.id);
            if (member.condition != null)
                conditions[i] = parseBooleanExpr(member.condition);
        }

        return new RSExpr.AspectSet(aspects, conditions);
    }

    private void checkExprType(RSType expectedType, RSExpr<?> expr) throws InvalidInfraException {
        var exprType = expr.getType(argTypes);
        if (exprType != expectedType)
            throw new InvalidInfraException(String.format(
                    "type mismatch: expected %s, got %s", expectedType.toString(), exprType.toString()));
    }

    @SuppressWarnings("unchecked")
    private RSExpr<RSBool> parseBooleanExpr(RJSRSExpr rjsExpr) throws InvalidInfraException {
        var expr = parse(rjsExpr);
        checkExprType(RSType.BOOLEAN, expr);
        return (RSExpr<RSBool>) expr;
    }

    @SuppressWarnings("unchecked")
    private RSExpr<Signal.State> parseSignalExpr(RJSRSExpr rjsExpr) throws InvalidInfraException {
        var expr = parse(rjsExpr);
        checkExprType(RSType.SIGNAL, expr);
        return (RSExpr<Signal.State>) expr;
    }

    @SuppressWarnings("unchecked")
    private RSExpr<Route.State> parseRouteExpr(RJSRSExpr rjsExpr) throws InvalidInfraException {
        var expr = parse(rjsExpr);
        checkExprType(RSType.ROUTE, expr);
        return (RSExpr<Route.State>) expr;
    }

    /** Parse a Json RailScript expression, and ensure it returns an AspectSet */
    @SuppressWarnings("unchecked")
    public RSExpr<RSAspectSet> parseAspectSetExpr(RJSRSExpr rjsExpr) throws InvalidInfraException {
        var expr = parse(rjsExpr);
        checkExprType(RSType.ASPECT_SET, expr);
        return (RSExpr<RSAspectSet>) expr;
    }

    private RSExpr<RSBool>[] parseInfixOp(RJSRSExpr.InfixOp expr) throws InvalidInfraException {
        var arity = expr.exprs.length;
        @SuppressWarnings({"unchecked"})
        var expressions = (RSExpr<RSBool>[]) new RSExpr<?>[arity];
        for (int i = 0; i < arity; i++)
            expressions[i] = parseBooleanExpr(expr.exprs[i]);
        return expressions;
    }

}
