package fr.sncf.osrd.infra_state;

import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.SimulationTest;
import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.infra_state.events.SwitchMoveEvent;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.file.Path;
import java.security.AccessController;
import java.security.PrivilegedAction;
import java.util.ArrayList;
import java.util.function.BiConsumer;
import java.util.function.Function;

public class SwitchEventsTest {

    /** Generates the defaults infra from tiny_infra/infra.json, to be edited for each test */
    public Infra getBaseInfra() {
        try {
            ClassLoader classLoader = getClass().getClassLoader();
            var infraPath = classLoader.getResource("tiny_infra/infra.json");
            assert infraPath != null;
            return Infra.parseFromFile(JsonConfig.InfraType.UNKNOWN, infraPath.getFile());
        } catch (IOException | InvalidInfraException e) {
            fail(e);
            return null;
        }
    }

    /** Go through all the events in the simulation */
    public ArrayList<TimelineEvent> run(Simulation sim) {
        ClassLoader classLoader = getClass().getClassLoader();
        var configPath = classLoader.getResource("tiny_infra/config_railjson.json");
        assert configPath != null;
        var events = new ArrayList<TimelineEvent>();
        try {
            Config config = Config.readFromFile(Path.of(configPath.getFile()));
            for (var trainSchedule : config.trainSchedules)
                TrainCreatedEvent.plan(sim, trainSchedule);
            while (!sim.isSimulationOver())
                events.add(sim.step());
            return events;
        } catch (IOException | InvalidInfraException | InvalidRollingStock | InvalidSchedule | SimulationError e) {
            fail(e);
            return null;
        }
    }

    /** Generates an event that runs an assertion at a certain point in the simulation */
    public void makeAssertEvent(Simulation sim, double time, Function<Simulation, Boolean> predicate) {
        BiConsumer<Simulation, SimulationTest.TestEvent> consumer = (s, test) -> assertTrue(predicate.apply(s));
        SimulationTest.TestEvent.plan(sim, time, null, consumer);
    }

    /** Sets a field in an object, bypassing `final`.
     * This is used to make small changes in the infra for each test
     * */
    public void setField(Object o, String fieldName, Object value) {

        try {
            Field field = o.getClass().getDeclaredField(fieldName);
            AccessController.doPrivileged((PrivilegedAction<Void>) () -> {
                field.setAccessible(true);
                return null;
            });
            field.set(o, value);
        } catch (NoSuchFieldException | IllegalAccessException e) {
            fail(e);
        }
    }

    @Test
    public void testSwitchNoMove() {
        var infra = getBaseInfra();
        var sim = Simulation.createFromInfra(infra, 0, null);
        RouteState routeState = sim.infraState.getRouteState(3);
        makeAssertEvent(sim, 21, (s) -> routeState.status == RouteStatus.RESERVED);
        var events = run(sim);

        // The switch starts in the correct position, no switch move event should happen
        for (var e : events) {
            assertNotEquals(SwitchMoveEvent.class, e.getClass());
        }
    }

    @Test
    public void testSimpleSwitch() {
        var infra = getBaseInfra();

        // Set all the switch expected positions to RIGHT, to trigger a change
        var routes = infra.routeGraph.routeMap;
        routes.forEach((key, route) -> {
            var positions = route.switchesPosition;
            positions.replaceAll((k, v) -> SwitchPosition.RIGHT);
        });

        setField(infra.switches.get(0), "positionChangeDelay", 6);

        var sim = Simulation.createFromInfra(infra, 0, null);

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
    public void testSwitchLongerDelay() {
        var infra = getBaseInfra();

        // Set all the switch expected positions to RIGHT, to trigger a change
        var routes = infra.routeGraph.routeMap;
        routes.forEach((key, route) -> {
            var positions = route.switchesPosition;
            positions.replaceAll((k, v) -> SwitchPosition.RIGHT);
        });

        setField(infra.switches.get(0), "positionChangeDelay", 10);

        var sim = Simulation.createFromInfra(infra, 0, null);

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
