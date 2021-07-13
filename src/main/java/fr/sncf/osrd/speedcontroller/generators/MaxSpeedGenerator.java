package fr.sncf.osrd.speedcontroller.generators;

import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.HashSet;
import java.util.Set;

/** This is a SpeedControllerGenerator that generates the maximum allowed speed at any given point. */
public class MaxSpeedGenerator extends SpeedControllerGenerator {
    public MaxSpeedGenerator() {
        super(0, Double.POSITIVE_INFINITY);
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeed) {
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
                controllers.add(LimitAnnounceSpeedController.create(
                        rollingStock.maxSpeed,
                        speedSection.speedLimit,
                        begin,
                        rollingStock.timetableGamma
                ));

                // Add the speed controller corresponding to the restricted speed section
                controllers.add(new MaxSpeedController(speedSection.speedLimit, begin, end));
            }
            offset += trackSectionRange.length();
        }

        // We tell the train to stop before the end because the train stops are not accurate and we risk
        // reaching the buffer stop. This *should* be temporary.
        var targetPosition = offset - 10;

        // Add the speed controller corresponding to the end of the path
        controllers.add(LimitAnnounceSpeedController.create(
                rollingStock.maxSpeed,
                0,
                targetPosition,
                rollingStock.timetableGamma
        ));
        controllers.add(new MaxSpeedController(0, targetPosition, Double.POSITIVE_INFINITY));
        return controllers;
    }
}
