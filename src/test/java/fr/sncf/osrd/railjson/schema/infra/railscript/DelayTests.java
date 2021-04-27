package fr.sncf.osrd.railjson.schema.infra.railscript;

import static fr.sncf.osrd.Helpers.*;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.RSDelayHandler;
import fr.sncf.osrd.infra.railscript.RSExpr;
import fr.sncf.osrd.infra.railscript.RSExprState;
import fr.sncf.osrd.infra.railscript.RSExprVisitor;
import fr.sncf.osrd.infra.railscript.value.RSBool;
import fr.sncf.osrd.infra.railscript.value.RSType;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.simulation.Simulation;
import org.junit.jupiter.api.Test;

public class DelayTests {

    @Test
    public void testSimpleDelay() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;
        config.trainSchedules.clear();
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        var expr = new UpdateableBool();
        var time = 10;
        var delay = new RSExpr.Delay<>(time, expr, 0);
        var state = new RSExprState<>(delay, 50, 50);
        var delayHandler = new CustomDelayHandler(state, sim);

        var initResult = state.evalInit(sim.infraState);
        assert !initResult.value;

        expr.setValue(true);

        assert !state.evalInputChange(sim.infraState, delayHandler).value;

        makeAssertEvent(sim, 4, () -> !state.evalInputChange(sim.infraState, delayHandler).value);

        makeFunctionEvent(sim, 5, () -> expr.setValue(false));
        makeAssertEvent(sim, 5, () -> !state.evalInputChange(sim.infraState, delayHandler).value);

        makeAssertEvent(sim, 9, () -> !state.evalInputChange(sim.infraState, delayHandler).value);

        makeAssertEvent(sim, 11, () -> state.evalInputChange(sim.infraState, delayHandler).value);
        makeAssertEvent(sim, 14, () -> state.evalInputChange(sim.infraState, delayHandler).value);

        makeAssertEvent(sim, 16, () -> !state.evalInputChange(sim.infraState, delayHandler).value);

        run(sim, config);
    }

    @Test
    public void testRecursiveDelay() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;
        config.trainSchedules.clear();
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        var expr = new UpdateableBool();
        var time = 10;
        var delay1 = new RSExpr.Delay<>(time, expr, 0);
        var delay2 = new RSExpr.Delay<>(time, delay1, 1);
        var state = new RSExprState<>(delay2, 50, 50);
        final var delayHandler = new CustomDelayHandler(state, sim);

        var initResult = state.evalInit(sim.infraState);
        assert !initResult.value;
        expr.setValue(true);
        assert !state.evalInputChange(sim.infraState, delayHandler).value;

        makeAssertEvent(sim, 9, () -> !state.evalInputChange(sim.infraState, delayHandler).value);
        makeAssertEvent(sim, 12, () -> !state.evalInputChange(sim.infraState, delayHandler).value);
        makeAssertEvent(sim, 21, () -> state.evalInputChange(sim.infraState, delayHandler).value);

        run(sim, config);
    }

    @Test
    public void testDifferentDelays() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;
        config.trainSchedules.clear();
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        var expr1 = new UpdateableBool();
        var expr2 = new UpdateableBool();
        var delay = new RSExpr.Delay<>(10, expr1, 0);
        var shorterDelay = new RSExpr.Delay<>(5, expr2, 1);
        @SuppressWarnings({"unchecked"})
        var array = (RSExpr<RSBool>[]) new RSExpr<?>[2];
        array[0] = delay;
        array[1] = shorterDelay;
        var and = new RSExpr.And(array);
        var state = new RSExprState<>(and, 50, 50);
        final var delayHandler = new CustomDelayHandler(state, sim);

        assert !state.evalInit(sim.infraState).value;
        expr1.setValue(true);
        expr2.setValue(true);
        assert !state.evalInputChange(sim.infraState, delayHandler).value;

        makeAssertEvent(sim, 9, () -> !state.evalInputChange(sim.infraState, delayHandler).value);
        makeAssertEvent(sim, 11, () -> state.evalInputChange(sim.infraState, delayHandler).value);

        run(sim, config);
    }


    public static class CustomDelayHandler implements RSDelayHandler {

        private final RSExprState<RSBool> state;
        private final Simulation sim;

        public CustomDelayHandler(RSExprState<RSBool> state, Simulation sim) {
            this.state = state;
            this.sim = sim;
        }

        @Override
        public void planDelayedUpdate(int index, RSValue value, double delay) {
            makeFunctionEvent(sim, sim.getTime() + delay, () ->
                    state.evalDelayUpdate(sim.infraState, this, index, value));
        }
    }


    public static class UpdateableBool extends RSExpr<RSBool> {

        boolean value = false;

        public void setValue(boolean value) {
            this.value = value;
        }

        @Override
        public RSBool evaluate(RSExprState<?> state) {
            return RSBool.from(value);
        }

        @Override
        public void accept(RSExprVisitor visitor) throws InvalidInfraException {}

        @Override
        public RSType getType(RSType[] argumentTypes) {
            return RSType.BOOLEAN;
        }
    }
}
