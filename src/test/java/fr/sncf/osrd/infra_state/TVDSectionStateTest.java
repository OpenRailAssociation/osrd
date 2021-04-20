package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.infra_state.Helpers.*;
import static org.junit.jupiter.api.Assertions.fail;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import org.junit.jupiter.api.Test;

public class TVDSectionStateTest {
    @Test
    public void testSimpleReserve() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;
        var changelog = new ArrayChangeLog();
        config.trainSchedules.clear();

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, changelog);

        var tvd = sim.infraState.getTvdSectionState(0);

        makeFunctionEvent(sim, 1, () -> tvd.reserve(sim));
        makeFunctionEvent(sim, 2, () -> tvd.free(sim));

        makeAssertEvent(sim, 1.1, () -> sim.infraState.getRouteState(0).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 1.1, () -> sim.infraState.getRouteState(7).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 1.1, () -> tvd.isReserved());
        makeAssertEvent(sim, 2.1, () -> sim.infraState.getRouteState(0).status == RouteStatus.FREE);
        makeAssertEvent(sim, 2.1, () -> sim.infraState.getRouteState(7).status == RouteStatus.FREE);
        makeAssertEvent(sim, 2.1, () -> ! tvd.isReserved());
        run(sim, config);
    }

    @Test
    public void testOccupy() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;
        var changelog = new ArrayChangeLog();
        config.trainSchedules.clear();

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, changelog);

        var tvd = sim.infraState.getTvdSectionState(0);
        var route = sim.infraState.getRouteState(0);

        route.reserve(sim);

        makeFunctionEvent(sim, 1, () -> {
            try {
                tvd.occupy(sim);
            } catch (SimulationError simulationError) {
                fail(simulationError);
            }
        });
        makeFunctionEvent(sim, 2, () -> tvd.unoccupy(sim));

        makeAssertEvent(sim, 1.1, () -> sim.infraState.getRouteState(0).status == RouteStatus.OCCUPIED);
        makeAssertEvent(sim, 2.1, () -> sim.infraState.getRouteState(0).status == RouteStatus.FREE);

        run(sim, config);
    }
}
