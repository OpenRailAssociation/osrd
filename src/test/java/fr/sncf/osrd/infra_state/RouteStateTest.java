package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.Helpers.makeAssertEvent;
import static fr.sncf.osrd.Helpers.makeFunctionEvent;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.*;

import java.util.Collections;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import fr.sncf.osrd.TestConfig;
import java.util.ArrayList;
import fr.sncf.osrd.railjson.schema.RJSSuccessions;
import fr.sncf.osrd.railjson.schema.successiontable.RJSSuccessionTable;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.infra_state.routes.RouteState;
import fr.sncf.osrd.infra_state.routes.RouteStatus;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import java.util.Map;

public class RouteStateTest {
    /**
     * Test if a simple reservation work
     */
    @Test
    public void testSimpleReserve() {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.reserve(sim));
        makeAssertEvent(sim, 11, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(6).status == RouteStatus.CONFLICT);
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

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 11, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 11, routeState::hasCBTCStatus);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(6).status == RouteStatus.CONFLICT);
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

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.reserve(sim));
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
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

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
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

        rjsInfra.switchTypes.put(RJSSwitchType.CLASSIC_NAME, RJSSwitchType.CLASSIC_TYPE);
        var oldSwitch = rjsInfra.switches.iterator().next();
        var newSwitch = new RJSSwitch(
                "switch-foo-42",
                RJSSwitchType.CLASSIC_NAME,
                Map.of(
                    "base", oldSwitch.ports.get("base"),
                    "left", oldSwitch.ports.get("left"),
                    "right", oldSwitch.ports.get("right")
                ),
                42
        );
        rjsInfra.switches.add(newSwitch);
        for (var route : rjsInfra.routes) {
            if (route.id.equals("rt.C3-S7") || "rt.C6-buffer_stop_b".equals(route.id))
                route.switchesGroup.put(new ID<>(newSwitch.id), "LEFT");
            else if ("rt.C6-buffer_stop_a".equals(route.id))
                route.switchesGroup.put(new ID<>(newSwitch.id), "RIGHT");
        }

        var simState = testConfig.prepare();
        var sim = simState.sim;

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");
        sim.infraState.getSwitchState(1).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);

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
    public void testSeveralSwitchesCBTC() throws InvalidInfraException, SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");
        testConfig.rjsSimulation.trainSchedules.clear();
        var rjsInfra = testConfig.rjsInfra;
        rjsInfra.switchTypes.put(RJSSwitchType.CLASSIC_NAME, RJSSwitchType.CLASSIC_TYPE);
        var oldSwitch = rjsInfra.switches.iterator().next();
        var newSwitch = new RJSSwitch(
                "switch-foo-42",
                RJSSwitchType.CLASSIC_NAME,
                Map.of(
                        "base", oldSwitch.ports.get("base"),
                        "left", oldSwitch.ports.get("left"),
                        "right", oldSwitch.ports.get("right")
                ),
                42
        );
        rjsInfra.switches.add(newSwitch);
        for (var route : rjsInfra.routes) {
            if (route.id.equals("rt.C3-S7") || "rt.C6-buffer_stop_b".equals(route.id))
                route.switchesGroup.put(new ID<>(newSwitch.id), "LEFT");
            else if ("rt.C6-buffer_stop_a".equals(route.id))
                route.switchesGroup.put(new ID<>(newSwitch.id), "RIGHT");
        }

        var simState = testConfig.prepare();
        var sim = simState.sim;

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");
        sim.infraState.getSwitchState(1).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);
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

        RouteState routeState = sim.infraState.getRouteState(3);
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

        RouteState routeState = sim.infraState.getRouteState(3);
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

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.reserve(sim);

        simState.run();

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

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.cbtcReserve(sim);

        simState.run();

        var changesSet = changelog.publishedChanges.stream().filter(x -> x instanceof RouteState.RouteStatusChange)
                .map(Object::toString).collect(Collectors.toSet());

        var expectedChanges = Stream.of(
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(2), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(6), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(7), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(8), RouteStatus.CONFLICT),

                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(3), RouteStatus.RESERVED))
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

        RouteState routeState = sim.infraState.getRouteState(3);
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

        RouteState routeState = sim.infraState.getRouteState(3);
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

        RouteState routeState = sim.infraState.getRouteState(3);
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

        RouteState routeState = sim.infraState.getRouteState(3);
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

        RouteState routeState = sim.infraState.getRouteState(3);
        final var tvd = routeState.route.tvdSectionsPaths.get(0).tvdSection;
        // We reserve the route a first time
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 11, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(6).status == RouteStatus.CONFLICT);
        // We reserve the route a second time
        makeFunctionEvent(sim, 12, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 13, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 13, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 13, () -> sim.infraState.getRouteState(6).status == RouteStatus.CONFLICT);
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
    public void testReservedFailsIfRequested() throws InvalidInfraException, SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        testConfig.rjsSimulation.trainSchedules.clear();
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 10;

        var simState = testConfig.prepare();
        var sim = simState.sim;

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.reserve(sim);
        assert routeState.status == RouteStatus.REQUESTED;
        assertThrows(SimulationError.class, () -> routeState.reserve(sim));
    }

    /**
     * Checks that a route that has already been requested cannot be cbtc reserved
     */
    @Test
    public void testCBTCReservedFailsIfRequested() throws InvalidInfraException, SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        testConfig.rjsSimulation.trainSchedules.clear();
        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 10;

        var simState = testConfig.prepare();
        var sim = simState.sim;

        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.reserve(sim);
        assert routeState.status == RouteStatus.REQUESTED;
        assertThrows(SimulationError.class, () -> routeState.cbtcReserve(sim));
    }
    
    /**
     * Checks that a route that has already been cbtc requested cannot be reserved
     */
    @Test
    public void testReservedFailsIfCBTCRequested() throws InvalidInfraException, SimulationError {
        var testConfig = TestConfig.readResource("tiny_infra/config_railjson.json");

        testConfig.rjsInfra.switches.iterator().next().groupChangeDelay = 10;
        testConfig.rjsSimulation.trainSchedules.clear();

        var simState = testConfig.prepare();
        var sim = simState.sim;
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);
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
                    new ID<RJSRoute>("rt.C3-S7"),
                    new ID<RJSRoute>("rt.S7-buffer_stop_c"),
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
                    new ID<RJSRoute>("rt.C3-S7"),
                    new ID<RJSRoute>("rt.S7-buffer_stop_c"),
            };
            s.initialHeadLocation.trackSection = new ID<>("ne.micro.foo_to_bar");
            s.initialHeadLocation.offset = 100;
        });

        testConfig.run();
    }

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
                var expected = new RouteState.RouteStatusChange(simState.sim, routeState, status);
                assert changesSet.contains(expected.toString());
            }
        }
    }

    @Test
    public void testTinyInfra2Trains() throws InvalidInfraException {
        final var config = TestConfig.readResource("tiny_infra/config_railjson_2trains.json");
        
        var infra = config.rjsInfra;
        var switchID = infra.switches.stream().findFirst().get().id;
        var trainOrderedList = new ArrayList<String>();
        trainOrderedList.add("First");
        trainOrderedList.add("Second");

        var initTable = new RJSSuccessionTable(switchID, trainOrderedList.toArray(new String[2]));
        config.rjsSuccessions = new RJSSuccessions(Collections.singletonList(initTable));

        var simState = config.prepare();
        simState.run();
        var sim = simState.sim;
        var secondTrain = sim.trains.get("Second");
        var finalPosition = secondTrain.getLastState().location.getPathPosition();
        var initialPosition = Train.getInitialLocation(secondTrain.schedule, sim).getPathPosition();

        // Check that the second train moves
        assertNotEquals(initialPosition, finalPosition);
    }

    @Test
    public void testChangeSuccessionTableDuringSim() throws InvalidInfraException {
        final var config = TestConfig.readResource("tiny_infra/config_railjson_2trains.json");

        var switchID = config.rjsInfra.switches.stream().findFirst().get().id;

        var simState = config.prepare();
        var sim = simState.sim;

        // Change the succession Table
        var newTrainOrderedList = new ArrayList<String>();
        newTrainOrderedList.add("Second");
        newTrainOrderedList.add("First");
        var tstChange = new TowerState.SuccessionTableChange(sim, switchID, newTrainOrderedList);
        tstChange.apply(sim, tstChange.getEntity(sim));
        makeFunctionEvent(sim, 0, () -> {
            tstChange.apply(sim, tstChange.getEntity(sim));
            sim.publishChange(tstChange);
        });

        // Test that the second train is now the first of the list
        makeAssertEvent(sim, 0.5, () -> tstChange.getTable().get(0).equals("Second"));
        // Test that the request of the second train is accepted
        makeAssertEvent(sim, 6, () -> sim.infraState.towerState.isCurrentAllowed(switchID, "Second"));
        simState.run();
    }

    @Test
    @Disabled("Fixing this requires changes in the API and middle/front end, it will be done later")
    public void testCircularInfraRouteIndexes() {
        var changelog = new ArrayChangeLog();
        var config = TestConfig.readResource("circular_infra/config.json")
                .withChangeConsumer(changelog);

        var simState = config.prepare();
        simState.run();

        for (var train : simState.sim.trains.values()) {
            var trainState = train.getLastState();
            var path = train.schedule.plannedPath;
            assertEquals(path.routePath.size() - 1, trainState.routeIndex);
        }
    }
}
