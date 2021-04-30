package fr.sncf.osrd.railjson.schema.infra.railscript;

import static fr.sncf.osrd.railjson.schema.infra.railscript.RSHelpers.RJSGenerator.sim;
import static org.junit.jupiter.api.Assertions.fail;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.RSExpr;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra.railscript.value.RSOptional;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.railjson.parser.RailScriptExprParser;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr.*;
import fr.sncf.osrd.simulation.SimulationError;
import net.jqwik.api.*;
import net.jqwik.api.lifecycle.AfterTry;

import java.util.*;


public class RailScriptTests extends RSHelpers {

    @Property
    boolean testNot(@ForAll("booleanExpression") RJSRSExpr expr) {
        var notExpr = new Not(expr);
        return evalBool(expr) == !evalBool(notExpr);
    }

    @Property
    boolean testAnd(@ForAll("booleanExpressions") RJSRSExpr[] exprs) {
        var res = evalBool(new And(exprs));
        boolean expected = Arrays.stream(exprs)
                .allMatch(RSHelpers::evalBool);
        return res == expected;
    }

    @Property
    boolean testOr(@ForAll("booleanExpressions") RJSRSExpr[] exprs) {
        var res = evalBool(new Or(exprs));
        boolean expected = Arrays.stream(exprs)
                .anyMatch(RSHelpers::evalBool);
        return res == expected;
    }

    @Property
    boolean testIf(@ForAll("booleanExpression") RJSRSExpr condition,
                   @ForAll("booleanExpression") RJSRSExpr trueBranch,
                   @ForAll("booleanExpression") RJSRSExpr falseBranch) {
        var res = eval(new If(condition, trueBranch, falseBranch));
        var conditionResult = evalBool(condition);
        var expected = conditionResult ? eval(trueBranch) : eval(falseBranch);
        return res == expected;
    }

    @Property
    boolean testAspectSet(@ForAll("aspectSet") AspectSet aspects) {
        var res = eval(aspects);
        if (! (res instanceof RSAspectSet))
            fail("Value should be an aspect set");
        var resAspects = (RSAspectSet) res;
        var allAspects = RJSGenerator.sim.infra.aspects.values();
        for (var aspect : allAspects) {
            boolean hasAspect = resAspects.stream().anyMatch(x -> x.id.equals(aspect.id));
            boolean shouldHaveAspect = Arrays.stream(aspects.members)
                    .anyMatch(x -> x.aspect.id.equals(aspect.id) && evalBool(x.condition));
            if (hasAspect != shouldHaveAspect)
                return false;
        }
        return true;
    }

    @Property
    boolean testSignalRef(@ForAll Random random) throws InvalidInfraException {
        var signalRef = new RJSGenerator(random).generateSignalRef();
        var m = RJSGenerator.sim.infra.aspects;
        RSExpr<?> rsExpr = new RailScriptExprParser(m, RJSGenerator.functions).parse(signalRef);
        assert rsExpr instanceof RSExpr.SignalRef;
        var signalNames = new HashMap<String, Signal>();
        for (var signal : RJSGenerator.sim.infra.signals) {
            signalNames.put(signal.id, signal);
        }
        ((RSExpr.SignalRef) rsExpr).resolve(signalNames);
        var res = eval(rsExpr);
        assert res instanceof SignalState;
        var signalState = (SignalState) res;
        return signalState.signal.id.equals(signalRef.signal.id);
    }

    @Property
    boolean testRouteRef(@ForAll("routeRef") RouteRef routeRef) throws InvalidInfraException {
        var m = RJSGenerator.sim.infra.aspects;
        RSExpr<?> rsExpr = new RailScriptExprParser(m, RJSGenerator.functions).parse(routeRef);
        assert rsExpr instanceof RSExpr.RouteRef;
        ((RSExpr.RouteRef) rsExpr).resolve(RJSGenerator.sim.infra.routeGraph.routeMap);
        var res = eval(rsExpr);
        assert res instanceof RouteState;
        var routeState = (RouteState) res;
        return routeState.route.id.equals(routeRef.route.id);
    }

    @Property
    boolean testSwitchRef(@ForAll Random random) throws InvalidInfraException {
        var switchRef = new RJSGenerator(random).generateSwitchRef();
        var m = RJSGenerator.sim.infra.aspects;
        RSExpr<?> rsExpr = new RailScriptExprParser(m, RJSGenerator.functions).parse(switchRef);
        assert rsExpr instanceof RSExpr.SwitchRef;
        var switchNames = new HashMap<String, Switch>();
        for (var s : RJSGenerator.sim.infra.switches) {
            switchNames.put(s.id, s);
        }
        ((RSExpr.SwitchRef) rsExpr).resolve(switchNames);
        var res = eval(rsExpr);
        assert res instanceof SwitchState;
        var switchState = (SwitchState) res;
        return switchState.switchRef.id.equals(switchRef.switchRef.id);
    }

    @Property
    boolean testEnum(@ForAll("routeRef") RouteRef routeRef,
                     @ForAll Random random,
                     @ForAll RouteStatus status)
            throws InvalidInfraException {
        var branches = new HashMap<String, RJSRSExpr>();
        boolean expected = false;
        var matchingRoute = RJSGenerator.sim.infra.routeGraph.routeMap.get(routeRef.route.id);
        var routeState = RJSGenerator.sim.infraState.getRouteState(matchingRoute.index);
        var generator = new RJSGenerator(random);
        routeState.status = status;
        for (var i = 0; i < RouteStatus.values().length; i++) {
            var branchExpression = generator.generateBoolExpr();
            branches.put(RouteStatus.values()[i].name(), branchExpression);
            if (routeState.status == RouteStatus.values()[i])
                expected = evalBool(branchExpression);
        }
        var match = new EnumMatch(routeRef, branches);

        var m = RJSGenerator.sim.infra.aspects;
        RSExpr<?> rsEnum = new RailScriptExprParser(m, RJSGenerator.functions).parse(match);
        assert rsEnum instanceof RSExpr.EnumMatch;
        var rsExpr = ((RSExpr.EnumMatch<?, ?>) rsEnum).expr;
        assert rsExpr instanceof RSExpr.RouteRef;
        ((RSExpr.RouteRef) rsExpr).resolve(RJSGenerator.sim.infra.routeGraph.routeMap);

        var res = evalBool(rsEnum);
        return expected == res;
    }

    @Property
    boolean testOptional(@ForAll Random random) throws InvalidInfraException, SimulationError {

        int nRoutes = sim.infra.routeGraph.routeMap.size();
        var route = sim.infraState.getRouteState(random.nextInt(nRoutes));
        route.reserve(sim);

        var generator = new RJSGenerator(random);
        var optionalExpr = new RJSRSExpr.ReservedRoute(generator.generateSignalRef());
        var some = generator.generateBoolExpr();
        var none = generator.generateBoolExpr();
        var matchExpr = new RJSRSExpr.OptionalMatch(optionalExpr, none, some, "foo");

        var m = sim.infra.aspects;
        RSExpr<?> rsMatch = new RailScriptExprParser(m, RJSGenerator.functions).parse(matchExpr);
        assert rsMatch instanceof RSExpr.OptionalMatch;
        var rsExpr = ((RSExpr.OptionalMatch<?>) rsMatch).expr;
        assert rsExpr instanceof RSExpr.ReservedRoute;
        var signalRef = ((RSExpr.ReservedRoute) rsExpr).signal;
        assert signalRef instanceof RSExpr.SignalRef;
        var signalNames = new HashMap<String, Signal>();
        for (var signal : sim.infra.signals) {
            signalNames.put(signal.id, signal);
        }
        ((RSExpr.SignalRef) signalRef).resolve(signalNames);

        var optionalResult = eval(rsExpr);
        var result = evalBool(rsMatch);

        assert optionalResult != null;
        assert optionalResult.getClass() == RSOptional.class;
        @SuppressWarnings({"unchecked"})
        var casted = (RSOptional<RouteState>) optionalResult;
        var isEmpty = casted.value == null;

        var someResult = evalBool(some);
        var noneResult = evalBool(none);

        var expected = isEmpty ? noneResult : someResult;
        return expected == result;
    }

    @AfterTry
    public void init() {
        RJSGenerator.init();
    }
}
