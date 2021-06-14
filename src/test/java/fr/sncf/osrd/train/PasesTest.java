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
import fr.sncf.osrd.speedcontroller.SpeedInstructionsTests;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.utils.Interpolation;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.sql.Time;
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
        var actual_end_time = sim.getTime();

        var config_base = getBaseConfig();
        var sim_base = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim_base, config_base);
        var base_end_time = sim_base.getTime();

        assertEquals(base_end_time, actual_end_time, base_end_time * 0.1);
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
}
