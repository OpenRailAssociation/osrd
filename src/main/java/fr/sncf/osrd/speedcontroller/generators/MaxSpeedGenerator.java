package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.BrakingSpeedController;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.*;
import fr.sncf.osrd.utils.SortedDoubleMap;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.HashSet;
import java.util.Set;

/** This is a SpeedControllerGenerator that generates the maximum allowed speed at any given point. */
public class MaxSpeedGenerator extends SpeedControllerGenerator {
    public MaxSpeedGenerator() {
        super(null);
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeeds,
                                         double initialSpeed) {
        // the path is computed at the beginning of the simulation, as it is (for now) part of the event
        var trainPath = schedule.fullPath;
        var rollingStock = schedule.rollingStock;

        var controllers = new HashSet<SpeedController>();

        // add a limit for the maximum speed the hardware is rated for
        controllers.add(new MaxSpeedController(
                rollingStock.maxSpeed,
                Double.NEGATIVE_INFINITY,
                Double.POSITIVE_INFINITY
        ));

        var offset = 0;
        for (var trackSectionRange : trainPath) {
            var edge = trackSectionRange.edge;
            var absBegin = Double.min(trackSectionRange.getBeginPosition(), trackSectionRange.getEndPosition());
            var absEnd = Double.max(trackSectionRange.getBeginPosition(), trackSectionRange.getEndPosition());
            for (var speedRange : TrackSection.getSpeedSections(edge, trackSectionRange.direction)) {
                var speedSection = speedRange.value;
                var speedTrackRange = new TrackSectionRange(
                        edge,
                        EdgeDirection.START_TO_STOP,
                        Double.max(speedRange.begin, absBegin),
                        Double.min(speedRange.end, absEnd)
                );
                if (trackSectionRange.direction == EdgeDirection.STOP_TO_START)
                    speedTrackRange = speedTrackRange.opposite();

                // ignore the speed limit if it doesn't apply to our train
                if (!speedSection.isValidFor(rollingStock))
                    continue;

                // compute where this limit is active from and to
                var begin = offset + speedTrackRange.getBeginPosition() - trackSectionRange.getBeginPosition();
                var end = begin + speedTrackRange.length();

                // Add the speed controller corresponding to the approach to the restricted speed section
                var isBrakingValueConstant = rollingStock.maxGamma == null;
                if(isBrakingValueConstant) {
                    controllers.add(LimitAnnounceSpeedController.create(
                            rollingStock.maxSpeed,
                            speedSection.speedLimit,
                            begin,
                            rollingStock.timetableGamma
                    ));
                } else {
                    // TODO : pass the good time step
                    var expectedSpeeds = getExpectedSpeedsBackwards(sim, schedule,
                            speedSection.speedLimit, begin, 1);
                    controllers.add(BrakingSpeedController.create(expectedSpeeds));
                }

                // Add the speed controller corresponding to the restricted speed section
                controllers.add(new MaxSpeedController(speedSection.speedLimit, begin, end));
            }
            offset += trackSectionRange.length();
        }

        // Add the speed controller corresponding to the end of the path
        controllers.add(LimitAnnounceSpeedController.create(
                rollingStock.maxSpeed,
                0,
                offset - 5,
                rollingStock.timetableGamma
        ));
        controllers.add(new MaxSpeedController(0, offset - 5, Double.POSITIVE_INFINITY));
        return controllers;
    }

    private SortedDoubleMap getExpectedSpeedsBackwards(Simulation sim, TrainSchedule schedule,
                                                       double speedLimit, double endPosition,
                                                       double timestep) {
        SortedDoubleMap expectedSpeeds = new SortedDoubleMap();
        var speed = speedLimit;
        var inertia = schedule.rollingStock.mass * schedule.rollingStock.inertiaCoefficient;
        var location = convertPosition(schedule, sim, endPosition);
        while (speed < schedule.rollingStock.maxSpeed && location.getPathPosition() >= 0.0001) {
            expectedSpeeds.put(location.getPathPosition(), speed);
            var integrator = TrainPhysicsIntegrator.make(timestep, schedule.rollingStock,
                    speed, location.meanTrainGrade());
            // TODO: max Gamma could have different values depending on the speed
            var action = Action.brake(Math.abs(schedule.rollingStock.maxGamma * inertia));
            var update =  integrator.computeUpdate(action, location.getPathPosition(),
                    -1);
            speed = update.speed;
            // We cannot just call updatePosition with a negative delta so we re-create the location object
            // TODO (optimization): support negative delta
            location = convertPosition(schedule, sim, location.getPathPosition() - update.positionDelta);
        }

        expectedSpeeds.put(location.getPathPosition(), speed);
        return expectedSpeeds;
    }

    private static TrainPositionTracker convertPosition(TrainSchedule schedule, Simulation sim, double position) {
        var location = Train.getInitialLocation(schedule, sim);
        location.updatePosition(schedule.rollingStock.length, position);
        return location;
    }

}
