package fr.sncf.osrd.infra_state;

import static fr.sncf.osrd.Helpers.getBaseConfig;
import static fr.sncf.osrd.Helpers.getBaseInfra;
import static fr.sncf.osrd.Helpers.getResourcePath;
import static fr.sncf.osrd.Helpers.makeAssertEvent;
import static fr.sncf.osrd.Helpers.makeFunctionEvent;
import static fr.sncf.osrd.Helpers.run;
import static fr.sncf.osrd.infra.Infra.parseFromFile;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.config.JsonConfig;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.parser.RJSSimulationParser;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.RJSSimulation;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitch;
import fr.sncf.osrd.railjson.schema.infra.RJSSwitchType;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.utils.PathUtils;
import fr.sncf.osrd.utils.moshi.MoshiUtils;

import java.util.Map;

public class RouteStateTest {
    
    /**
     * Test if a simple reservation work
     */
    @Test
    public void testSimpleReserve() throws InvalidInfraException {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

        config.trainSchedules.clear();

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.reserve(sim));
        makeAssertEvent(sim, 11, () -> routeState.status == RouteStatus.RESERVED);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(6).status == RouteStatus.CONFLICT);
        run(sim, config);
    }

    /**
     * Test if a simple cbtc reservation work
     */
    @Test
    public void testSimpleCBTCReserve() throws InvalidInfraException {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

        config.trainSchedules.clear();

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 11, () -> routeState.status == RouteStatus.CBTC_RESERVED);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(6).status == RouteStatus.CONFLICT);
        run(sim, config);
    }

    /**
     * Check that the route waits until a switch is in the right group before
     * going into the RESERVED state.
     */
    @Test
    public void testAwaitSwitchChange() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        config.trainSchedules.clear();

        infra.switches.iterator().next().groupChangeDelay = 10;

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.reserve(sim));
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 19, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 21, () -> routeState.status == RouteStatus.RESERVED);
        run(sim, config);
    }

    /**
     * Check that the route waits until a switch is in the right group before
     * going into the CBTC_RESERVED state.
     */
    @Test
    public void testAwaitSwitchChangeCBTC() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        config.trainSchedules.clear();

        infra.switches.iterator().next().groupChangeDelay = 10;

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 19, () -> routeState.status == RouteStatus.CBTC_REQUESTED);
        makeAssertEvent(sim, 21, () -> routeState.status == RouteStatus.CBTC_RESERVED);
        run(sim, config);
    }

    /**
     * Check that the route waits until two switches are in the right group
     * before going into the RESERVED state.
     */
    @Test
    public void testSeveralSwitches() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        config.trainSchedules.clear();

        infra.switchTypes.put(RJSSwitchType.CLASSIC_NAME, RJSSwitchType.CLASSIC_TYPE);
        var oldSwitch = infra.switches.iterator().next();
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
        infra.switches.add(newSwitch);
        for (var route : infra.routes)
            if (route.id.equals("rt.C3-S7"))
                route.switchesGroup.put(new ID<>(newSwitch.id), "LEFT");

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");
        sim.infraState.getSwitchState(1).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);

        makeFunctionEvent(sim, 0, () -> routeState.reserve(sim));
        // at t=41, one switch is done moving but not the other
        makeAssertEvent(sim, 41, () -> routeState.status == RouteStatus.REQUESTED);
        // at t=43, both switches have moved
        makeAssertEvent(sim, 43, () -> routeState.status == RouteStatus.RESERVED);

        run(sim, config);
    }

    /**
     * Check that the route waits until two switches are in the right group
     * before going into the CBTC_RESERVED state.
     */
    @Test
    public void testSeveralSwitchesCBTC() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        config.trainSchedules.clear();

        infra.switchTypes.put(RJSSwitchType.CLASSIC_NAME, RJSSwitchType.CLASSIC_TYPE);
        var oldSwitch = infra.switches.iterator().next();
        var newSwitch = new RJSSwitch(
                "switch-foo-42",
                  RJSSwitchType.CLASSIC_NAME,
                  Map.of(
                    "base", oldSwitch.ports.get("base"),
                    "left", oldSwitch.ports.get("base"),
                    "right", oldSwitch.ports.get("right")
                ),
                42
        );
        infra.switches.add(newSwitch);
        for (var route : infra.routes)
            if (route.id.equals("rt.C3-S7"))
                route.switchesGroup.put(new ID<>(newSwitch.id), "LEFT");

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");
        sim.infraState.getSwitchState(1).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 0, () -> routeState.cbtcReserve(sim));
    
        // at t=41, one switch is done moving but not the other
        makeAssertEvent(sim, 41, () -> routeState.status == RouteStatus.CBTC_REQUESTED);
        // at t=43, both switches have moved
        makeAssertEvent(sim, 43, () -> routeState.status == RouteStatus.CBTC_RESERVED);

        run(sim, config);
    }

    /**
     * Checks that the route goes into the OCCUPIED state when a tvdSection is
     * occupied and that it becomes FREE when all tvdSection are unoccupied.
     */
    @Test
    public void testOccupied() throws InvalidInfraException {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        config.trainSchedules.clear();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

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

    /**
     * Checks that the route goes into the CBTC_OCCUPIED state when a tvdSection is
     * occupied and that it becomes FREE when all tvdSection are unoccupied.
     */
    @Test
    public void testCBTCOccupied() throws InvalidInfraException {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        config.trainSchedules.clear();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

        RouteState routeState = sim.infraState.getRouteState(3);
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 10, () -> routeState.status == RouteStatus.CBTC_RESERVED);
        makeFunctionEvent(sim, 15, () -> routeState.onTvdSectionOccupied(sim));
        makeAssertEvent(sim, 15, () -> routeState.status == RouteStatus.CBTC_OCCUPIED);
        makeFunctionEvent(sim, 20, () -> {
            for (var section : routeState.route.tvdSectionsPaths)
                routeState.onTvdSectionUnoccupied(sim, sim.infraState.getTvdSectionState(section.tvdSection.index));
        });
        makeAssertEvent(sim, 20, () -> routeState.status == RouteStatus.FREE);

        run(sim, config);
    }

    /**
     * Check that the route status changes are correct and in the right order.
     */
    @Test
    public void testReserveStatusChanges() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        var changelog = new ArrayChangeLog();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, changelog);

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

    /**
     * Check that the route status changes are correct and in the right order.
     */
    @Test
    public void testReserveStatusChangesCBTC() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        var changelog = new ArrayChangeLog();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, changelog);

        config.trainSchedules.clear();

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.cbtcReserve(sim);
        run(sim, config);

        var changesSet = changelog.publishedChanges.stream().filter(x -> x instanceof RouteState.RouteStatusChange)
                .map(Object::toString).collect(Collectors.toSet());

        var expectedChanges = Stream.of(
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(2), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(6), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(7), RouteStatus.CONFLICT),
                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(8), RouteStatus.CONFLICT),

                new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(3), RouteStatus.CBTC_RESERVED))
                .map(Object::toString).collect(Collectors.toSet());
        assertEquals(expectedChanges, changesSet);
    }

    /**
     * Test that a normal reservation fails if a route is already RESERVED.
     */
    @Test
    public void testReserveFailsIfReserved() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.reserve(sim);
        assertThrows(AssertionError.class, () -> routeState.reserve(sim));
    }

    /**
     * Test that a normal reservation fails if a route is already CBTC_RESERVED.
     */
    @Test
    public void testReserveFailsIfCBTCReserved() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.cbtcReserve(sim);
        assertThrows(AssertionError.class, () -> routeState.reserve(sim));
    }

    /**
     * Test that a cbtc reservation fails if a route is already RESERVED.
     */
    @Test
    public void testCBTCReserveFailsIfReserved() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.reserve(sim);
        assertThrows(AssertionError.class, () -> routeState.cbtcReserve(sim));
    }

    /**
     * Check that we cannot occupy a route if it is not reserved
     */
    @Test
    public void testOccupiedFailsIfNotReserved() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

        RouteState routeState = sim.infraState.getRouteState(3);
        assertThrows(SimulationError.class, () -> routeState.onTvdSectionOccupied(sim));
    }

    /**
     * Check that a route can be CBTC_RESERVED several times simultaneously.
     */
    @Test
    public void testMultipleCBTCReserve() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);

        config.trainSchedules.clear();

        RouteState routeState = sim.infraState.getRouteState(3);
        // We reserve the route a first time
        makeFunctionEvent(sim, 10, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 11, () -> routeState.status == RouteStatus.CBTC_RESERVED);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 11, () -> sim.infraState.getRouteState(6).status == RouteStatus.CONFLICT);
        // We reserve the route a second time
        makeFunctionEvent(sim, 12, () -> routeState.cbtcReserve(sim));
        makeAssertEvent(sim, 13, () -> routeState.status == RouteStatus.CBTC_RESERVED);
        makeAssertEvent(sim, 13, () -> sim.infraState.getRouteState(2).status == RouteStatus.CONFLICT);
        makeAssertEvent(sim, 13, () -> sim.infraState.getRouteState(6).status == RouteStatus.CONFLICT);
        // The first train enters the route
        makeFunctionEvent(sim, 14, () -> routeState.onTvdSectionOccupied(sim));
        makeAssertEvent(sim, 14, () -> routeState.status == RouteStatus.CBTC_OCCUPIED);
        // The second train enters the route
        makeFunctionEvent(sim, 15, () -> routeState.onTvdSectionOccupied(sim));
        makeAssertEvent(sim, 15, () -> routeState.status == RouteStatus.CBTC_OCCUPIED);
        // The first train leaves the route, but there is still the second train on the route
        makeFunctionEvent(sim, 16, () -> {
            for (var section : routeState.route.tvdSectionsPaths)
                routeState.onTvdSectionUnoccupied(sim, sim.infraState.getTvdSectionState(section.tvdSection.index));
        });
        makeAssertEvent(sim, 17, () -> routeState.status == RouteStatus.CBTC_OCCUPIED);
        // The second train leaves the route, the route is now FREE
        makeFunctionEvent(sim, 18, () -> {
            for (var section : routeState.route.tvdSectionsPaths)
                routeState.onTvdSectionUnoccupied(sim, sim.infraState.getTvdSectionState(section.tvdSection.index));
        });
        makeAssertEvent(sim, 19, () -> routeState.status == RouteStatus.FREE);
        run(sim, config);
    }

    /**
     * Checks that a route that has already been requested cannot be reserved
     */
    @Test
    public void testReservedFailsIfRequested() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        config.trainSchedules.clear();

        infra.switches.iterator().next().groupChangeDelay = 10;

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.reserve(sim);
        assert routeState.status == RouteStatus.REQUESTED;
        assertThrows(AssertionError.class, () -> routeState.reserve(sim));
    }

    /**
     * Checks that a route that has already been requested cannot be cbtc reserved
     */
    @Test
    public void testCBTCReservedFailsIfRequested() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        config.trainSchedules.clear();

        infra.switches.iterator().next().groupChangeDelay = 10;

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.reserve(sim);
        assert routeState.status == RouteStatus.REQUESTED;
        assertThrows(AssertionError.class, () -> routeState.cbtcReserve(sim));
    }
    
    /**
     * Checks that a route that has already been cbtc requested cannot be reserved
     */
    @Test
    public void testReservedFailsIfCBTCRequested() throws InvalidInfraException, SimulationError {
        final var infra = getBaseInfra();
        final var config = getBaseConfig();

        config.trainSchedules.clear();

        infra.switches.iterator().next().groupChangeDelay = 10;

        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setGroup(sim, "RIGHT");

        RouteState routeState = sim.infraState.getRouteState(3);
        routeState.cbtcReserve(sim);
        assert routeState.status == RouteStatus.CBTC_REQUESTED;
        assertThrows(AssertionError.class, () -> routeState.reserve(sim));
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void testReserveRouteTrainStartNotOnFirstTrackSection()
            throws InvalidInfraException, IOException, InvalidRollingStock, InvalidSchedule {
        final var infra = getBaseInfra();
        var path = getResourcePath("tiny_infra/config_railjson.json");
        var baseDirPath = path.getParent();
        var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, path);
        final var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        final var rjsInfra = parseFromFile(jsonConfig.infraType, infraPath.toString());
        var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
        var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);

        schedule.trainSchedules.forEach(s -> {
            s.routes = (ID<RJSRoute>[]) new ID[]{
                    new ID<RJSRoute>("rt.C3-S7"),
                    new ID<RJSRoute>("rt.S7-buffer_stop_c"),
            };
            s.initialHeadLocation.trackSection = new ID<>("ne.micro.foo_to_bar");
            s.initialHeadLocation.offset = 10;
        });

        var trainSchedules = RJSSimulationParser.parse(rjsInfra, schedule);
        var config = new Config(
                jsonConfig.simulationTimeStep,
                rjsInfra,
                trainSchedules,
                null,
                jsonConfig.simulationStepPause,
                false,
                jsonConfig.realTimeViewer,
                jsonConfig.changeReplayCheck
        );
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra),
                0, null);

        run(sim, config);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    public void testReserveRouteTrainStartNotOnFirstTVD()
            throws InvalidInfraException, IOException, InvalidRollingStock, InvalidSchedule {
        final var infra = getBaseInfra();
        var path = getResourcePath("tiny_infra/config_railjson.json");
        var baseDirPath = path.getParent();
        var jsonConfig = MoshiUtils.deserialize(JsonConfig.adapter, path);
        final var infraPath = PathUtils.relativeTo(baseDirPath, jsonConfig.infraPath);
        final var rjsInfra = parseFromFile(jsonConfig.infraType, infraPath.toString());
        var schedulePath = PathUtils.relativeTo(baseDirPath, jsonConfig.simulationPath);
        var schedule = MoshiUtils.deserialize(RJSSimulation.adapter, schedulePath);

        schedule.trainSchedules.forEach(s -> {
            s.routes = (ID<RJSRoute>[]) new ID[]{
                    new ID<RJSRoute>("rt.C3-S7"),
                    new ID<RJSRoute>("rt.S7-buffer_stop_c"),
            };
            s.initialHeadLocation.trackSection = new ID<>("ne.micro.foo_to_bar");
            s.initialHeadLocation.offset = 100;
        });

        var trainSchedules = RJSSimulationParser.parse(rjsInfra, schedule);
        var config = new Config(
                jsonConfig.simulationTimeStep,
                rjsInfra,
                trainSchedules,
                null,
                jsonConfig.simulationStepPause,
                false,
                jsonConfig.realTimeViewer,
                jsonConfig.changeReplayCheck
        );
        var sim = Simulation.createFromInfraAndEmptySuccessions(RailJSONParser.parse(infra),
                0, null);

        run(sim, config);
    }

    @Test
    public void testCircularInfraReserves() throws InvalidInfraException {
        final var infra = getBaseInfra("circular_infra/infra.json");
        final var config = getBaseConfig("circular_infra/config.json");

        var changelog = new ArrayChangeLog();

        var sim = Simulation.createFromInfraAndSuccessions(RailJSONParser.parse(infra),
                config.switchSuccessions, 0, changelog);

        config.trainSchedules.remove(2);
        config.trainSchedules.remove(1);

        run(sim, config);

        var changesSet = changelog.publishedChanges.stream()
                .filter(x -> x instanceof RouteState.RouteStatusChange)
                .map(Object::toString)
                .collect(Collectors.toSet());

        // We check that every route has been reserved and occupied at least once
        for (int i = 0; i < infra.routes.size(); i++) {
            for (var status : new RouteStatus[]{RouteStatus.RESERVED, RouteStatus.OCCUPIED}) {
                var expected = new RouteState.RouteStatusChange(sim, sim.infraState.getRouteState(i), status);
                assert changesSet.contains(expected.toString());
            }
        }
    }

    @Test
    @Disabled("Fixing this requires changes in the API and middle/front end, it will be done later")
    public void testCircularInfraRouteIndexes() throws InvalidInfraException {
        final var infra = getBaseInfra("circular_infra/infra.json");
        final var config = getBaseConfig("circular_infra/config.json");

        var changelog = new ArrayChangeLog();

        var sim = Simulation.createFromInfraAndSuccessions(RailJSONParser.parse(infra),
                config.switchSuccessions, 0, changelog);

        run(sim, config);

        for (var train : sim.trains.values()) {
            var trainState = train.getLastState();
            var path = train.schedule.plannedPath;
            assertEquals(path.routePath.size() - 1, trainState.routeIndex);
        }
    }
}
