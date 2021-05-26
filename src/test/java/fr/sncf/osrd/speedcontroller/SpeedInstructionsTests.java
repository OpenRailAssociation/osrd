package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.StaticSpeedLimitTest;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.routegraph.RouteGraph;
import fr.sncf.osrd.infra.trackgraph.BufferStop;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.infra.trackgraph.Waypoint;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.RouteStatus;
import fr.sncf.osrd.railjson.parser.RailJSONParser;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.speedcontroller.generators.SpeedControllerGenerator;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import fr.sncf.osrd.train.phases.Phase;
import fr.sncf.osrd.train.phases.SignalNavigatePhase;
import fr.sncf.osrd.utils.RangeValue;
import fr.sncf.osrd.utils.SignAnalyzer;
import fr.sncf.osrd.utils.SortedArraySet;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.stream.Collectors;

import static fr.sncf.osrd.TestTrains.FAST_NO_FRICTION_TRAIN;
import static org.junit.jupiter.api.Assertions.*;
import static fr.sncf.osrd.Helpers.*;

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
                return ((StaticSpeedController) other).speed == speed;
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

        makeAssertEvent(sim, 1, () -> sim.trains.get("Test.").getLastState().location.getPathPosition() == 0);
        makeAssertEvent(sim, 10, () -> sim.trains.get("Test.").getLastState().location.getPathPosition() == 0);
        makeAssertEvent(sim, 100, () -> sim.trains.get("Test.").getLastState().location.getPathPosition() == 0);
        run(sim, config);
    }
}
