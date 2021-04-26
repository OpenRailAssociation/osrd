package fr.sncf.osrd.railjson.schema.infra.railscript;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.RSExpr;
import fr.sncf.osrd.infra.railscript.RSExprState;
import fr.sncf.osrd.infra.railscript.RSFunction;
import fr.sncf.osrd.infra.railscript.value.RSBool;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.RailScriptExprParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.simulation.Simulation;
import net.jqwik.api.lifecycle.AfterTry;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.fail;

public class RSHelpers {
    public static class RJSGenerator {
        Random random;
        static Simulation sim = genSimulation();
        static HashMap<String, RSFunction<?>> functions = new HashMap<>();

        static void init() {
            sim = genSimulation();
            functions = new HashMap<>();
        }

        static Simulation genSimulation() {
            var infra = fr.sncf.osrd.Helpers.getBaseInfra();
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
        public RJSRSExpr generateBoolExpr(int maxDepth, RJSRSFunction.Argument[] args) {
            if (maxDepth > 1) {
                switch (random.nextInt(7)) {
                    case 0:
                        return generateOr(maxDepth, args);
                    case 1:
                        return generateAnd(maxDepth, args);
                    case 2:
                        return generateNot(maxDepth, args);
                    case 3:
                        return new RJSRSExpr.True();
                    case 4:
                        return new RJSRSExpr.False();
                    case 5:
                        return generateFunctionCall(maxDepth, args);
                    case 6:
                        if (args.length > 0)
                            return generateArgRef(args);
                        else
                            return generateBoolExpr(maxDepth, args);
                }
            }
            return random.nextBoolean() ? new RJSRSExpr.True() : new RJSRSExpr.False();
        }

        /** Randomly generates a boolean expression */
        public RJSRSExpr generateBoolExpr() {
            return generateBoolExpr(5, new RJSRSFunction.Argument[0]);
        }

        /** Generates an array of 0 to 5 boolean expression */
        public RJSRSExpr[] generateBoolExprs(int maxDepth, RJSRSFunction.Argument[] args) {
            int n = random.nextInt(5);
            var res = new RJSRSExpr[n];
            for (int i = 0; i < n; i++) {
                res[i] = generateBoolExpr(maxDepth - 1, args);
            }
            return res;
        }

        /** Generates an array of 0 to 5 boolean expression */
        public RJSRSExpr[] generateBoolExprs(int maxDepth) {
            return generateBoolExprs(maxDepth, new RJSRSFunction.Argument[0]);
        }

        /** Generates an array of 0 to 5 boolean expression */
        public RJSRSExpr[] generateBoolExprs() {
            return generateBoolExprs(0);
        }

        /** Generates a random Or expression */
        public RJSRSExpr.Or generateOr(int maxDepth, RJSRSFunction.Argument[] args) {
            return new RJSRSExpr.Or(generateBoolExprs(maxDepth - 1, args));
        }

        /** Generates a random And expression */
        public RJSRSExpr.And generateAnd(int maxDepth, RJSRSFunction.Argument[] args) {
            return new RJSRSExpr.And(generateBoolExprs(maxDepth - 1, args));
        }

        /** Generates a random Not expression */
        public RJSRSExpr.Not generateNot(int maxDepth, RJSRSFunction.Argument[] args) {
            return new RJSRSExpr.Not(generateBoolExpr(maxDepth - 1, args));
        }

        /** Get a random aspect from the infra */
        public Aspect getRandomAspect() {
            var keys = new ArrayList<>(sim.infra.aspects.keySet());
            var key = keys.get(random.nextInt(keys.size()));
            return sim.infra.aspects.get(key);
        }

        /** Generates a random aspect set */
        public RJSRSExpr.AspectSet generateAspectSet(int maxDepth, RJSRSFunction.Argument[] args) {
            int n = random.nextInt(5);
            var members = new RJSRSExpr.AspectSet.AspectSetMember[n];
            for (int i = 0; i < n; i++) {
                members[i] = new RJSRSExpr.AspectSet.AspectSetMember(
                        new ID<>(getRandomAspect().id),
                        generateBoolExpr(maxDepth - 1, args)
                );
            }
            return new RJSRSExpr.AspectSet(members);
        }

        /** Get a ref to a random signal from the infra */
        public RJSRSExpr.SignalRef generateSignalRef() {
            var signals = sim.infra.signals;
            var i = random.nextInt(signals.size());
            return new RJSRSExpr.SignalRef(new ID<>(signals.get(i).id));
        }

        /** Get a ref to a random route from the infra */
        public RJSRSExpr.RouteRef generateRouteRef() {
            var routeNames = new ArrayList<>(sim.infra.routeGraph.routeMap.keySet());
            var i = random.nextInt(routeNames.size());
            return new RJSRSExpr.RouteRef(new ID<>(routeNames.get(i)));
        }

        /** Get a ref to a random signal from the infra */
        public RJSRSExpr.SwitchRef generateSwitchRef() {
            var switches = sim.infra.switches;
            var i = random.nextInt(switches.size());
            return new RJSRSExpr.SwitchRef(new ID<>(switches.get(i).id));
        }

        /** Generates a random enum match, matching a RouteRef */
        public RJSRSExpr.EnumMatch generateEnumMatch(int maxDepth, RJSRSFunction.Argument[] args) {
            var expr = generateRouteRef();
            var branches = new HashMap<String, RJSRSExpr>();
            for (var status : RouteStatus.values()) {
                branches.put(status.name(), generateBoolExpr(maxDepth - 1, args));
            }
            return new RJSRSExpr.EnumMatch(expr, branches);
        }

        /** Generates a random function body */
        public RJSRSFunction generateFunction(String name, int nArgs, int maxDepth) {
            var args = new RJSRSFunction.Argument[nArgs];
            for (int i = 0; i < nArgs; i++)
                args[i] = new RJSRSFunction.Argument(String.valueOf(random.nextInt()), RJSRSType.BOOLEAN);
            var rjsrsFunction = new RJSRSFunction(name,
                    args,
                    RJSRSType.BOOLEAN,
                    generateBoolExpr(maxDepth - 1, args));
            try {
                var f = RailScriptExprParser.parseFunction(sim.infra.aspects, functions, rjsrsFunction);
                functions.put(name, f);
                return rjsrsFunction;
            } catch (InvalidInfraException e) {
                fail(e);
                return null;
            }
        }

        /** Generates a function call, add its new body to the function map */
        public RJSRSExpr.Call generateFunctionCall(int maxDepth, RJSRSFunction.Argument[] args) {
            var name = String.valueOf(random.nextInt());
            int nArgs = random.nextInt(5);
            var f = generateFunction(name, nArgs, maxDepth - 1);
            var newArgs = new RJSRSExpr[nArgs];
            for (int i = 0; i < nArgs; i++)
                newArgs[i] = generateBoolExpr(maxDepth - 1, args);
            return new RJSRSExpr.Call(new ID<>(f.getID()), newArgs);
        }

        /** Generates a function call, add its new body to the function map */
        public RJSRSExpr.ArgumentRef generateArgRef(RJSRSFunction.Argument[] args) {
            int i = random.nextInt(args.length);
            return new RJSRSExpr.ArgumentRef(args[i].name);
        }
    }

    /** Evaluates an expression */
    public static RSValue eval(RJSRSExpr expr) {
        var m = RJSGenerator.sim.infra.aspects;
        try {
            var rsExpr = new RailScriptExprParser(m, RJSGenerator.functions).parse(expr);
            return eval(rsExpr);
        } catch (InvalidInfraException e) {
            fail(e);
            return null;
        }
    }

    /** Evaluates an expression */
    public static RSValue eval(RSExpr<?> rsExpr) {
        var state = new RSExprState<>(rsExpr, 50, 50);
        return state.evalInit(RJSGenerator.sim.infraState);
    }

    /** Evaluates a boolean expression */
    public static boolean evalBool(RSExpr<?> expr) {
        var res = eval(expr);
        if (! (res instanceof RSBool))
            fail("Value should be boolean");
        return ((RSBool) res).value;
    }

    /** Evaluates a boolean expression */
    public static boolean evalBool(RJSRSExpr expr) {
        var res = eval(expr);
        if (! (res instanceof RSBool))
            fail("Value should be boolean");
        return ((RSBool) res).value;
    }
}
