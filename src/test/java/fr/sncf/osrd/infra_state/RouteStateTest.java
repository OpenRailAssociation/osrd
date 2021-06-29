package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import org.junit.jupiter.api.Test;

import java.util.stream.Collectors;
import java.util.stream.Stream;

public class RouteStateTest {
    @Test
    public void testSimpleReserve() throws InvalidInfraException {
        final var infra = getBaseInfra();
        assert infra != null;
        final var config = getBaseConfig();
        assert config != null;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        config.trainSchedules.clear();

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.reserve(sim));
        makeAssertEvent(sim, 11, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(6).status == RouteStatus.CONFLICT);
        run(sim, config);
    }

    @Test
    public void testAwaitSwitchChange() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        assert infra != null;
        final var config = getBaseConfig();
        assert config != null;

        config.trainSchedules.clear();

        infra.switches.iterator().next().positionChangeDelay = 10;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setPosition(sim, SwitchPosition.RIGHT);

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.reserve(sim));
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 19, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 21, () -> routeState.status == RouteStatus.RESERVED);

        run(sim, config);
    }

    @Test
    public void testSeveralSwitches() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        assert infra != null;
        final var config = getBaseConfig();
        assert config != null;

        config.trainSchedules.clear();

        var oldSwitch = infra.switches.iterator().next();
        var newSwitch = new RJSSwitch("switch-foo-42", oldSwitch.base, oldSwitch.left,
                oldSwitch.right, 42);
        infra.switches.add(newSwitch);
        for (var route : infra.routes)
            if (route.id.equals("rt.C3-S7"))
                route.switchesPosition.put(new ID<>(newSwitch.id), RJSSwitch.Position.LEFT);

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setPosition(sim, SwitchPosition.RIGHT);
        sim.infraState.getSwitchState(1).setPosition(sim, SwitchPosition.RIGHT);

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 0, () -> routeState.reserve(sim));

        // at t=41, one switch is done moving but not the other
        makeAssertEvent(sim, 41, () -> routeState.status == RouteStatus.REQUESTED);
        // at t=43, both switches have moved
        makeAssertEvent(sim, 43, () -> routeState.status == RouteStatus.RESERVED);

        run(sim, config);
    }

    @Test
    public void testOccupied() throws InvalidInfraException {
        final var infra = getBaseInfra();
        assert infra != null;
        final var config = getBaseConfig();
        assert config != null;

        config.trainSchedules.clear();

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.reserve(sim));
        makeAssertEvent(sim, 10, () -> routeState.status == RouteStatus.RESERVED);
        makeFunctionEvent(sim, 15, () -> routeState.onTvdSectionOccupied(sim));
        makeAssertEvent(sim, 15, () -> routeState.status == RouteStatus.OCCUPIED);
        makeFunctionEvent(sim, 20, () -> {
            for (var section : routeState.route.tvdSectionsPaths)
                routeState.onTvdSectionUnoccupied(sim, sim.infraState.getTvdSectionState(section.tvdSection.index));
        });
        makeAssertEvent(sim, 20, () -> routeState.status == RouteStatus.FREE);

        run(sim, config);
    }

    @Test
    public void testReserveStatusChanges() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        assert infra != null;
        final var config = getBaseConfig();
        assert config != null;

        var changelog = new ArrayChangeLog();

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, changelog);

        config.trainSchedules.clear();

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.reserve(sim);
        run(sim, config);

        var changesSet = changelog.publishedChanges.stream()
                .filter(x -> x instanceof RouteState.RouteStatusChange)
                .map(Object::toString)
                .collect(Collectors.toSet());

        var expectedChanges = Stream.of(
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(2), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(6), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(7), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(8), RouteStatus.CONFLICT),

                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(3), RouteStatus.RESERVED)
        )
                .map(Object::toString)
                .collect(Collectors.toSet());
        assertEquals(expectedChanges, changesSet);
    }
}
