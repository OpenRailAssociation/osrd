package fr.sncf.osrd.simulation;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import org.junit.jupiter.api.Test;


public class TrainReactionTest {
    @Test
    public void testWaitingForSwitchChange() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        infra.switches.iterator().next().groupChangeDelay = 42;
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        SwitchState switchState = sim.infraState.getSwitchState(0);
        switchState.setGroup(sim, "RIGHT");
        run(sim);
    }

    @Test
    public void testGoThroughGreen() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        infra.switches.iterator().next().groupChangeDelay = 42;
        var functions = infra.scriptFunctions;
        var aspect = new RJSRSExpr.AspectSet.AspectSetMember(
                new ID<>("GREEN"),
                new RJSRSExpr.True());
        for (var f : functions) {
            f.body = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{aspect});
        }
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        SwitchState switchState = sim.infraState.getSwitchState(0);
        switchState.setGroup(sim, "RIGHT");
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
        final var infra = getBaseInfra();
        var functions = infra.scriptFunctions;
        var aspect = new RJSRSExpr.AspectSet.AspectSetMember(
                new ID<>("RED"),
                new RJSRSExpr.True());
        for (var f : functions) {
            f.body = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{aspect});
        }
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

        makeFunctionEvent(sim, 100, () -> {
            var train = sim.trains.values().iterator().next();
            assert train.lastScheduledEvent != null;
        });

        runWithExceptions(sim);
    }
}
