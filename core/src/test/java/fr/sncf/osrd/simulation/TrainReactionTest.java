package fr.sncf.osrd.simulation;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertThrows;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.railscript.RJSRSExpr;
import org.junit.jupiter.api.Test;


public class TrainReactionTest {
    @Test
    public void testWaitingForSwitchChange() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 42;
        var preparedSim = testConfig.prepare();
        var sim = preparedSim.sim;
        SwitchState switchState = sim.infraState.getSwitchState(0);
        switchState.setGroup(sim, "RIGHT");

        preparedSim.run();
    }

    @Test
    public void testGoThroughGreen() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 42;

        var functions = testConfig.rjsInfra.scriptFunctions;
        var aspect = new RJSRSExpr.AspectSet.AspectSetMember(
                new ID<>("GREEN"),
                new RJSRSExpr.True());
        for (var f : functions) {
            f.body = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{aspect});
        }

        var preparedSim = testConfig.prepare();
        var sim = preparedSim.sim;
        SwitchState switchState = sim.infraState.getSwitchState(0);
        switchState.setGroup(sim, "RIGHT");
        makeFunctionEvent(sim, 100, () -> {
            var train = sim.trains.values().iterator().next();
            assert train.lastScheduledEvent == null;
        });
        assertThrows(SimulationError.class,
                preparedSim::runWithExceptions,
                "Expected a simulation error once the train goes through the switch"
        );
    }

    @Test
    public void testStopAtRed() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        var functions = testConfig.rjsInfra.scriptFunctions;
        var aspect = new RJSRSExpr.AspectSet.AspectSetMember(
                new ID<>("RED"),
                new RJSRSExpr.True());
        for (var f : functions) {
            f.body = new RJSRSExpr.AspectSet(new RJSRSExpr.AspectSet.AspectSetMember[]{aspect});
        }
        var preparedSim = testConfig.prepare();
        var sim = preparedSim.sim;

        makeFunctionEvent(sim, 100, () -> {
            var train = sim.trains.values().iterator().next();
            assert train.lastScheduledEvent != null;
        });

        preparedSim.run();
    }

    @Test
    public void testExceptionIfReachRedSignal() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 42;
        testConfig.rjsSimulation.trainSchedules.get(0).phases[0].driverSightDistance = 0;

        var simState = testConfig.prepare();
        var sim = simState.sim;

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        assertThrows(SimulationError.class,
                simState::runWithExceptions,
                "Expected a simulation error once the train goes through the red signal"
        );
    }
}
