package fr.sncf.osrd.train;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.speedcontroller.SpeedInstructions;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

public class PhasesTest {

    @Test
    public void testSameSimulationEndTime() {
        var configA = TestConfig.readResource("tiny_infra/config_railjson_several_phases.json");
        var stateA = configA.prepare();
        stateA.run();

        var configB = TestConfig.readResource("tiny_infra/config_railjson.json");
        var stateB = configB.prepare();
        stateB.run();

        var endTimeA = stateA.sim.getTime();
        var endTimeB = stateB.sim.getTime();
        assertEquals(endTimeB, endTimeA, endTimeB * 0.1);
    }

    @Test
    public void testSameSimulationEndTimeCBTC() {
        var configA = TestConfig.readResource("tiny_infra/config_railjson_several_phases_cbtc.json");
        var stateA = configA.prepare();
        stateA.run();

        var configB = TestConfig.readResource("tiny_infra/config_railjson_cbtc.json");
        var stateB = configB.prepare();
        stateB.run();

        var endTimeA = stateA.sim.getTime();
        var endTimeB = stateB.sim.getTime();
        assertEquals(endTimeB, endTimeA, endTimeB * 0.1);
    }

    @Test
    public void testSameEventTimes() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson_several_phases.json");
        var events = testConfig.run();

        var baseConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        baseConfig.clearAllowances();
        var eventsRef = baseConfig.run();

        assertEquals(eventsRef.size(), events.size());

        var resultTimePerPosition = getTimePerPosition(events);
        var expectedTimePerPosition = getTimePerPosition(eventsRef);

        for (double t = expectedTimePerPosition.firstKey(); t < expectedTimePerPosition.lastKey(); t += 1) {
            var expected = expectedTimePerPosition.interpolate(t);
            var result = resultTimePerPosition.interpolate(t);
            assertEquals(expected, result, expected * 0.01);
        }
    }

    @Test
    @Disabled("we need to add WHITE_CROSS in order to the train to move")
    public void testSameEventTimesCBTC() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson_several_phases_cbtc.json");
        var events = testConfig.run();

        var baseConfig = TestConfig.readResource("tiny_infra/config_railjson_cbtc.json");
        baseConfig.clearAllowances();
        var eventsRef = baseConfig.run();

        assertEquals(eventsRef.size(), events.size());

        var resultTimePerPosition = getTimePerPosition(events);
        var expectedTimePerPosition = getTimePerPosition(eventsRef);

        for (double t = expectedTimePerPosition.firstKey(); t < expectedTimePerPosition.lastKey(); t += 1) {
            var expected = expectedTimePerPosition.interpolate(t);
            var result = resultTimePerPosition.interpolate(t);
            assertEquals(expected, result, expected * 0.01);
        }
    }

    @Test
    public void testReactToSignals() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson_several_phases.json");
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 500;

        var preparedSim = testConfig.prepare();
        var sim = preparedSim.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        // If the train ignores the signals, an exception will be thrown when it runs over the moving switch
        preparedSim.run();
    }

    @Test
    public void testReactToSignalsCBTC() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson_several_phases_cbtc.json");
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 500;

        var preparedSim = testConfig.prepare();
        var sim = preparedSim.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        // If the train ignores the signals, an exception will be thrown when it runs over the moving switch
        preparedSim.run();
    }

    @Test
    public void testTriggerSwitchChangeAtRightTime() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson_several_phases.json");
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 42;

        var preparedSim = testConfig.prepare();
        var sim = preparedSim.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        SwitchState switchState = sim.infraState.getSwitchState(0);
        RouteState routeState = sim.infraState.getRouteState(3);
        makeAssertEvent(sim, 0, () -> switchState.getGroup().equals("RIGHT"));
        makeAssertEvent(sim, 41, () -> switchState.getGroup() == null);
        makeAssertEvent(sim, 41, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 43, () -> switchState.getGroup().equals("LEFT"));
        makeAssertEvent(sim, 43, () -> routeState.status == RouteStatus.RESERVED);

        preparedSim.run();
    }

    @Test
    public void testTriggerSwitchChangeAtRightTimeCBTC() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson_several_phases_cbtc.json");
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 42;

        var preparedSim = testConfig.prepare();
        var sim = preparedSim.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        SwitchState switchState = sim.infraState.getSwitchState(0);
        RouteState routeState = sim.infraState.getRouteState(3);
        makeAssertEvent(sim, 0, () -> "RIGHT".equals(switchState.getGroup()));
        makeAssertEvent(sim, 41, () -> switchState.getGroup() == null);
        makeAssertEvent(sim, 41, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 43, () -> "LEFT".equals(switchState.getGroup()));
        makeAssertEvent(sim, 43, () -> routeState.status == RouteStatus.RESERVED);

        preparedSim.run();
    }
}
