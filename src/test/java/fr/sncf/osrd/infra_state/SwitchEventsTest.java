package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.infra_state.Helpers.*;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.infra_state.events.SwitchMoveEvent;
import org.junit.jupiter.api.Test;

public class SwitchEventsTest {
    @Test
    public void testSwitchNoMove() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        RouteState routeState = sim.infraState.getRouteState(3);
        makeAssertEvent(sim, 21, (s) -> routeState.status == RouteStatus.RESERVED);
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

        // Set all the switch expected positions to RIGHT, to trigger a change
        infra.routes.forEach((route) -> {
            var positions = route.switchesPosition;
            positions.replaceAll((k, v) -> RJSSwitch.Position.RIGHT);
        });

        infra.switches.iterator().next().positionChangeDelay = 6;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        SwitchState switchState = sim.infraState.getSwitchState(0);
        RouteState routeState = sim.infraState.getRouteState(3);
        makeAssertEvent(sim, 19, (s) -> switchState.getPosition() == SwitchPosition.LEFT);
        makeAssertEvent(sim, 21, (s) -> switchState.getPosition() == SwitchPosition.MOVING);
        makeAssertEvent(sim, 21, (s) -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 27, (s) -> switchState.getPosition() == SwitchPosition.RIGHT);
        makeAssertEvent(sim, 27, (s) -> routeState.status == RouteStatus.RESERVED);

        run(sim);
    }

    @Test
    public void testSwitchLongerDelay() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;

        // Set all the switch expected positions to RIGHT, to trigger a change
        infra.routes.forEach((route) -> {
            var positions = route.switchesPosition;
            positions.replaceAll((k, v) -> RJSSwitch.Position.RIGHT);
        });

        infra.switches.iterator().next().positionChangeDelay = 10;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        SwitchState switchState = sim.infraState.getSwitchState(0);
        RouteState routeState = sim.infraState.getRouteState(3);
        makeAssertEvent(sim, 19, (s) -> switchState.getPosition() == SwitchPosition.LEFT);
        makeAssertEvent(sim, 25, (s) -> switchState.getPosition() == SwitchPosition.MOVING);
        makeAssertEvent(sim, 25, (s) -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 31, (s) -> switchState.getPosition() == SwitchPosition.RIGHT);
        makeAssertEvent(sim, 31, (s) -> routeState.status == RouteStatus.RESERVED);

        run(sim);
    }
}
