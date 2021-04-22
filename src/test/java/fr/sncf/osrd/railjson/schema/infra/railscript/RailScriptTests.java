package fr.sncf.osrd.railjson.schema.infra.railscript;

import static org.junit.jupiter.api.Assertions.fail;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.RSExprState;
import fr.sncf.osrd.infra.railscript.value.RSBool;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.signaling.Aspect;
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
        return eval(expr) == !eval(notExpr);
    }

    @Property
    boolean testAnd(@ForAll("booleanExpressions") RJSRSExpr[] exprs) {
        var res = eval(new And(exprs));
        boolean expected = Arrays.stream(exprs)
                .allMatch(RailScriptTests::eval);
        return res == expected;
    }

    @Property
    boolean testOr(@ForAll("booleanExpressions") RJSRSExpr[] exprs) {
        var res = eval(new Or(exprs));
        boolean expected = Arrays.stream(exprs)
                .anyMatch(RailScriptTests::eval);
        return res == expected;
    }

    @Property
    boolean testIf(@ForAll("booleanExpression") RJSRSExpr condition,
                   @ForAll("booleanExpression") RJSRSExpr trueBranch,
                   @ForAll("booleanExpression") RJSRSExpr falseBranch) {
        var res = eval(new If(condition, trueBranch, falseBranch));
        var conditionResult = eval(condition);
        var expected = conditionResult ? eval(trueBranch) : eval(falseBranch);
        return res == expected;
    }

    @Provide
    Arbitrary<RJSRSExpr> booleanExpression() {
        return Arbitraries.randomValue(random -> new RJSGenerator(random).generateBoolExpr(5));
    }

    @Provide
    Arbitrary<RJSRSExpr[]> booleanExpressions() {
        return booleanExpression().array(RJSRSExpr[].class).ofMinSize(1).ofMaxSize(10);
    }


    /** Evaluates a boolean expression */
    public static boolean eval(RJSRSExpr expr) {
        var m = RJSGenerator.sim.infra.aspects;
        try {
            var rsExpr = new RailScriptExprParser(m, new HashMap<>()).parse(expr);
            var state = new RSExprState<>(rsExpr, 5, 5);
            return valueToBool(state.evalInit(RJSGenerator.sim.infraState));
        } catch (InvalidInfraException e) {
            fail(e);
            return false;
        }
    }

    /** Converts an RSValue (assumed to be RSBool) to boolean */
    public static boolean valueToBool(RSValue v) {
        if (! (v instanceof RSBool))
            fail("Value should be boolean");
        return ((RSBool) v).value;
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
    }
}
