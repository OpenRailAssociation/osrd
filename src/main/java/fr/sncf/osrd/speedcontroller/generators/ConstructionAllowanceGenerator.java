package fr.sncf.osrd.speedcontroller.generators;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.utils.Interpolation;
import fr.sncf.osrd.utils.TrackSectionLocation;

import java.util.HashSet;
import java.util.Set;

public class ConstructionAllowanceGenerator implements SpeedControllerGenerator {

    private final double value;
    private final RJSTrainPhase phase;

    public ConstructionAllowanceGenerator(double allowanceValue, RJSTrainPhase phase) {
        this.value = allowanceValue;
        this.phase = phase;
    }

    private double convertTrackLocation(TrackSectionLocation location, TrainSchedule schedule) {
        double sumPreviousSections = 0;
        for (var edge : schedule.fullPath) {
            if (edge.containsLocation(location)) {
                return sumPreviousSections + location.offset;
            }
            sumPreviousSections += edge.getEndPosition() - edge.getBeginPosition();
        }
        throw new RuntimeException("Can't find location in path");
    }

    @Override
    public Set<SpeedController> generate(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeed) {
        // the goal is to find a new allowed speed to create a MaxSpeedController

        // perform the whole running time calculation
        double initialPosition = convertTrackLocation(findPhaseInitialPoint(schedule), schedule);
        double endPosition = convertTrackLocation(findPhaseEndLocation(schedule), schedule);
        var expectedSpeeds = getExpectedSpeeds(sim, schedule, maxSpeed, 1,
                initialPosition, endPosition, schedule.initialSpeed);
        var initialSpeed = Interpolation.interpolate(expectedSpeeds, initialPosition);

        // lunch the binary search algorithm into the phase
        var speedController = binarySearch(0.5, initialPosition, initialSpeed, endPosition, sim, schedule, maxSpeed);
        var res = new HashSet<>(maxSpeed);
        res.add(speedController);
        return res;
    }

    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    private TrackSectionLocation findPhaseEndLocation(TrainSchedule schedule) {
        for (var schedulePhase : schedule.phases) {
            var endPhase = schedulePhase.getEndLocation();
            if (endPhase.edge.id.equals(phase.endLocation.trackSection.id)
                    && endPhase.offset == phase.endLocation.offset) {
                return endPhase;
            }
        }
        throw new RuntimeException("Can't find phase in schedule");
    }

    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    private TrackSectionLocation findPhaseInitialPoint(TrainSchedule schedule) {
        for (int index = 0; index < schedule.phases.size(); index++) {
            var endPhase = schedule.phases.get(index).getEndLocation();
            if (endPhase.edge.id.equals(phase.endLocation.trackSection.id)
                    && endPhase.offset == phase.endLocation.offset) {
                if (index == 0) {
                    return schedule.initialLocation;
                } else {
                    var previousPhase = schedule.phases.get(index - 1);
                    return previousPhase.getEndLocation();
                }
            }
        }
        throw new RuntimeException("Can't find phase in schedule");
    }

    private double getMaxSpeed(Set<SpeedController> controllers, double begin, double end) {
        double max = 0;
        while (begin < end) {
            double val = SpeedController.getDirective(controllers, begin).allowedSpeed;
            if (val > max)
                max = val;
            begin += 1;
        }
        return max;
    }

    private SpeedController binarySearch(Double precision, Double initialPosition, Double initialSpeed,
                                         double finalPosition, Simulation sim,
                                         TrainSchedule schedule, Set<SpeedController> maxSpeed) {
        var totalTime = getExpectedTimes(sim, schedule, maxSpeed, 1, initialPosition, finalPosition, initialSpeed);
        var time = Double.POSITIVE_INFINITY;
        var totalTimeBase = totalTime.lastEntry().getValue();
        var targetTime = totalTimeBase + value;

        var vMinus = 0.0;
        var vPlus = getMaxSpeed(maxSpeed, initialPosition, finalPosition);
        var percentage = 100.0 * value / time;
        var scaleFactor = 1 / (1 + percentage / 100);
        vPlus = vPlus * scaleFactor;

        double allowedSpeed = 0;
        while( Math.abs(time - targetTime) > precision ) {
            allowedSpeed = (vPlus + vMinus) / 2;
            var currentMaxSpeed = createSpeedControllerWith(maxSpeed, allowedSpeed);
            var expectedTimes = getExpectedTimes(sim, schedule, currentMaxSpeed, 1, initialPosition, finalPosition, initialSpeed);
            time = expectedTimes.lastEntry().getValue();
            if (time > targetTime)
                vMinus = allowedSpeed;
            else
                vPlus = allowedSpeed;
        }
        return new MaxSpeedController(allowedSpeed, initialPosition, finalPosition);
    }

    private Set<SpeedController> createSpeedControllerWith(Set<SpeedController> maxSpeed, double newLimit) {
        var res = new HashSet<>(maxSpeed);
        res.add(new MaxSpeedController(newLimit, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY));
        return res;
    }
}