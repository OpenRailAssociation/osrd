package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.Helpers.makeAssertEvent;
import static fr.sncf.osrd.Helpers.makeFunctionEvent;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.*;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.railjson.schema.successiontable.RJSTrainSuccessionTable;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.infra_state.routes.RouteState;
import fr.sncf.osrd.infra_state.routes.RouteStatus;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;

public class RouteStateTest {

    private static RouteState getRouteByName(Simulation sim, String name) {
        var index = sim.infra.routeGraph.routeMap.get(name).index;
        return sim.infraState.getRouteState(index);
    }

    /**
     * Test if a simple reservation work
     */
    @Test
    public void testSimpleReserve() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        makeFunctionEvent(sim, 10, () -> routeState.reserve(sim));
        makeAssertEvent(sim, 11, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 11, () ->
                getRouteByName(sim, "rt.tde.foo_a-switch_foo->buffer_stop_c").status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 11, () ->
                getRouteByName(sim, "rt.tde.switch_foo-track->buffer_stop_a").status == RouteStatus.CONFLICT);
        simState.run();
    }

    /**
     * Test if a simple cbtc reservation work
     */
    @Test
    public void testSimpleCBTCReserve() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 11, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 11, routeState::hasCBTCStatus);
        makeAssertEvent(sim, 11, ()
                -> getRouteByName(sim, "rt.tde.foo_a-switch_foo->buffer_stop_c").status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 11, ()
                -> getRouteByName(sim, "rt.tde.switch_foo-track->buffer_stop_a").status == RouteStatus.CONFLICT);
        simState.run();
    }

    /**
     * Check that the route waits until a switch is in the right group before
     * going into the RESERVED state.
     */
    @Test
    public void testAwaitSwitchChange() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();
        var rjsInfra = testConfig.rjsInfra;
        rjsInfra.switches.iterator().next().groupChangeDelay = 10;

        var simState = testConfig.prepare();
        var sim = simState.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        makeFunctionEvent(sim, 10, () -> routeState.reserve(sim));
        makeAssertEvent(sim, 11, () ->
                getRouteByName(sim, "rt.tde.foo_a-switch_foo->buffer_stop_c").status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 19, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 21, () -> routeState.status == RouteStatus.RESERVED);
        simState.run();
    }

    /**
     * Check that the route waits until a switch is in the right group before
     * going into the CBTC_RESERVED state.
     */
    @Test
    public void testAwaitSwitchChangeCBTC() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();
        var rjsInfra = testConfig.rjsInfra;
        rjsInfra.switches.iterator().next().groupChangeDelay = 10;

        var simState = testConfig.prepare();

        var sim = simState.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 11, () ->
                getRouteByName(sim, "rt.tde.foo_a-switch_foo->buffer_stop_c").status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 19, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 19, routeState::hasCBTCStatus);
        makeAssertEvent(sim, 21, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 21, routeState::hasCBTCStatus);
        simState.run();
    }

    /**
     * Check that the route waits until two switches are in the right group
     * before going into the RESERVED state.
     */
    @Test
    public void testSeveralSwitches() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();
        var rjsInfra = testConfig.rjsInfra;

        rjsInfra.switchTypes.add(RJSSwitchType.CLASSIC_TYPE);
        var oldSwitch = rjsInfra.switches.iterator().next();
        var newSwitch = new RJSSwitch(
                "switch-foo-42",
                RJSSwitchType.CLASSIC_REF,
                Map.of(
                    "base", oldSwitch.ports.get("base"),
                    "left", oldSwitch.ports.get("left"),
                    "right", oldSwitch.ports.get("right")
                ),
                42
        );
        rjsInfra.switches.add(newSwitch);

        var simState = testConfig.prepare();
        var sim = simState.sim;

        var aSwitch = sim.infra.switches.stream().filter(s -> s.id.equals(newSwitch.id)).findFirst();
        assert aSwitch.isPresent();

        for (var entry : sim.infra.routeGraph.routeMap.entrySet()) {
            var id = entry.getKey();
            var route = entry.getValue();
            if (id.equals("rt.C3-S7") || "rt.C6-buffer_stop_b".equals(id))
                route.switchesGroup.put(aSwitch.get(), "LEFT");
            else if ("rt.C6-buffer_stop_a".equals(id))
                route.switchesGroup.put(aSwitch.get(), "RIGHT");
        }

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");
        sim.infraState.getSwitchState(1).setGroup(sim, "RIGHT");

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");

        makeFunctionEvent(sim, 0, () -> routeState.reserve(sim));
        // at t=41, one switch is done moving but not the other
        makeAssertEvent(sim, 41, () -> routeState.status == RouteStatus.REQUESTED);
        // at t=43, both switches have moved
        makeAssertEvent(sim, 43, () -> routeState.status == RouteStatus.RESERVED);

        simState.run();
    }

    /**
     * Check that the route waits until two switches are in the right group
     * before going into the CBTC_RESERVED state.
     */
    @Test
    public void testSeveralSwitchesCBTC() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();
        var rjsInfra = testConfig.rjsInfra;
        rjsInfra.switchTypes.add(RJSSwitchType.CLASSIC_TYPE);
        var oldSwitch = rjsInfra.switches.iterator().next();
        var newSwitch = new RJSSwitch(
                "switch-foo-42",
                RJSSwitchType.CLASSIC_REF,
                Map.of(
                        "base", oldSwitch.ports.get("base"),
                        "left", oldSwitch.ports.get("left"),
                        "right", oldSwitch.ports.get("right")
                ),
                42
        );
        rjsInfra.switches.add(newSwitch);

        var simState = testConfig.prepare();
        var sim = simState.sim;

        var aSwitch = sim.infra.switches.stream().filter(s -> s.id.equals(newSwitch.id)).findFirst();
        assert aSwitch.isPresent();

        for (var route : sim.infra.routeGraph.routeMap.values()) {
            if (route.id.equals("rt.C3-S7") || "rt.C6-buffer_stop_b".equals(route.id))
                route.switchesGroup.put(aSwitch.get(), "LEFT");
            else if ("rt.C6-buffer_stop_a".equals(route.id))
                route.switchesGroup.put(aSwitch.get(), "RIGHT");
        }

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");
        sim.infraState.getSwitchState(1).setGroup(sim, "RIGHT");

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        makeFunctionEvent(sim, 0, () -> routeState.cbtcReserve(sim));

        // at t=41, one switch is done moving but not the other
        makeAssertEvent(sim, 41, () -> routeState.status == RouteStatus.REQUESTED);
        // at t=43, both switches have moved
        makeAssertEvent(sim, 43, () -> routeState.status == RouteStatus.RESERVED);

        simState.run();
    }

    /**
     * Checks that the route goes into the OCCUPIED state when a tvdSection is
     * occupied and that it becomes FREE when all tvdSection are unoccupied.
     */
    @Test
    public void testOccupied() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        var tvd = routeState.route.tvdSectionsPaths.get(0).tvdSection;
        makeFunctionEvent(sim, 10, () -> routeState.reserve(sim));
        makeAssertEvent(sim, 10, () -> routeState.status == RouteStatus.RESERVED);
        makeFunctionEvent(sim, 15, () -> routeState.onTvdSectionOccupied(sim, tvd));
        makeAssertEvent(sim, 15, () -> routeState.status == RouteStatus.OCCUPIED);
        makeFunctionEvent(sim, 20, () -> {
            for (var section : routeState.route.tvdSectionsPaths)
                routeState.onTvdSectionUnoccupied(sim, sim.infraState.getTvdSectionState(section.tvdSection.index));
        });
        makeAssertEvent(sim, 20, () -> routeState.status == RouteStatus.FREE);

        simState.run();
    }

    /**
     * Checks that the route goes into the CBTC_OCCUPIED state when a tvdSection is
     * occupied and that it becomes FREE when all tvdSection are unoccupied.
     */
    @Test
    public void testCBTCOccupied() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        var tvd = routeState.route.tvdSectionsPaths.get(0).tvdSection;
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 10, () -> routeState.status == RouteStatus.RESERVED);
        makeFunctionEvent(sim, 15, () -> routeState.onTvdSectionOccupied(sim, tvd));
        makeAssertEvent(sim, 15, () -> routeState.status == RouteStatus.OCCUPIED);
        makeFunctionEvent(sim, 20, () -> {
            for (var section : routeState.route.tvdSectionsPaths)
                routeState.onTvdSectionUnoccupied(sim, sim.infraState.getTvdSectionState(section.tvdSection.index));
        });
        makeAssertEvent(sim, 20, () -> routeState.status == RouteStatus.FREE);

        simState.run();
    }

    /**
     * Check that the route status changes are correct and in the right order.
     */
    @Test
    public void testReserveStatusChanges() throws SimulationError {
        var changelog = new ArrayChangeLog();
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json")
                .withChangeConsumer(changelog);
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        routeState.reserve(sim);

        simState.run();

        var changesSet = changelog.publishedChanges.stream()
                .filter(x -> x instanceof RouteState.RouteStatusChange)
                .map(Object::toString)
                .collect(Collectors.toSet());

        var expectedChanges = Stream.of(
                    new RouteState.RouteStatusChange(sim,
                            getRouteByName(sim, "rt.tde.foo_a-switch_foo->buffer_stop_c"), RouteStatus.CONFLICT),
                    new RouteState.RouteStatusChange(sim,
                            getRouteByName(sim, "rt.tde.switch_foo-track->buffer_stop_a"), RouteStatus.CONFLICT),
                    new RouteState.RouteStatusChange(sim, getRouteByName(sim,
                            "rt.tde.switch_foo-track->buffer_stop_b"), RouteStatus.CONFLICT),
    
                    new RouteState.RouteStatusChange(sim, getRouteByName(sim,
                            "rt.tde.foo_b-switch_foo->buffer_stop_c"), RouteStatus.RESERVED)
            )
                    .map(Object::toString)
                    .collect(Collectors.toSet());
        assertEquals(expectedChanges, changesSet);
    }

    /**
     * Check that the route status changes are correct and in the right order.
     */
    @Test
    public void testReserveStatusChangesCBTC() throws SimulationError {
        var changelog = new ArrayChangeLog();
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json")
                .withChangeConsumer(changelog);
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        routeState.cbtcReserve(sim);

        simState.run();

        var changesSet = changelog.publishedChanges.stream().filter(x -> x instanceof RouteState.RouteStatusChange)
                .map(Object::toString).collect(Collectors.toSet());

        var expectedChanges = Stream.of(
                new RouteState.RouteStatusChange(sim, getRouteByName(sim,
                        "rt.tde.foo_a-switch_foo->buffer_stop_c"), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, getRouteByName(sim,
                        "rt.tde.switch_foo-track->buffer_stop_a"), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, getRouteByName(sim,
                        "rt.tde.switch_foo-track->buffer_stop_b"), RouteStatus.CONFLICT),

                new RouteState.RouteStatusChange(sim, getRouteByName(sim,
                        "rt.tde.foo_b-switch_foo->buffer_stop_c"), RouteStatus.RESERVED))
                .map(Object::toString).collect(Collectors.toSet());
        assertEquals(expectedChanges, changesSet);
    }

    /**
     * Test that a normal reservation fails if a route is already RESERVED.
     */
    @Test
    public void testReserveFailsIfReserved() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_a-switch_foo->buffer_stop_c");
        routeState.reserve(sim);
        assertThrows(SimulationError.class, () -> routeState.reserve(sim));
    }

    /**
     * Test that a normal reservation fails if a route is already CBTC_RESERVED.
     */
    @Test
    public void testReserveFailsIfCBTCReserved() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        routeState.cbtcReserve(sim);
        assertThrows(SimulationError.class, () -> routeState.reserve(sim));
    }

    /**
     * Test that a cbtc reservation fails if a route is already RESERVED.
     */
    @Test
    public void testCBTCReserveFailsIfReserved() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        routeState.reserve(sim);
        assertThrows(SimulationError.class, () -> routeState.cbtcReserve(sim));
    }

    /**
     * Check that we cannot occupy a route if it is not reserved
     */
    @Test
    public void testOccupiedFailsIfNotReserved() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        var tvd = routeState.route.tvdSectionsPaths.get(0).tvdSection;
        assertThrows(SimulationError.class, () -> routeState.onTvdSectionOccupied(sim, tvd));
    }

    /**
     * Check that a route can be CBTC_RESERVED several times simultaneously.
     */
    @Test
    public void testMultipleCBTCReserve() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();
        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        final var tvd = routeState.route.tvdSectionsPaths.get(0).tvdSection;
        // We reserve the route a first time
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 11, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 11, () -> getRouteByName(sim,
                "rt.tde.foo_a-switch_foo->buffer_stop_c").status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 11, () -> getRouteByName(sim,
                "rt.tde.switch_foo-track->buffer_stop_a").status == RouteStatus.CONFLICT);
        // We reserve the route a second time
        makeFunctionEvent(sim, 12, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 13, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 13, () -> getRouteByName(sim,
                "rt.tde.foo_a-switch_foo->buffer_stop_c").status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 13, () -> getRouteByName(sim,
                "rt.tde.switch_foo-track->buffer_stop_a").status == RouteStatus.CONFLICT);
        // The first train enters the route
        makeFunctionEvent(sim, 14, () -> routeState.onTvdSectionOccupied(sim, tvd));
        makeAssertEvent(sim, 14, () -> routeState.status == RouteStatus.OCCUPIED);
        // The second train enters the route
        makeFunctionEvent(sim, 15, () -> routeState.onTvdSectionOccupied(sim, tvd));
        makeAssertEvent(sim, 15, () -> routeState.status == RouteStatus.OCCUPIED);
        // The first train leaves the route, but there is still the second train on the route
        makeFunctionEvent(sim, 16, () -> {
            for (var section : routeState.route.tvdSectionsPaths)
                routeState.onTvdSectionUnoccupied(sim, sim.infraState.getTvdSectionState(section.tvdSection.index));
        });
        makeAssertEvent(sim, 17, () -> routeState.status == RouteStatus.OCCUPIED);
        // The second train leaves the route, the route is now FREE
        makeFunctionEvent(sim, 18, () -> {
            for (var section : routeState.route.tvdSectionsPaths)
                routeState.onTvdSectionUnoccupied(sim, sim.infraState.getTvdSectionState(section.tvdSection.index));
        });
        makeAssertEvent(sim, 19, () -> routeState.status == RouteStatus.FREE);

        simState.run();
    }

    /**
     * Checks that a route that has already been requested cannot be reserved
     */
    @Test
    public void testReservedFailsIfRequested() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        testConfig.rjsSimulation.trainSchedules.clear();
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 10;

        var simState = testConfig.prepare();
        var sim = simState.sim;

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        routeState.reserve(sim);
        assert routeState.status == RouteStatus.REQUESTED;
        assertThrows(SimulationError.class, () -> routeState.reserve(sim));
    }

    /**
     * Checks that a route that has already been requested cannot be cbtc reserved
     */
    @Test
    public void testCBTCReservedFailsIfRequested() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        testConfig.rjsSimulation.trainSchedules.clear();
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 10;

        var simState = testConfig.prepare();
        var sim = simState.sim;

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        routeState.reserve(sim);
        assert routeState.status == RouteStatus.REQUESTED;
        assertThrows(SimulationError.class, () -> routeState.cbtcReserve(sim));
    }
    
    /**
     * Checks that a route that has already been cbtc requested cannot be reserved
     */
    @Test
    public void testReservedFailsIfCBTCRequested() throws SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 10;
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = getRouteByName(sim, "rt.tde.foo_b-switch_foo->buffer_stop_c");
        routeState.cbtcReserve(sim);
        assert routeState.status == RouteStatus.REQUESTED;
        assert routeState.hasCBTCStatus();
        assertThrows(SimulationError.class, () -> routeState.reserve(sim));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void testReserveRouteTrainStartNotOnFirstTrackSection() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        testConfig.rjsSimulation.trainSchedules.forEach(s -> {
            s.routes = (ID<RJSRoute>[]) new ID[]{
                    new ID<RJSRoute>("rt.tde.foo_b-switch_foo->buffer_stop_c"),
            };
            s.initialHeadLocation.trackSection = new ID<>("ne.micro.foo_to_bar");
            s.initialHeadLocation.offset = 10;
        });

        testConfig.run();
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void testReserveRouteTrainStartNotOnFirstTVD() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        testConfig.rjsSimulation.trainSchedules.forEach(s -> {
            s.routes = (ID<RJSRoute>[]) new ID[]{
                    new ID<RJSRoute>("rt.tde.foo_b-switch_foo->buffer_stop_c"),
            };
            s.initialHeadLocation.trackSection = new ID<>("ne.micro.foo_to_bar");
            s.initialHeadLocation.offset = 100;
        });

        testConfig.run();
    }

    @Disabled("see issue https://github.com/DGEXSolutions/osrd-core/issues/216")
    @Test
    public void testCircularInfraReserves() {
        var changelog = new ArrayChangeLog();
        var config = TestConfig.readResource("circular_infra/config.json")
                .withChangeConsumer(changelog);

        var schedules = config.rjsSimulation.trainSchedules;
        schedules.remove(2);
        schedules.remove(1);

        var simState = config.prepare();
        simState.run();

        var changesSet = changelog.publishedChanges.stream()
                .filter(x -> x instanceof RouteState.RouteStatusChange)
                .map(Object::toString)
                .collect(Collectors.toSet());

        // We check that every route has been reserved and occupied at least once
        for (int i = 0; i < config.rjsInfra.routes.size(); i++) {
            for (var status : new RouteStatus[]{RouteStatus.RESERVED, RouteStatus.OCCUPIED}) {
                var routeState = simState.sim.infraState.getRouteState(i);
                if (!routeState.route.isControlled() && status == RouteStatus.RESERVED)
                    continue;
                var expected = new RouteState.RouteStatusChange(simState.sim, routeState, status);
                assert changesSet.contains(expected.toString());
            }
        }
    }

    @Test
    public void testTinyInfra2Trains() {
        final var config = TestConfig.readResource("tiny_infra/config_railjson_2trains.json");
        
        var infra = config.rjsInfra;
        var switchID = infra.switches.stream().findFirst().get().id;
        var trainOrderedList = new ArrayList<String>();
        trainOrderedList.add("First");
        trainOrderedList.add("Second");

        var switchTST = new RJSTrainSuccessionTable(switchID, trainOrderedList.toArray(new String[2]));
        config.rjsSimulation.trainSuccessionTables = Collections.singletonList(switchTST);

        var simState = config.prepare();
        simState.run();
        var sim = simState.sim;
        var secondTrain = sim.trains.get("Second");
        var finalPosition = secondTrain.getLastState().location.getPathPosition();
        var initialPosition = 0.;

        // Check that the second train moves
        assertNotEquals(initialPosition, finalPosition);
    }

    @Test
    public void testChangeTSTTinyInfra() {
        final var config = TestConfig.readResource("tiny_infra/config_railjson_2trains.json");

        var switchID = config.rjsInfra.switches.stream().findFirst().get().id;

        var simState = config.prepare();
        var sim = simState.sim;

        // Change the succession Table
        var newTrainOrderedList = new ArrayDeque<String>();
        newTrainOrderedList.add("First");
        newTrainOrderedList.add("Second");
        var tst = sim.infraState.towerState.getTrainSuccessionTable(switchID);
        //tst.changeTrainOrder(sim, newTrainOrderedList);
        makeFunctionEvent(sim, 0, () -> tst.changeTrainOrder(sim, newTrainOrderedList));

        // Test the first train of the list
        makeAssertEvent(sim, 0, () -> tst.peekTrain().equals("First"));
        // Test that the request of the first train is accepted and log
        makeAssertEvent(sim, 6, () ->
                sim.infraState.towerState.trainSuccessionLog.get(switchID).contains("First"));
        // Test that after that the first train's request has been accepted,
        // the second train is now the first on the list
        makeAssertEvent(sim, 6, () -> tst.peekTrain().equals("Second"));
        simState.run();
    }

    @Test
    public void testChangeTST3TrainsInfra() {
        final var config = TestConfig.readResource(
                "three_trains/infra.json",
                "three_trains/simulation.json"
        );
        var simState = config.prepare();
        var sim = simState.sim;

        var newTrainOrderedList = new ArrayDeque<String>();
        newTrainOrderedList.add("train.0");
        newTrainOrderedList.add("train.2");

        var sortedSwitcheIds = sim.infra.switches.stream()
                .map(s -> s.id)
                .sorted()
                .collect(Collectors.toList());
        final var firstSwitchId = sortedSwitcheIds.get(0);
        final var secondSwitchId = sortedSwitcheIds.get(1);
        var firstTst = sim.infraState.towerState.getTrainSuccessionTable(firstSwitchId);
        var secondTst = sim.infraState.towerState.getTrainSuccessionTable(secondSwitchId);
        makeFunctionEvent(sim, 90, () -> {
            firstTst.changeTrainOrder(sim, newTrainOrderedList);
            secondTst.changeTrainOrder(sim, newTrainOrderedList);
        });

        // Test the first train of the list
        makeAssertEvent(sim, 89, () -> firstTst.peekTrain().equals("train.2"));
        makeAssertEvent(sim, 91, () -> firstTst.peekTrain().equals("train.0"));

        simState.run();
        // Test that the request of the train_0 is accepted and log
        for (var switchID : Arrays.asList(firstSwitchId, secondSwitchId)) {
            var log = sim.infraState.towerState.trainSuccessionLog.get(switchID);
            assertEquals(Arrays.asList("train.1", "train.0", "train.2"), log);
        }
        assertTrue(sim.trains.get("train.0").getLastState().time < sim.trains.get("train.2").getLastState().time);
    }

    @Test
    @SuppressWarnings({"unchecked"})
    public void testSpawnOverReservableRoute() {
        final var config = TestConfig.readResource("tiny_infra/config_railjson.json");
        var rjsTrainSchedule = config.rjsSimulation.trainSchedules.get(0);
        rjsTrainSchedule.initialHeadLocation.offset = 180;
        rjsTrainSchedule.routes = (ID<RJSRoute>[]) new ID<?>[] {
                new ID<RJSRoute>("rt.tde.foo_b-switch_foo->buffer_stop_c"),
        };

        var simState = config.prepare();
        simState.run();
        var towerState = simState.sim.infraState.towerState;
        assertTrue(towerState.trainSuccessionLog.get("il.switch_foo").contains("Test."));
    }
}
