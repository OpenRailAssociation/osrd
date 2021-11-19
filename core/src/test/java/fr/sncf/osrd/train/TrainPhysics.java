package fr.sncf.osrd.train;

import static fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.junit.jupiter.api.Test;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;


public class TrainPhysics {

    /**
     * Creates a pseudo-trainLocationTracker that gives the given slope.
     * This method is used to get trackers with given slopes in TrainPhysics
     * @param trainGrade the slope of the tracker
     * @return a TrainPositionTracker with the given slope
     */
    public static TrainPositionTracker makeDummyTracker(double trainGrade) {
        var graph = new TrackGraph();
        double length = 100000;
        var track = graph.makeTrackSection(0, 1, "", length, null);
        track.forwardGradients.addRange(0, length, trainGrade);
        track.backwardGradients.addRange(0, length, -trainGrade);
        var path = Collections.singletonList(
                new TrackSectionRange(track, EdgeDirection.START_TO_STOP, 0, length)
        );
        var res = new TrainPositionTracker(path);
        res.updatePosition(1, length / 2);
        return res;
    }

    @Test
    public void testSlopeNoTraction() {
        double speed = 0.0;

        // how fast would a train go after 10 steps of 1 sec, coasting on a
        // 40m / km slope?
        for (int i = 0; i < 10; i++) {
            var simulator = new TrainPhysicsIntegrator(1.0, REALISTIC_FAST_TRAIN, makeDummyTracker(40), speed);
            var step = simulator.stepFromAction(
                    Action.coast(),
                    1000.,
                    1
            );
            speed = step.finalSpeed;
        }

        // we expect about -4m/s (the train goes backward)
        assertTrue(speed < -1 && speed > -5, String.valueOf(speed));
    }

    @Test
    public void testSteepSlopeTraction() {
        var rollingStock = REALISTIC_FAST_TRAIN;

        double speed = 0.0;

        double maxTraction = rollingStock.tractiveEffortCurve[0].maxEffort;
        // how fast would a train go after 10 steps of 1 sec, full throttle on a 45deg slope?
        for (int i = 0; i < 10; i++) {
            var simulator = new TrainPhysicsIntegrator(1.0, rollingStock, makeDummyTracker(1000), speed);
            var step = simulator.stepFromAction(
                    Action.accelerate(maxTraction),
                    1000.,
                    1);
            speed = step.finalSpeed;
        }

        // we expect the train to go pretty fast
        assertTrue(speed < -10 && speed > -100, String.valueOf(speed));
    }

    @Test
    public void testSlopeChangeVMax() {
        var rollingStock = REALISTIC_FAST_TRAIN;

        double speed = 0.0;

        // go to full speed by cruising for 20 minutes
        for (int i = 0; i < 20 * 60; i++) {
            double maxTraction = rollingStock.getMaxEffort(speed);
            var simulator = new TrainPhysicsIntegrator(1.0, rollingStock, makeDummyTracker(0.0), speed);
            var step = simulator.stepFromAction(
                    Action.accelerate(maxTraction),
                    1000.,
                    1);
            speed = step.finalSpeed;
        }

        var fullThrottle = speed;
        // we expect the train to go pretty fast
        assertTrue(speed > 100, String.valueOf(speed));

        // continue the simulation, but with some slope
        for (int i = 0; i < 20 * 60; i++) {
            double maxTraction = rollingStock.getMaxEffort(speed);
            var simulator = new TrainPhysicsIntegrator(1.0, rollingStock, makeDummyTracker(35.0), speed);
            var step = simulator.stepFromAction(
                    Action.accelerate(maxTraction),
                    1000.,
                    1);
            speed = step.finalSpeed;
        }

        // we expect the train to run at less than half the speed, but still decently fast
        assertTrue(speed < fullThrottle / 2, String.valueOf(speed));
        assertTrue(speed > fullThrottle / 3, String.valueOf(speed));
    }

    @Test
    public void testAccelerateAndCoast() {
        var rollingStock = REALISTIC_FAST_TRAIN;

        double speed = 0.0;

        // make a huge traction effort
        var simulator = new TrainPhysicsIntegrator(1.0, rollingStock, makeDummyTracker(0.0), speed);
        var step = simulator.stepFromAction(
                Action.accelerate(500000.0),
                1000.,
                1);
        speed = step.finalSpeed;

        assertTrue(speed > 0.5);

        // the train should be able to coast for a minute without stopping
        for (int i = 0; i < 60; i++) {
            simulator = new TrainPhysicsIntegrator(1.0, rollingStock, makeDummyTracker(0.0), speed);
            double prevSpeed = speed;
            step = simulator.stepFromAction(Action.coast(), 1000., 1);
            speed = step.finalSpeed;
            assertTrue(speed < prevSpeed && speed > 0.);
        }

        // another minute later
        for (int i = 0; i < 60; i++) {
            simulator = new TrainPhysicsIntegrator(1.0, rollingStock, makeDummyTracker(0.0), speed);
            step = simulator.stepFromAction(Action.coast(), 1000., 1);
            speed = step.finalSpeed;
        }

        // it should be stopped
        assertEquals(speed, 0.0);
    }
}
