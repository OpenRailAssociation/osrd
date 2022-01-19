package fr.sncf.osrd.speedcontroller.generators;

import static fr.sncf.osrd.train.RollingStock.GammaType.CONST;
import static java.lang.Math.*;

import fr.sncf.osrd.train.*;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.BrakingSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.HashSet;
import java.util.Set;


/** This is a SpeedControllerGenerator that generates the maximum allowed speed at any given point. */
public class MaxSpeedGenerator extends SpeedControllerGenerator {
    public MaxSpeedGenerator() {
        super(0, Double.POSITIVE_INFINITY);
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeeds) {
        // the path is computed at the beginning of the simulation, as it is (for now) part of the event
        var trainPath = schedule.plannedPath.trackSectionPath;
        var rollingStock = schedule.rollingStock;

        var controllers = new HashSet<SpeedController>();

        // add a limit for the maximum speed the hardware is rated for
        controllers.add(new MaxSpeedController(
                rollingStock.maxSpeed,
                Double.NEGATIVE_INFINITY,
                Double.POSITIVE_INFINITY
        ));

        for (int i = 0; i < schedule.stops.size(); i++) {
            var stop = schedule.stops.get(i);
            var stopDuration = stop.duration;
            if (stopDuration <= 0) // The train doesn't stop
                continue;
            var targetPosition = stop.position;
            //TODO: Is this to implement also with non constant dec?
            var slowController = LimitAnnounceSpeedController.create(
                    schedule.rollingStock.maxSpeed,
                    0,
                    targetPosition,
                    schedule.rollingStock.gamma
            );
            var stopController = new MaxSpeedController(0, targetPosition, Double.POSITIVE_INFINITY, i);
            slowController.linkedStopIndex = i;
            stopController.linkedStopIndex = i;
            controllers.add(slowController);
            controllers.add(stopController);
        }

        var offset = 0;
        for (var trackSectionRange : trainPath) {
            var edge = trackSectionRange.edge;
            for (var speedRange : TrackSection.getSpeedSections(edge, trackSectionRange.direction)) {
                // ignore the speed limit if it doesn't apply to our train
                var speedSection = speedRange.value;
                if (!speedSection.isValidFor(rollingStock))
                    continue;

                var speedRangeBegin = min(speedRange.begin, speedRange.end);
                var speedRangeEnd = max(speedRange.begin, speedRange.end);
                var beginOnRange = 0.;
                if (trackSectionRange.direction == EdgeDirection.START_TO_STOP)
                    beginOnRange = speedRangeBegin - trackSectionRange.getBeginPosition();
                else
                    beginOnRange = trackSectionRange.getBeginPosition() - speedRangeEnd;
                var endOnRange = beginOnRange + speedRangeEnd - speedRangeBegin;

                // compute where this limit is active from and to
                var begin = offset + beginOnRange;
                var end = offset + endOnRange;

                // Add the speed controller corresponding to the approach to the restricted speed section
                var isBrakingValueConstant = rollingStock.gammaType == CONST;
                if (isBrakingValueConstant) {
                    controllers.add(LimitAnnounceSpeedController.create(rollingStock.maxSpeed,
                                speedSection.speedLimit,
                                begin,
                                rollingStock.gamma));
                } else {
                    var expectedSpeeds = getExpectedSpeedsBackwards(
                            schedule,
                            speedSection.speedLimit,
                            begin,
                            rollingStock.maxSpeed,
                            TIME_STEP);
                    controllers.add(new BrakingSpeedController(expectedSpeeds));
                }

                // Add the speed controller corresponding to the restricted speed section
                controllers.add(new MaxSpeedController(speedSection.speedLimit, begin, end));
            }
            offset += trackSectionRange.length();
        }
        return controllers;
    }

}
