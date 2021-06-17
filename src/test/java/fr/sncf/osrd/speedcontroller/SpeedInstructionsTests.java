package fr.sncf.osrd.speedcontroller;

import static fr.sncf.osrd.Helpers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance.LinearAllowance.MarginType;
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;
import fr.sncf.osrd.train.Train;
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
        SpeedControllerGenerator generator =
                (a, b, c) -> new HashSet<>(Collections.singletonList(new StaticSpeedController(5)));
        ((SignalNavigatePhase) phase).targetSpeedGenerators = Collections.singletonList(generator);

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
        SpeedControllerGenerator generator =
                (a, b, c) -> new HashSet<>(Collections.singletonList(new StaticSpeedController(10)));
        ((SignalNavigatePhase) phase).targetSpeedGenerators = Collections.singletonList(generator);

        infra.switches.iterator().next().positionChangeDelay = 42;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setPosition(sim, SwitchPosition.RIGHT);

        makeAssertEvent(sim, 43, () -> isLate(sim));
        makeAssertEvent(sim, 150, () -> !isLate(sim));
        run(sim, config);
    }

    @Test
    public void testIsLate() throws InvalidInfraException, SimulationError {
        var infra = getBaseInfra();
        assert infra != null;
        var config = makeConfigWithSpeedParams(null);
        assert config != null;

        infra.switches.iterator().next().positionChangeDelay = 20;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        sim.infraState.getSwitchState(0).setPosition(sim, SwitchPosition.RIGHT);

        makeAssertEvent(sim, 30, () -> isLate(sim));
        run(sim, config);
    }

    @Test
    public void testIsNotLate() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var config = getBaseConfig();
        assert config != null;

        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);

        for (int i = 1; i < 150; i++)
            makeAssertEvent(sim, i, () -> !isLate(sim));
        run(sim, config);
    }

    @Test
    public void testMargin50() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.LinearAllowance();
        params.allowanceType = MarginType.TIME;
        params.allowanceValue = 50;

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        assert config != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with 50% margins
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        assert configMargins != null;
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();
        var expected = baseSimTime * 1.5;
        assertEquals(expected, marginsSimTime, expected * 0.01);
    }

    @Test
    public void testMargin200() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.LinearAllowance();
        params.allowanceType = MarginType.TIME;
        params.allowanceValue = 200;

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        assert config != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with 200% margins
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        assert configMargins != null;
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();
        var expected = baseSimTime * 3;
        assertEquals(expected, marginsSimTime, expected * 0.01);
    }

    @Test
    public void testMargin0() throws InvalidInfraException {
        var infra = getBaseInfra();
        assert infra != null;
        var params = new RJSAllowance.LinearAllowance();
        params.allowanceType = MarginType.TIME;
        params.allowanceValue = 0;

        // base run, no margin
        var config = makeConfigWithSpeedParams(null);
        assert config != null;
        var sim = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim, config);
        var baseSimTime = sim.getTime();

        // Run with 0% margins
        var configMargins = makeConfigWithSpeedParams(Collections.singletonList(params));
        assert configMargins != null;
        var sim2 = Simulation.createFromInfra(RailJSONParser.parse(infra), 0, null);
        run(sim2, configMargins);
        var marginsSimTime = sim2.getTime();
        assertEquals(baseSimTime, marginsSimTime, baseSimTime * 0.01);
    }

    private static boolean isLate(Simulation sim) {
        var event = getLastTrainEvent(sim);
        var trainState = sim.trains.get("Test.").getLastState();
        var secondsLate = trainState.currentPhaseState.speedInstructions.secondsLate(
                event.pathPosition, event.time);
        return secondsLate > 1;
    }

    private static Train.TrainStateChange.SpeedUpdate getLastTrainEvent(Simulation sim) {
        var train = sim.trains.get("Test.");
        var lastEvent = train.lastScheduledEvent;
        Train.TrainStateChange.SpeedUpdates updates;
        if (lastEvent instanceof TrainReachesActionPoint) {
            var trainReachesActionPoint = (TrainReachesActionPoint) lastEvent;
            updates = trainReachesActionPoint.trainStateChange.positionUpdates;
        } else {
            var trainReachesActionPoint = (TrainMoveEvent) lastEvent;
            updates = trainReachesActionPoint.trainStateChange.positionUpdates;
        }
        for (int i = updates.size() - 1; i >= 0; i--)
            if (updates.get(i).time <= sim.getTime())
                return updates.get(i);
        return updates.get(0);
    }

    private static double getLastTrainSpeed(Simulation sim) {
        return getLastTrainEvent(sim).speed;
    }
}
