package fr.sncf.osrd.simulation;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.fail;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import fr.sncf.osrd.railjson.schema.infra.signaling.RJSAspect;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;


public class TrainReactionTest {
    @Test
    public void testWaitingForSwitchChange() throws InvalidInfraException, SimulationError {
        var infra = getBaseInfra();
        assert infra != null;
        infra.switches.iterator().next().positionChangeDelay = 42;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        SwitchState switchState = sim.infraState.getSwitchState(0);
        switchState.setPosition(sim, SwitchPosition.RIGHT);
        run(sim);
    }

    @Test
    public void testGoThroughGreen() throws InvalidInfraException, SimulationError {
        var infra = getBaseInfra();
        assert infra != null;
        infra.switches.iterator().next().positionChangeDelay = 42;
        var functions = infra.scriptFunctions;
        var aspect = new RJSRSExpr.AspectSet.AspectSetMember(
                new ID<>("GREEN"),
                new RJSRSExpr.True());
        for (var f : functions) {
            f.body = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{aspect});
        }
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        SwitchState switchState = sim.infraState.getSwitchState(0);
        switchState.setPosition(sim, SwitchPosition.RIGHT);
        makeFunctionEvent(sim, 100, () -> {
            var train = sim.trains.values().iterator().next();
            assert train.lastScheduledEvent == null;
        });
        assertThrows(SimulationError.class,
                () -> runWithExceptions(sim),
                "Expected a simulation error once the train goes through the switch"
        );
    }

    @Test
    public void testStopAtRed() throws InvalidInfraException, SimulationError {
        var infra = getBaseInfra();
        assert infra != null;
        var functions = infra.scriptFunctions;
        var aspect = new RJSRSExpr.AspectSet.AspectSetMember(
                new ID<>("RED"),
                new RJSRSExpr.True());
        for (var f : functions) {
            f.body = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{aspect});
        }
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        makeFunctionEvent(sim, 100, () -> {
            var train = sim.trains.values().iterator().next();
            assert train.lastScheduledEvent != null;
        });

        runWithExceptions(sim);
    }
}
