package fr.sncf.osrd.railjson.schema.infra.railscript;

import static org.junit.jupiter.api.Assertions.fail;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.RSExpr;
import fr.sncf.osrd.infra.railscript.RSExprState;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra.railscript.value.RSBool;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.RailScriptExprParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr.*;
import fr.sncf.osrd.simulation.Simulation;
import net.jqwik.api.*;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Random;



public class RailScriptTests {

    @Property
    boolean testNot(@ForAll("booleanExpression") RJSRSExpr expr) {
        var notExpr = new Not(expr);
        return evalBool(expr) == !evalBool(notExpr);
    }

    @Property
    boolean testAnd(@ForAll("booleanExpressions") RJSRSExpr[] exprs) {
        var res = evalBool(new And(exprs));
        boolean expected = Arrays.stream(exprs)
                .allMatch(RailScriptTests::evalBool);
        return res == expected;
    }

    @Property
    boolean testOr(@ForAll("booleanExpressions") RJSRSExpr[] exprs) {
        var res = evalBool(new Or(exprs));
        boolean expected = Arrays.stream(exprs)
                .anyMatch(RailScriptTests::evalBool);
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
        RSExpr<?> rsExpr = new RailScriptExprParser(m, new HashMap<>()).parse(signalRef);
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
    boolean testRouteRef(@ForAll Random random) throws InvalidInfraException {
        var routeRef = new RJSGenerator(random).generateRouteRef();
        var m = RJSGenerator.sim.infra.aspects;
        RSExpr<?> rsExpr = new RailScriptExprParser(m, new HashMap<>()).parse(routeRef);
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
        RSExpr<?> rsExpr = new RailScriptExprParser(m, new HashMap<>()).parse(switchRef);
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

    @Provide
    Arbitrary<RJSRSExpr> booleanExpression() {
        return Arbitraries.randomValue(random -> new RJSGenerator(random).generateBoolExpr(5));
    }

    @Provide
    Arbitrary<RJSRSExpr[]> booleanExpressions() {
        return booleanExpression().array(RJSRSExpr[].class).ofMinSize(0).ofMaxSize(10);
    }

    @Provide
    Arbitrary<AspectSet> aspectSet() {
        return Arbitraries.randomValue(random -> new RJSGenerator(random).generateAspectSet(5));
    }

    /** Evaluates an expression */
    public static RSValue eval(RJSRSExpr expr) {
        var m = RJSGenerator.sim.infra.aspects;
        try {
            var rsExpr = new RailScriptExprParser(m, new HashMap<>()).parse(expr);
            return eval(rsExpr);
        } catch (InvalidInfraException e) {
            fail(e);
            return null;
        }
    }

    /** Evaluates an expression */
    public static RSValue eval(RSExpr<?> rsExpr) {
        var state = new RSExprState<>(rsExpr, 5, 5);
        return state.evalInit(RJSGenerator.sim.infraState);
    }

    /** Evaluates a boolean expression */
    public static boolean evalBool(RJSRSExpr expr) {
        var res = eval(expr);
        if (! (res instanceof RSBool))
            fail("Value should be boolean");
        return ((RSBool) res).value;
    }

    public static class RJSGenerator {
        Random random;
        static Simulation sim = genSimulation();

        static Simulation genSimulation() {
            var infra = Helpers.getBaseInfra();
            assert infra != null;
            try {
                return Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
            } catch (InvalidInfraException e) {
                fail(e);
                return null;
            }
        }

        public RJSGenerator(Random random) {
            this.random = random;
        }

        /** Randomly generates a boolean expression
         * maxDepth is here to avoid infinite recursions */
        public RJSRSExpr generateBoolExpr(int maxDepth) {
            if (maxDepth > 1) {
                switch (random.nextInt(5)) {
                    case 0:
                        return generateOr(maxDepth);
                    case 1:
                        return generateAnd(maxDepth);
                    case 2:
                        return generateNot(maxDepth);
                    case 3:
                        return new True();
                    case 4:
                        return new False();
                }
            }
            return random.nextBoolean() ? new True() : new False();
        }

        /** Generates an array of 0 to 5 boolean expression */
        public RJSRSExpr[] generateBoolExprs(int maxDepth) {
            int n = random.nextInt(5);
            var res = new RJSRSExpr[n];
            for (int i = 0; i < n; i++) {
                res[i] = generateBoolExpr(maxDepth - 1);
            }
            return res;
        }

        /** Generates a random Or expression */
        public Or generateOr(int maxDepth) {
            return new Or(generateBoolExprs(maxDepth - 1));
        }

        /** Generates a random And expression */
        public And generateAnd(int maxDepth) {
            return new And(generateBoolExprs(maxDepth - 1));
        }

        /** Generates a random Not expression */
        public Not generateNot(int maxDepth) {
            return new Not(generateBoolExpr(maxDepth - 1));
        }

        /** Get a random aspect from the infra */
        public Aspect getRandomAspect() {
            var keys = new ArrayList<>(sim.infra.aspects.keySet());
            var key = keys.get(random.nextInt(keys.size()));
            return sim.infra.aspects.get(key);
        }

        /** Generates a random aspect set */
        public AspectSet generateAspectSet(int maxDepth) {
            int n = random.nextInt(5);
            var members = new AspectSet.AspectSetMember[n];
            for (int i = 0; i < n; i++) {
                members[i] = new AspectSet.AspectSetMember(
                        new ID<>(getRandomAspect().id),
                        generateBoolExpr(maxDepth - 1)
                );
            }
            return new AspectSet(members);
        }

        /** Get a ref to a random signal from the infra */
        public SignalRef generateSignalRef() {
            var signals = sim.infra.signals;
            var i = random.nextInt(signals.size());
            return new SignalRef(new ID<>(signals.get(i).id));
        }

        /** Get a ref to a random route from the infra */
        public RouteRef generateRouteRef() {
            var routeNames = new ArrayList<>(sim.infra.routeGraph.routeMap.keySet());
            var i = random.nextInt(routeNames.size());
            return new RouteRef(new ID<>(routeNames.get(i)));
        }

        /** Get a ref to a random signal from the infra */
        public SwitchRef generateSwitchRef() {
            var switches = sim.infra.switches;
            var i = random.nextInt(switches.size());
            return new SwitchRef(new ID<>(switches.get(i).id));
        }
    }
}
