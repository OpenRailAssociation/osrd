package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;
import fr.sncf.osrd.railjson.schema.infra.RJSRoute;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.utils.SortedDoubleMap;
import org.junit.jupiter.api.Test;

import java.util.*;

import static fr.sncf.osrd.Helpers.*;
import static fr.sncf.osrd.speedcontroller.MarginTests.saveGraph;
import static fr.sncf.osrd.speedcontroller.SpeedInstructionsTests.getStaticGenerator;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class PasesTest {

    @Test
    public void testSimplePhases() throws InvalidInfraException {
        var infra = getBaseInfra();

        var config = getBaseConfig("tiny_infra/config_railjson_several_phases.json");
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var actualEndTime = sim.getTime();

        var configBase = getBaseConfig();
        var simBase = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(simBase, configBase);
        var baseEndTime = simBase.getTime();

        assertEquals(baseEndTime, actualEndTime, baseEndTime * 0.1);
    }

    public static SortedDoubleMap getTimePerPosition(Iterable<TimelineEvent> events) {
        var res = new SortedDoubleMap();
        for (var event : events) {
            if (event instanceof TrainReachesActionPoint) {
                var trainReachesActionPoint = (TrainReachesActionPoint) event;
                for (var update : trainReachesActionPoint.trainStateChange.positionUpdates)
                    res.put(update.pathPosition, update.time);
            }
        }
        return res;
    }

    @Test
    public void testSameEventTimes() throws InvalidInfraException {
        var infra = getBaseInfra();

        var config = getBaseConfig("tiny_infra/config_railjson_several_phases.json");
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var events = run(sim, config);

        var configBase = makeConfigWithSpeedParams(Collections.singletonList(null));
        var simBase = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var eventsRef = run(simBase, configBase);

        assertEquals(eventsRef.size() + 2, events.size());

        var resultTimePerPosition = getTimePerPosition(events);
        var expectedTimePerPosition = getTimePerPosition(eventsRef);

        for (double t = expectedTimePerPosition.firstKey(); t < expectedTimePerPosition.lastKey(); t += 1) {
            var expected = expectedTimePerPosition.interpolate(t);
            var result = resultTimePerPosition.interpolate(t);
            assertEquals(expected, result, expected * 0.01);
        }
    }

    @Test
    public void testReactToSignals() throws InvalidInfraException, SimulationError {
        var infra = getBaseInfra();
        var config = getBaseConfig("tiny_infra/config_railjson_several_phases.json");

        infra.switches.iterator().next().positionChangeDelay = 500;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setPosition(sim, SwitchPosition.RIGHT);

        // If the train ignores the signals, an exception will be thrown when it runs over the moving switch
        run(sim, config);
    }

    @Test
    public void testTriggerSwitchChangeAtRightTime() throws InvalidInfraException, SimulationError {
        var infra = getBaseInfra();
        var config = getBaseConfig("tiny_infra/config_railjson_several_phases.json");

        infra.switches.iterator().next().positionChangeDelay = 42;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setPosition(sim, SwitchPosition.RIGHT);

        SwitchState switchState = sim.infraState.getSwitchState(0);
        RouteState routeState = sim.infraState.getRouteState(3);
        makeAssertEvent(sim, 0, () -> switchState.getPosition() == SwitchPosition.RIGHT);
        makeAssertEvent(sim, 41, () -> switchState.getPosition() == SwitchPosition.MOVING);
        makeAssertEvent(sim, 41, () -> routeState.status == RouteStatus.REQUESTED);
        makeAssertEvent(sim, 43, () -> switchState.getPosition() == SwitchPosition.LEFT);
        makeAssertEvent(sim, 43, () -> routeState.status == RouteStatus.RESERVED);

        run(sim, config);
    }

    @Test
    public void testDifferentSpeedLimits() throws InvalidInfraException {
        var infra = getBaseInfra();
        var config = getBaseConfig("tiny_infra/config_railjson_several_phases.json");

        var phases = config.trainSchedules.get(0).phases;
        assert phases.get(0) instanceof SignalNavigatePhase;
        var phase1 = (SignalNavigatePhase) phases.get(0);
        assert phases.get(1) instanceof SignalNavigatePhase;
        var phase2 = (SignalNavigatePhase) phases.get(1);
        phase1.targetSpeedGenerators = Collections.singletonList(getStaticGenerator(2));

        phase2.targetSpeedGenerators = Collections.singletonList(getStaticGenerator(Double.POSITIVE_INFINITY));

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
    }

    @Test
    public void testSeveralPhasesNoMargin() throws InvalidInfraException {
        var infra = getBaseInfra();

        var phases = loadPhasesLongerFirstPhase();
        var config = makeConfigWithGivenPhases(phases, "tiny_infra/config_railjson_several_phases.json");
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        saveGraph(run(sim, config), "double-construction-out.csv");
        var actualEndTime = sim.getTime();

        var config_base = makeConfigWithSpeedParams(null);
        var sim_base = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        saveGraph(run(sim_base, config_base), "double-construction-base.csv");
        var baseEndTime = sim_base.getTime();

        var expected = baseEndTime + 0;

        assertEquals(expected, actualEndTime, expected * 0.01);
    }

    @Test
    public void testSeveralConstructionMargins() throws InvalidInfraException {
        var infra = getBaseInfra();
        var param1 = new RJSAllowance.ConstructionAllowance();
        var param2 = new RJSAllowance.ConstructionAllowance();
        param1.allowanceValue = 15;
        param2.allowanceValue = 30;
        var phases = loadPhasesLongerFirstPhase();

        phases[0].allowances = new RJSAllowance[]{param1};
        phases[1].allowances = new RJSAllowance[]{param2};

        var config = makeConfigWithGivenPhases(phases, "tiny_infra/config_railjson_several_phases.json");
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        saveGraph(run(sim, config), "double-construction-out.csv");
        var actualEndTime = sim.getTime();

        var config_base = makeConfigWithSpeedParams(null);
        var sim_base = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        saveGraph(run(sim_base, config_base), "double-construction-base.csv");
        var baseEndTime = sim_base.getTime();

        var expected = baseEndTime + param1.allowanceValue + param2.allowanceValue;

        assertEquals(expected, actualEndTime, expected * 0.01);
    }

    @SuppressWarnings("unchecked")
    public static ID<RJSRoute>[] addToArray(ID<RJSRoute>[] array, ID<RJSRoute> val) {
        var res = (ID<RJSRoute>[]) java.lang.reflect.Array.newInstance(ID.class, array.length + 1);
        System.arraycopy(array, 0, res, 0, array.length);
        res[res.length - 1] = val;
        return res;
    }

    @SuppressWarnings("unchecked")
    public static ID<RJSRoute>[] removeFirstFromArray(ID<RJSRoute>[] array) {
        var res = (ID<RJSRoute>[]) java.lang.reflect.Array.newInstance(ID.class, array.length - 1);
        if (array.length - 1 >= 0) System.arraycopy(array, 1, res, 0, array.length - 1);
        return res;
    }

    public static RJSTrainPhase[] loadPhasesLongerFirstPhase() {
        var phases = loadRJSPhases("tiny_infra/simulation_several_phases.json");
        phases[0].endLocation = new RJSTrackLocation(new ID<>("ne.micro.foo_to_bar"), 4000);
        assert phases[0] instanceof RJSTrainPhase.Navigate;
        assert phases[1] instanceof RJSTrainPhase.Navigate;
        var navigate0 = (RJSTrainPhase.Navigate) phases[0];
        var navigate1 = (RJSTrainPhase.Navigate) phases[1];
        navigate0.routes = addToArray(navigate0.routes, new ID<>("rt.C3-S7"));
        navigate1.routes = removeFirstFromArray(navigate1.routes);
        return phases;
    }

    @Test
    public void testDifferentMargins() throws InvalidInfraException {
        var infra = getBaseInfra();

        var paramsFirstPhase = new RJSAllowance.LinearAllowance();
        paramsFirstPhase.allowanceValue = 10;
        paramsFirstPhase.allowanceType = RJSAllowance.LinearAllowance.MarginType.TIME;
        var paramsSecondPhase = new RJSAllowance.LinearAllowance();
        paramsSecondPhase.allowanceValue = 60;
        paramsSecondPhase.allowanceType = RJSAllowance.LinearAllowance.MarginType.TIME;

        var phases = loadPhasesLongerFirstPhase();

        phases[0].allowances = new RJSAllowance[]{paramsFirstPhase};
        phases[1].allowances = new RJSAllowance[]{paramsSecondPhase};

        var configMargins = makeConfigWithGivenPhases(phases, "tiny_infra/config_railjson_several_phases.json");
        var simMargins = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var eventsMargins = run(simMargins, configMargins);
        var timeFirstPhaseMMargins = findPhaseChangeTime(eventsMargins);
        var timeMargins = simMargins.getTime();

        phases[0].allowances = null;
        phases[1].allowances = null;

        var config = makeConfigWithGivenPhases(phases, "tiny_infra/config_railjson_several_phases.json");
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var baseEvents = run(sim, config);
        var baseTimeFirstPhase = findPhaseChangeTime(baseEvents);
        var baseTime = sim.getTime();

        var baseTimeSecondPhase = baseTime - baseTimeFirstPhase;
        var expected = baseTimeFirstPhase * (1 + paramsFirstPhase.allowanceValue / 100) +
                baseTimeSecondPhase * (1 + paramsSecondPhase.allowanceValue / 100);
        saveGraph(eventsMargins, "two-margins-out.csv");
        saveGraph(baseEvents, "two-margins-base.csv");
        assertEquals(expected, timeMargins, expected * 0.01);
        assertEquals(baseTimeFirstPhase * (1 + paramsFirstPhase.allowanceValue / 100),
                timeFirstPhaseMMargins, baseTimeFirstPhase * 0.05);
    }

    public static double findPhaseChangeTime(List<TimelineEvent> events) {
        for (var e : events) {
            if (e instanceof TrainReachesActionPoint) {
                var point = ((TrainReachesActionPoint) e).interaction.actionPoint;
                if (point instanceof SignalNavigatePhase.PhaseEndActionPoint)
                    return e.eventId.scheduledTime;
            }
        }
        throw new RuntimeException("Can't find phase change");
    }
}
