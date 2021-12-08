package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertNull;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra_state.routes.RouteStatus;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import org.junit.jupiter.api.Test;

import java.util.stream.Collectors;

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

        var route = sim.infra.routeGraph.routeMap.values().stream()
                .filter(Route::isControlled).findFirst().get();

        var tvdStates = route.tvdSectionsPaths.stream()
                .map(tvdPath -> tvdPath.tvdSection)
                .map(section -> sim.infraState.getTvdSectionState(section.index))
                .collect(Collectors.toList());

        for (var tvd : tvdStates) {
            makeFunctionEvent(sim, 1, () -> tvd.reserve(sim));
            makeFunctionEvent(sim, 2, () -> tvd.free(sim));
        }

        var routeState = sim.infraState.getRouteState(route.index);
        makeAssertEvent(sim, 1.1, () -> routeState.status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 2.1, () -> routeState.status == RouteStatus.FREE);
        for (var tvd : tvdStates) {
            makeAssertEvent(sim, 1.1, tvd::isReserved);
            makeAssertEvent(sim, 2.1, () -> !tvd.isReserved());
        }

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

        var route = sim.infra.routeGraph.routeMap.values().stream()
                .filter(Route::isControlled).findFirst().get();
        var routeState = sim.infraState.getRouteState(route.index);
        routeState.reserve(sim);

        var tvdStates = route.tvdSectionsPaths.stream()
                .map(tvdPath -> tvdPath.tvdSection)
                .map(section -> sim.infraState.getTvdSectionState(section.index))
                .collect(Collectors.toList());

        for (var tvd : tvdStates) {
            makeFunctionEvent(sim, 1, () -> tvd.occupy(sim));
            makeFunctionEvent(sim, 2, () -> tvd.unoccupy(sim));
        }

        makeAssertEvent(sim, 1.1, () -> routeState.status == RouteStatus.OCCUPIED);
        makeAssertEvent(sim, 2.1, () -> routeState.status == RouteStatus.FREE);

        preparedSim.run();
    }
}
