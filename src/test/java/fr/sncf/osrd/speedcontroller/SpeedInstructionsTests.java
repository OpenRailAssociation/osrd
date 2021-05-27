package fr.sncf.osrd.speedcontroller;

import static fr.sncf.osrd.Helpers.*;

import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.events.TrainMoveEvent;
import fr.sncf.osrd.train.events.TrainReachesActionPoint;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import org.junit.jupiter.api.Test;

import java.util.*;

public class SpeedInstructionsTests {

    public static class StaticSpeedController extends SpeedController {

        public final double speed;

        public StaticSpeedController(double speed) {
            super(Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY);
            this.speed = speed;
        }

        @Override
        public SpeedDirective getDirective(double pathPosition) {
            return new SpeedDirective(speed);
        }

        @Override
        public SpeedController scaled(double scalingFactor) {
            return new StaticSpeedController(speed * scalingFactor);
        }

        @Override
        public boolean deepEquals(SpeedController other) {
            if (other instanceof StaticSpeedController)
                return Math.abs(((StaticSpeedController) other).speed - speed) < 1e-5;
            return false;
        }
    }

    @Test
    public void testFollowTargetSpeed() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;

        var phase = config.trainSchedules.get(0).phases.get(0);
        assert phase instanceof SignalNavigatePhase;
        ((SignalNavigatePhase) phase).targetSpeedGenerator =
                (schedule, tmp) -> new HashSet<>(Collections.singletonList(new StaticSpeedController(5)));

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        for (int i = 10; i < 150; i++)
            makeAssertEvent(sim, i, () -> getLastTrainSpeed(sim) < 5.5);
        run(sim, config);
    }

    @Test
    public void testCatchup() throws InvalidInfraException, SimulationError {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;

        var phase = config.trainSchedules.get(0).phases.get(0);
        assert phase instanceof SignalNavigatePhase;
        ((SignalNavigatePhase) phase).targetSpeedGenerator =
                (schedule, tmp) -> new HashSet<>(Collections.singletonList(new StaticSpeedController(1)));

        infra.switches.iterator().next().positionChangeDelay = 42;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setPosition(sim, SwitchPosition.RIGHT);

        makeAssertEvent(sim, 1, () -> getLastTrainSpeed(sim) < 5);
        makeAssertEvent(sim, 10, () -> getLastTrainSpeed(sim) < 5);
        makeAssertEvent(sim, 60, () -> isLate(sim));
        makeAssertEvent(sim, 150, () -> !isLate(sim));
        run(sim, config);
    }

    @Test
    public void testIsLate() throws InvalidInfraException, SimulationError {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;

        infra.switches.iterator().next().positionChangeDelay = 20;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setPosition(sim, SwitchPosition.RIGHT);

        makeAssertEvent(sim, 30, () -> isLate(sim));
        run(sim, config);
    }

    @Test
    public void testIsNotLate() throws InvalidInfraException, SimulationError {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        for (int i = 1; i < 150; i++)
        makeAssertEvent(sim, i, () -> !isLate(sim));
        run(sim, config);
    }

    private static boolean isLate(Simulation sim) {
        var trainState = sim.trains.get("Test.").getLastState();
        var secondsLate = trainState.currentPhaseState.speedInstructions.secondsLate(
                trainState.location.getPathPosition(), trainState.time);
        return secondsLate > 0.1;
    }

    private static double getLastTrainSpeed(Simulation sim) {
        var train = sim.trains.get("Test.");
        var lastEvent = train.lastScheduledEvent;
        if (lastEvent instanceof TrainReachesActionPoint) {
            var trainReachesActionPoint = (TrainReachesActionPoint) lastEvent;
            return trainReachesActionPoint.trainStateChange.positionUpdates.last().speed;
        }
        var trainReachesActionPoint = (TrainMoveEvent) lastEvent;
        return trainReachesActionPoint.trainStateChange.positionUpdates.last().speed;
    }
}
