package fr.sncf.osrd.speedcontroller.generators;

import static java.lang.Math.min;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPhase;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainPhysicsIntegrator.PositionUpdate;
import fr.sncf.osrd.utils.SortedDoubleMap;
import fr.sncf.osrd.utils.TrackSectionLocation;

import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/** This class is used to generate a set of SpeedController (similar to a speed at any given point). */
public abstract class SpeedControllerGenerator {

    protected RJSTrainPhase phase;

    protected SpeedControllerGenerator(RJSTrainPhase phase) {
        this.phase = phase;
    }

    /** Generates the set of SpeedController */
    public abstract Set<SpeedController> generate(Simulation sim, TrainSchedule schedule,
                                                  Set<SpeedController> maxSpeed, double initialSpeed);

    /** Generates a map of location -> expected time if we follow the given controllers.
     * This may be overridden in scenarios when it is already computed when computing the controllers */
    public SortedDoubleMap getExpectedTimes(Simulation sim,
                                            TrainSchedule schedule,
                                            Set<SpeedController> controllers,
                                            double timestep,
                                            double begin,
                                            double end,
                                            double initialSpeed) {
        var updatesMap
                = getUpdatesAtPositions(sim, schedule, controllers, timestep, begin, end, initialSpeed);
        var res = new SortedDoubleMap();
        double time = schedule.departureTime;
        for (var k : updatesMap.keySet()) {
            time += updatesMap.get(k).timeDelta;
            res.put(k, time);
        }
        return res;
    }

    /** Generates a map of location -> expected time if we follow the given controllers.
     * This may be overridden in scenarios when it is already computed when computing the controllers */
    public SortedDoubleMap getExpectedTimes(Simulation sim,
                                            TrainSchedule schedule,
                                            Set<SpeedController> controllers,
                                            double timestep) {
        return getExpectedTimes(sim, schedule, controllers, timestep, 0, Double.POSITIVE_INFINITY, 0);
    }

    public SortedDoubleMap getExpectedSpeeds(Simulation sim,
                                             TrainSchedule schedule,
                                             Set<SpeedController> controllers,
                                             double timestep) {
        return getExpectedSpeeds(sim, schedule, controllers, timestep, 0, Double.POSITIVE_INFINITY, 0);
    }

    /** Generates a map of location -> expected speed if we follow the given controllers */
    public SortedDoubleMap getExpectedSpeeds(Simulation sim,
                                             TrainSchedule schedule,
                                             Set<SpeedController> controllers,
                                             double timestep,
                                             double begin,
                                             double end,
                                             double initialSpeed) {
        var updatesMap
                = getUpdatesAtPositions(sim, schedule, controllers, timestep, begin, end, initialSpeed);
        var res = new SortedDoubleMap();
        for (var k : updatesMap.keySet()) {
            res.put(k, updatesMap.get(k).speed);
        }
        return res;
    }

    public NavigableMap<Double, PositionUpdate> getUpdatesAtPositions(Simulation sim,
                                                                      TrainSchedule schedule,
                                                                      Set<SpeedController> controllers,
                                                                      double timestep) {
        return getUpdatesAtPositions(sim, schedule, controllers, timestep,
                0, Double.POSITIVE_INFINITY, 0);
    }

    /** Generates a map of location -> updates if we follow the given controllers.
     * This may be overridden in scenarios when it is already computed when computing the controllers */
    public NavigableMap<Double, PositionUpdate> getUpdatesAtPositions(Simulation sim,
                                                                      TrainSchedule schedule,
                                                                      Set<SpeedController> controllers,
                                                                      double timestep,
                                                                      double begin,
                                                                      double end,
                                                                      double initialSpeed) {
        var location = Train.getInitialLocation(schedule, sim);
        location.ignoreInfraState = true;
        location.updatePosition(schedule.rollingStock.length, begin);
        var totalLength = 0;
        for (var range : schedule.plannedPath.trackSectionPath)
            totalLength += range.length();

        var res = new TreeMap<Double, PositionUpdate>();

        double speed = initialSpeed;
        do {
            var activeControllers = controllers.stream()
                    .filter(x -> x.isActive(location))
                    .collect(Collectors.toSet());
            var directive = SpeedController.getDirective(activeControllers, location.getPathPosition());

            var integrator = TrainPhysicsIntegrator.make(timestep, schedule.rollingStock,
                    speed, location.maxTrainGrade());
            var action = integrator.actionToTargetSpeed(directive, schedule.rollingStock);
            var distanceLeft = min(totalLength - location.getPathPosition(), end - location.getPathPosition());
            var update =  integrator.computeUpdate(action, distanceLeft);
            speed = update.speed;

            location.updatePosition(schedule.rollingStock.length, update.positionDelta);
            res.put(location.getPathPosition(), update);
        } while (location.getPathPosition() + timestep * speed < totalLength
                && location.getPathPosition() < end
                && speed > 0);
        return res;
    }

    /** Finds the position (as a double) corresponding to the end of the phase */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    protected double findPhaseEndLocation(TrainSchedule schedule) {
        for (var schedulePhase : schedule.phases) {
            var endPhase = schedulePhase.getEndLocation();
            if (endPhase.edge.id.equals(phase.endLocation.trackSection.id)
                    && endPhase.offset == phase.endLocation.offset) {
                return convertTrackLocation(endPhase, schedule);
            }
        }
        throw new RuntimeException("Can't find phase in schedule");
    }

    /** Finds the position (as a double) corresponding to the beginning of the phase */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    protected double findPhaseInitialSpeed(Simulation sim, TrainSchedule schedule, Set<SpeedController> maxSpeed) {
        double phasePosition = findPhaseInitialLocation(schedule);
        var speeds = getExpectedSpeeds(sim, schedule, maxSpeed, 1,
                0, phasePosition, schedule.initialSpeed);
        return speeds.lastEntry().getValue();
    }


    /** Finds the position (as a double) corresponding to the end of the phase */
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    protected double findPhaseInitialLocation(TrainSchedule schedule) {
        for (int index = 0; index < schedule.phases.size(); index++) {
            var endPhase = schedule.phases.get(index).getEndLocation();
            if (endPhase.edge.id.equals(phase.endLocation.trackSection.id)
                    && endPhase.offset == phase.endLocation.offset) {
                if (index == 0) {
                    return convertTrackLocation(schedule.initialLocation, schedule);
                } else {
                    var previousPhase = schedule.phases.get(index - 1);
                    return convertTrackLocation(previousPhase.getEndLocation(), schedule);
                }
            }
        }
        throw new RuntimeException("Can't find phase in schedule");
    }

    /** Converts a TrackSectionLocation into a distance on the track (double) */
    private double convertTrackLocation(TrackSectionLocation location, TrainSchedule schedule) {
        return schedule.plannedPath.convertTrackLocation(location);
    }
}
