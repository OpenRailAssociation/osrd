package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertNull;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.infra_state.routes.RouteStatus;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import org.junit.jupiter.api.Test;

public class TVDSectionStateTest {
    @Test
    public void testSimpleReserve() {
        var changelog = new ArrayChangeLog();
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json")
                        .withChangeConsumer(changelog);
        testConfig.rjsInfra.switches.forEach(s -> s.groupChangeDelay = 0);
        testConfig.rjsSimulation.trainSchedules.clear();
        var preparedSim = testConfig.prepare();
        var sim = preparedSim.sim;

        var tvd1 = sim.infra.tvdSections.get("tvd.switch_foo");
        var tvd2 = sim.infra.tvdSections.get("tvd.track");
        var tvdState1 = sim.infraState.getTvdSectionState(tvd1.index);
        var tvdState2 = sim.infraState.getTvdSectionState(tvd2.index);

        makeFunctionEvent(sim, 1, () -> tvdState1.reserve(sim));
        makeFunctionEvent(sim, 1, () -> tvdState2.reserve(sim));
        makeFunctionEvent(sim, 2, () -> tvdState1.free(sim));
        makeFunctionEvent(sim, 2, () -> tvdState2.free(sim));

        var route = sim.infra.routeGraph.routeMap.get("rt.C1-S7");
        var routeState = sim.infraState.getRouteState(route.index);
        makeAssertEvent(sim, 1.1, () -> routeState.status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 1.1, tvdState1::isReserved);
        makeAssertEvent(sim, 1.1, tvdState2::isReserved);
        makeAssertEvent(sim, 2.1, () -> routeState.status == RouteStatus.FREE);
        makeAssertEvent(sim, 2.1, () -> !tvdState1.isReserved());
        makeAssertEvent(sim, 2.1, () -> !tvdState2.isReserved());

        preparedSim.run();
    }

    @Test
    public void testOccupy() throws SimulationError {
        var changelog = new ArrayChangeLog();
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json")
                .withChangeConsumer(changelog);
        testConfig.rjsInfra.switches.forEach(s -> s.groupChangeDelay = 0);
        testConfig.rjsSimulation.trainSchedules.clear();
        var preparedSim = testConfig.prepare();
        var sim = preparedSim.sim;

        var tvd1 = sim.infra.tvdSections.get("tvd.switch_foo");
        var tvd2 = sim.infra.tvdSections.get("tvd.track");
        var tvdState1 = sim.infraState.getTvdSectionState(tvd1.index);
        var tvdState2 = sim.infraState.getTvdSectionState(tvd2.index);
        var route = sim.infra.routeGraph.routeMap.get("rt.C1-S7");
        var routeState = sim.infraState.getRouteState(route.index);

        routeState.reserve(sim);

        makeFunctionEvent(sim, 1, () -> tvdState1.occupy(sim));
        makeFunctionEvent(sim, 1, () -> tvdState2.occupy(sim));
        makeFunctionEvent(sim, 2, () -> tvdState1.unoccupy(sim));
        makeFunctionEvent(sim, 2, () -> tvdState2.unoccupy(sim));

        makeAssertEvent(sim, 1.1, () -> routeState.status == RouteStatus.OCCUPIED);
        makeAssertEvent(sim, 2.1, () -> routeState.status == RouteStatus.FREE);

        preparedSim.run();
    }
}
