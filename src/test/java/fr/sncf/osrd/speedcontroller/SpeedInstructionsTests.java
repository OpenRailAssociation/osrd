package fr.sncf.osrd.speedcontroller;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
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
        public boolean deepEquals(SpeedController other) {
            if (other instanceof StaticSpeedController)
                return Math.abs(((StaticSpeedController) other).speed - speed) < 1e-5;
            return false;
        }
    }

    @Test
    public void testFollowTargetSpeed() throws InvalidInfraException, SimulationError {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;

        var phase = config.trainSchedules.get(0).phases.get(0);
        assert phase instanceof SignalNavigatePhase;
        ((SignalNavigatePhase) phase).targetSpeedGenerator =
                schedule -> new HashSet<>(Collections.singletonList(new StaticSpeedController(0)));

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        Helpers.Procedure assertNoSpeed = () ->
                assertEquals(sim.trains.get("Test.").getLastState().location.getPathPosition(), 0, 1e-5);

        makeFunctionEvent(sim, 1, assertNoSpeed);
        makeFunctionEvent(sim, 10, assertNoSpeed);
        makeFunctionEvent(sim, 100, assertNoSpeed);
        run(sim, config);
    }
}
