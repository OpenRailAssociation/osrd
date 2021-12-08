package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.infra_state.events.SwitchMoveEvent;
import fr.sncf.osrd.infra_state.routes.RouteState;
import fr.sncf.osrd.infra_state.routes.RouteStatus;
import fr.sncf.osrd.simulation.SimulationError;
import org.junit.jupiter.api.Test;

public class SwitchStateTest {
    @Test
    public void testSwitchNoMove() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        var preparedConfig = testConfig.prepare();
        var sim = preparedConfig.sim;
        RouteState routeState = sim.infraState.getRouteState(2);
        makeAssertEvent(sim, 21, () -> routeState.status == RouteStatus.RESERVED);
        var events = preparedConfig.run();

        // The switch starts in the correct position, no switch move event should happen
        for (var e : events)
            assertNotEquals(SwitchMoveEvent.class, e.getClass());
    }

    @Test
    public void testSimpleSwitch() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 6;
        var simState = testConfig.prepare();
        var sim = simState.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        SwitchState switchState = sim.infraState.getSwitchState(0);
        RouteState routeState = sim.infraState.getRouteState(2);
        double requestTime = 42;
        makeFunctionEvent(sim, requestTime, () -> routeState.reserve(sim));
        makeAssertEvent(sim, requestTime + 1, () -> switchState.getGroup() == null);
        makeAssertEvent(sim, requestTime + 1, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, requestTime + 7, () -> switchState.getGroup().equals("LEFT"));
        makeAssertEvent(sim, requestTime + 7, () -> routeState.status == RouteStatus.RESERVED);

        simState.run();
    }

    @Test
    public void testSwitchShorterDelay() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 2;

        var simState = testConfig.prepare();
        var sim = simState.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        SwitchState switchState = sim.infraState.getSwitchState(0);
        RouteState routeState = sim.infraState.getRouteState(2);
        makeAssertEvent(sim, 0, () -> switchState.getGroup().equals("RIGHT"));
        makeAssertEvent(sim, 2, () -> switchState.getGroup() == null);
        makeAssertEvent(sim, 2, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 3, () -> switchState.getGroup().equals("LEFT"));
        makeAssertEvent(sim, 3, () -> routeState.status == RouteStatus.RESERVED);

        simState.run();
    }

    @Test
    public void testSwitchLongerDelay() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 42;

        var simState = testConfig.prepare();
        var sim = simState.sim;

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        SwitchState switchState = sim.infraState.getSwitchState(0);
        RouteState routeState = sim.infraState.getRouteState(2);
        makeAssertEvent(sim, 0, () -> switchState.getGroup().equals("RIGHT"));
        makeAssertEvent(sim, 41, () -> switchState.getGroup() == null);
        makeAssertEvent(sim, 41, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 43, () -> switchState.getGroup().equals("LEFT"));
        makeAssertEvent(sim, 43, () -> routeState.status == RouteStatus.RESERVED);

        simState.run();
    }
}
