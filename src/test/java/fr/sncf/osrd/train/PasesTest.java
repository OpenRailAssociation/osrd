package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.speedcontroller.SpeedInstructionsTests;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.HashSet;

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

    @Test
    public void testSameEventTimes() throws InvalidInfraException {
        var infra = getBaseInfra();

        var config = getBaseConfig("tiny_infra/config_railjson_several_phases.json");
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var events = run(sim, config);


        var configBase = getBaseConfig();
        var simBase = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        var eventsRef = run(simBase, configBase);

        assertEquals(eventsRef.size() + 2, events.size());

        int i = 0;
        int iRef = 0;
        while (i < events.size()) {
            System.out.println(events.get(i).toString());
            if (events.get(i) instanceof TrainReachesActionPoint) {
                var casted = (TrainReachesActionPoint) events.get(i);
                if (casted.interaction.actionPoint instanceof SignalNavigatePhase.VirtualActionPoint) {
                    i++;
                    continue;
                }
                if (casted.interaction.interactionType == InteractionType.SEEN && casted.eventId.scheduledTime > 10 &&
                        casted.eventId.scheduledTime < 12) {

                    i++;
                    continue;
                }
            }

            var event = events.get(i);
            var eventRef = eventsRef.get(iRef);

            assertEquals(eventRef.eventId.scheduledTime, event.eventId.scheduledTime);

            i++;
            iRef++;
        }
    }

    // TODO figure out why this test fails (probably for the same reason as the test above)
    @Disabled
    @Test
    public void testReactSignal() throws InvalidInfraException, SimulationError {
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
