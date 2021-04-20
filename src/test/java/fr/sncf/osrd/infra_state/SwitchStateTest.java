package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.infra_state.events.SwitchMoveEvent;
import fr.sncf.osrd.simulation.SimulationError;
import org.junit.jupiter.api.Test;

public class SwitchStateTest {
    @Test
    public void testSwitchNoMove() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        RouteState routeState = sim.infraState.getRouteState(3);
        makeAssertEvent(sim, 21, () -> routeState.status == RouteStatus.RESERVED);
        var events = run(sim);
        assert events != null;

        // The switch starts in the correct position, no switch move event should happen
        for (var e : events) {
            assertNotEquals(SwitchMoveEvent.class, e.getClass());
        }
    }

    @Test
    public void testSimpleSwitch() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;

        config.trainSchedules.clear();

        // Set all the switch expected positions to RIGHT, to trigger a change
        infra.routes.forEach((route) -> {
            var positions = route.switchesPosition;
            positions.replaceAll((k, v) -> RJSSwitch.Position.RIGHT);
        });

        infra.switches.iterator().next().positionChangeDelay = 6;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        SwitchState switchState = sim.infraState.getSwitchState(0);
        RouteState routeState = sim.infraState.getRouteState(3);
        double requestTime = 42;
        makeFunctionEvent(sim, requestTime, () -> {
            try {
                routeState.reserve(sim);
            } catch (SimulationError simulationError) {
                throw new RuntimeException(simulationError);
            }
        });
        makeAssertEvent(sim, requestTime + 1, () -> switchState.getPosition() == SwitchPosition.MOVING);
        makeAssertEvent(sim, requestTime + 1, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, requestTime + 7, () -> switchState.getPosition() == SwitchPosition.RIGHT);
        makeAssertEvent(sim, requestTime + 7, () -> routeState.status == RouteStatus.RESERVED);

        run(sim, config);
    }

    @Test
    public void testSwitchShorterDelay() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;

        // Set all the switch expected positions to RIGHT, to trigger a change
        infra.routes.forEach((route) -> {
            var positions = route.switchesPosition;
            positions.replaceAll((k, v) -> RJSSwitch.Position.RIGHT);
        });

        infra.switches.iterator().next().positionChangeDelay = 2;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        SwitchState switchState = sim.infraState.getSwitchState(0);
        RouteState routeState = sim.infraState.getRouteState(3);
        makeAssertEvent(sim, 0, () -> switchState.getPosition() == SwitchPosition.LEFT);
        makeAssertEvent(sim, 2, () -> switchState.getPosition() == SwitchPosition.MOVING);
        makeAssertEvent(sim, 2, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 3, () -> switchState.getPosition() == SwitchPosition.RIGHT);
        makeAssertEvent(sim, 3, () -> routeState.status == RouteStatus.RESERVED);

        run(sim);
    }
}
