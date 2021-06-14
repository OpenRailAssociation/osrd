package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.utils.Interpolation;
import org.junit.jupiter.api.Test;

import java.util.*;

import static fr.sncf.osrd.Helpers.*;
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

    public static NavigableMap<Double, Double> getTimePerPosition(Iterable<TimelineEvent> events) {
        var res = new TreeMap<Double, Double>();
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
            var expected = Interpolation.interpolate(expectedTimePerPosition, t);
            var result = Interpolation.interpolate(resultTimePerPosition, t);
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
    public void testSeveralConstructionMargins() throws InvalidInfraException {
        var infra = getBaseInfra();
        var param = new RJSAllowance.ConstructionAllowance();
        param.allowanceValue = 15;
        var params = new ArrayList<RJSAllowance>(Collections.singletonList(param));

        var config = makeConfigWithSpeedParams(params, "tiny_infra/config_railjson_several_phases.json");
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var actualEndTime = sim.getTime();

        var config_base = getBaseConfig();
        var sim_base = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim_base, config_base);
        var baseEndTime = sim_base.getTime();

        var expected = baseEndTime + 30;

        assertEquals(expected, actualEndTime, expected * 0.01);
    }

    @Test
    public void testDifferentMargins() throws InvalidInfraException {
        var infra = getBaseInfra();
        var param = new RJSAllowance.LinearAllowance();
        param.allowanceValue = 0;
        param.allowanceType = RJSAllowance.LinearAllowance.MarginType.TIME;
        var params = new ArrayList<RJSAllowance>(Collections.singletonList(param));

        var config = makeConfigWithSpeedParams(params, "tiny_infra/config_railjson_several_phases.json");
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var baseEvents = run(sim, config);
        var basePhaseChange = findPhaseChangeTime(baseEvents);
        var baseTime = sim.getTime();

        var paramsSecondPhase = new RJSAllowance.LinearAllowance();
        paramsSecondPhase.allowanceValue = 20;
        paramsSecondPhase.allowanceType = RJSAllowance.LinearAllowance.MarginType.TIME;
        var paramsBothPhases = new ArrayList<List<RJSAllowance>>();
        paramsBothPhases.add(params);
        paramsBothPhases.add(new ArrayList<>(Collections.singletonList(paramsSecondPhase)));
        var config2 = makeConfigWithSpeedParamsList(paramsBothPhases, "tiny_infra/config_railjson_several_phases.json");
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var events = run(sim2, config2);
        var phaseChangeTime = findPhaseChangeTime(events);
        var time = sim.getTime();

        var expected = baseTime + (baseTime - basePhaseChange) * 0.2;
        assertEquals(expected, time, expected * 0.01);
        assertEquals(basePhaseChange, phaseChangeTime, basePhaseChange * 0.01);
    }

    public static double findPhaseChangeTime(List<TimelineEvent> events) {
        for (var e : events) {
            if (e instanceof TrainReachesActionPoint) {
                var point = ((TrainReachesActionPoint) e).interaction.actionPoint;
                if (point instanceof SignalNavigatePhase.VirtualActionPoint)
                    return e.eventId.scheduledTime;
            }
        }
        throw new RuntimeException("Can't find phase change");
    }
}
