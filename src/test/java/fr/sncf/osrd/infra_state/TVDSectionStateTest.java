package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertNull;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import org.junit.jupiter.api.Test;

public class TVDSectionStateTest {
    @Test
    public void testSimpleReserve() throws InvalidInfraException {
        final var infra = getBaseInfra();
        assert infra != null;
        final var config = getBaseConfig();
        assert config != null;
        var changelog = new ArrayChangeLog();
        config.trainSchedules.clear();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, changelog);

        var tvd = sim.infra.tvdSections.get("tvd.foo_a");
        var tvdState = sim.infraState.getTvdSectionState(tvd.index);

        makeFunctionEvent(sim, 1, () -> tvdState.reserve(sim));
        makeFunctionEvent(sim, 2, () -> tvdState.free(sim));

        var routeAC1 = sim.infra.routeGraph.routeMap.get("rt.buffer_stop_a-C1");
        var routeAC1State = sim.infraState.getRouteState(routeAC1.index);
        var routeC6A = sim.infra.routeGraph.routeMap.get("rt.C6-buffer_stop_a");
        var routeC6AState = sim.infraState.getRouteState(routeC6A.index);
        makeAssertEvent(sim, 1.1, () -> routeAC1State.status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 1.1, () -> routeC6AState.status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 1.1, () -> tvdState.isReserved());
        makeAssertEvent(sim, 2.1, () -> routeAC1State.status == RouteStatus.FREE);
        makeAssertEvent(sim, 2.1, () -> routeC6AState.status == RouteStatus.FREE);
        makeAssertEvent(sim, 2.1, () -> ! tvdState.isReserved());
        run(sim, config);
    }

    @Test
    public void testOccupy() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        assert infra != null;
        final var config = getBaseConfig();
        assert config != null;
        var changelog = new ArrayChangeLog();
        config.trainSchedules.clear();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, changelog);

        var tvd = sim.infra.tvdSections.get("tvd.foo_a");
        var tvdState = sim.infraState.getTvdSectionState(tvd.index);
        var route = sim.infra.routeGraph.routeMap.get("rt.buffer_stop_a-C1");
        var routeState = sim.infraState.getRouteState(route.index);

        routeState.reserve(sim);

        makeFunctionEvent(sim, 1, () -> tvdState.occupy(sim));
        makeFunctionEvent(sim, 2, () -> tvdState.unoccupy(sim));

        makeAssertEvent(sim, 1.1, () -> routeState.status == RouteStatus.OCCUPIED);
        makeAssertEvent(sim, 2.1, () -> routeState.status == RouteStatus.FREE);

        run(sim, config);
    }
}
