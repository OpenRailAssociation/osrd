package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.train.TrainState;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.utils.graph.EdgeDirection;

//import org.slf4j.Logger;
//import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * Class dedicated to create a speedcontroller use for the CBTC phase, based on
 * the MA. The speed controller used to slow down the train from the
 * announcement of a speed limit, or a train or a switch up to its enforcement
 * signal.
 * How does it work?
 *  1) Compute the energy to dissipate to arrive at the right speed:
 *      - kinetic
 *      - potential
 *  2) Compute the distance of free whiling and the speed at the end
 *  3) Compute a marge behind the next danger due the estimated energy gain during the next time step
 *  4) Compute a speed to reach at the next time step based on the energy
 */
public final class CBTCSpeedController extends SpeedController {
    // static final Logger logger =
    // LoggerFactory.getLogger(CBTCSpeedController.class);

    public final double targetSpeedLimit;
    public final double gamma;
    public final TrainState state;
    public final TrainSchedule schedule;

    // TODO : use realistic value based on the documentation
    private final double timeErre = .4;
    private final double timeReact = 0.0;

    private final double jerkComfort = .06;
    private final double jerk = 0.;

    private static final double dt = 0.2;

    /**
     * Create a speed Controller for CBTC phases based on the Movement Authority
     * 
     * @param targetSpeedLimit Speed target : 0 if it's behind a train, a switch or
     *                         the end of the path, something else if it's for a
     *                         speed limit change
     * @param startPosition    position of the train
     * @param endPosition      position of the danger
     * @param gamma            gamma of the train
     * @param state            state of the train
     * @param schedule         schedule of the train
     */
    public CBTCSpeedController(double targetSpeedLimit, double startPosition, double endPosition, double gamma,
            TrainState state, TrainSchedule schedule) {
        super(startPosition, endPosition);
        this.targetSpeedLimit = targetSpeedLimit;
        this.gamma = gamma;
        this.state = state;
        this.schedule = schedule;
        assert (targetSpeedLimit >= 0);
    }

    /** Create CBTCSpeedController from initial speed */
    public static CBTCSpeedController create(
            double targetSpeed,
            double targetPosition,
            double gamma,
            TrainState state,
            TrainSchedule schedule
    ) {
        return new CBTCSpeedController(targetSpeed, 0., targetPosition, gamma, state, schedule);
    }

    /**
     * The response is separated in 6 zones:
     *  1) The train has no sensible danger before : he may accelerate
     *  2) The train is quite far from a danger : he accelerates slowly
     *  3) The train is at a good distance : he stays at the same speed
     *  4) The train is a bit to close : he slow down slowly
     *  5) The train is close : he brakes
     *  6) The train is to close : emergency braking
     * @param pathPosition the position of the train relative to the beginning of the track
     * @return the speed directive
     */
    @Override
    public SpeedDirective getDirective(double pathPosition) {

        final double nextDangerDistance = endPosition - state.location.getPathPosition();

        if (nextDangerDistance > 4000)
            return new SpeedDirective(Double.POSITIVE_INFINITY);

        final var li = getDistanceStart(nextDangerDistance, this.state.speed);

        final var startDistance = li.startDistance;
        final var marginBehindDanger = li.margin;
        final var finalSpeed = li.finalSpeed;

        final var gamma = this.schedule.rollingStock.gamma;
        final var kineticEnergy = kineticEnergy(finalSpeed) - kineticEnergy(targetSpeedLimit);

        var distanceSecure = nextDangerDistance - 5 * marginBehindDanger - startDistance;

        // first zone
        if ((kineticEnergy + potentialEnergy(startDistance, distanceSecure) + lostBrakeEnergy(distanceSecure) < 0
                && nextDangerDistance > 40) || kineticEnergy < 0) {
            return new SpeedDirective(Double.POSITIVE_INFINITY);
        }

        // It's necessary if we want the train to stop
        if (kineticEnergy < 15) {
            return new SpeedDirective(Math.max(targetSpeedLimit, 0.)); // max is only for test!
        }

        distanceSecure = nextDangerDistance - 4 * marginBehindDanger - startDistance;

        //second zone
        if (kineticEnergy + potentialEnergy(startDistance, distanceSecure) + lostBrakeEnergy(distanceSecure) < 0) {
            var targetSpeed = state.speed
                    + (state.accel + schedule.rollingStock.rollingResistance(state.speed) / schedule.rollingStock.mass)
                            * dt;
            return new SpeedDirective(targetSpeed);
        }

        distanceSecure = nextDangerDistance - 2 * marginBehindDanger - startDistance;

        // third zone
        if (kineticEnergy + potentialEnergy(startDistance, distanceSecure) + lostBrakeEnergy(distanceSecure) < 0) {
            var targetSpeed =  state.speed + (state.accel + jerkComfort * dt) * dt;
            if (state.accel > -jerkComfort / 10)
                targetSpeed = state.speed;
            return new SpeedDirective(targetSpeed);
        }
        
        distanceSecure = nextDangerDistance - marginBehindDanger - startDistance;

        //fourth zone
        if (kineticEnergy + potentialEnergy(startDistance, distanceSecure) + lostBrakeEnergy(distanceSecure) < 0) {
            var targetSpeed = state.speed + (state.accel - jerkComfort * dt) * dt;
            return new SpeedDirective(targetSpeed);
        }

        distanceSecure = nextDangerDistance - startDistance;

        //fifth zone
        if (kineticEnergy + potentialEnergy(startDistance, nextDangerDistance) + lostBrakeEnergy(distanceSecure) <= 0) {
            var targetSpeed = targetSpeedLimit;
            return new SpeedDirective(targetSpeed);

        } // Enter EMERGENCY_BRAKING
        var brakingDistance = (kineticEnergy + potentialEnergy(startDistance, distanceSecure)) / gamma;
        throw new RuntimeException("Enter Emergency Breaking " + schedule.trainID
                + (nextDangerDistance - startDistance - brakingDistance) / marginBehindDanger);
    }

    @Override
    public SpeedController scaled(double scalingFactor) {
        return new LimitAnnounceSpeedController(targetSpeedLimit * scalingFactor, beginPosition, endPosition, gamma);
    }

    @Override
    public String toString() {
        return String.format("CBTCSpeedController { targetSpeed=%.3f, begin=%.3f, end=%.3f, gamma=%.3f }",
                targetSpeedLimit, beginPosition, endPosition, gamma);
    }

    @Override
    @SuppressFBWarnings({ "BC_UNCONFIRMED_CAST", "FE_FLOATING_POINT_EQUALITY" })
    public boolean deepEquals(SpeedController other) {
        if (!equalRange(other))
            return false;
        if (other.getClass() != CBTCSpeedController.class)
            return false;
        var o = (CBTCSpeedController) other;
        return o.targetSpeedLimit == targetSpeedLimit && o.gamma == gamma;
    }

    /**
     * Return margin behind next danger due to the time to establish braking
     */
    private double marginBehindNextDanger(
            double speed,
            double finalSpeed,
            double accel,
            double i,
            double startdistance,
            double nextDangerDistance
    ) {
        double gamma = this.schedule.rollingStock.gamma;

        // Distance travelled by the train at the next time
        var distance = speed * dt + accel * dt * dt / 2.;
        
        // Kinetic Energy won
        distance += (speed * accel * dt + accel * accel * dt * dt / 2.) / gamma;

        // No potential energy won

        /* Distance travelled more due to settle braking */
        // var time = (accel - this.accel) /schedule.rollingStock.mass/ jerk ;
        // distance + = jerk * Math.pow(time, 3) / 6.;

        /* TODO : add freewheeling :
        distance + = estimatedDistanceTravelledFreeWilling( t + dt ) - distanceTravelledFreeWilling( t ) 
        */

        // var time = schedule.rollingStock.getMaxEffort(speed) /schedule.rollingStock.mass/ jerk ;
        // distance + = jerk * Math.pow(time, 3) / 6.;

        return distance + 10.;
    }

    /**
     * Dissipated energy on distance Only work with constant gamma
     */
    private double lostBrakeEnergy(double distance) {
        // Only working with constant Gamma//
        var gamma = this.schedule.rollingStock.gamma;
        return -gamma * distance;
    }

    /**
     * Compute the kinetic energy of the train 1/2 * m * v^2
     * @param speed current speed of the train
     * @return Kinetic energy divided by the mass of the train
     */
    public double kineticEnergy(double speed) {
        return 1.0 / 2.0 * speed * speed;
    }

    /**
     * Calculate the difference of potential Energy
     * 
     * @param end Distance in front of the train
     * @return Difference of potential energy
     */
    public double potentialEnergy(double end) {
        return -heightDifference(0, end) * 9.81;
    }

    private double potentialEnergy(double distance, double end) {
        var height = heightDifference(distance, end);
        return -height * 9.81;
    }

    private double heightDifference(double begin, double end) {
        return heightDifference(end) - heightDifference(begin);
    }

    private double heightDifference(double distance) {
        return heightDifference(this.state.location.trackSectionRanges.getFirst(), distance);
    }

    private double heightDifference(TrackSectionRange tr, double distance) {
        var listTrack = getListTrackSectionRangeUntilDistance(tr, distance);
        var height = 0.;
        for (TrackSectionRange track : listTrack) {
            height += heightDifferenceBetweenPoints(track);
        }
        return height;
    }
    

    //TODO: need to be implement when it will be considered in the simulation
    private double distanceTravelledFreeWilling(double speed, double finalSpeed, double accel, double i) {
        if (jerk > 0) {
            var brakingSettlingTime = (accel + gamma) / jerk;
            return brakingSettlingTime * finalSpeed;
        }
        return 0;
    }

    private double accel_erre(double i, double speed) {
        var mass = this.schedule.rollingStock.mass;
        return -Math.sin(i) * 9.81
                + Math.max(state.accel + jerk * dt, this.schedule.rollingStock.getMaxEffort(this.state.speed) / mass);
    }

    private double final_speed(double accel, double speed) {
        return accel * this.timeReact + speed;
    }

    /**
     * Compute the distance he will travelled during free whilling and the needed margin due to time step 
     * behind the next danger
     * @param nextDangerDistance distance to the next danger
     * @param speed              speed of the train
     * @return the marge behind the next danger, the distance when the braking will
     *         be established and the speed when the speed will be established
     */
    private MargeCalculation getDistanceStart(double nextDangerDistance, double speed) {
        ArrayDeque<TrackSectionRange> listTrack = getListTrackSectionRangeUntilDistance(nextDangerDistance);
        var grad = maxGradient(listTrack);
        var i = Math.atan(grad / 1000);
        var accel = accel_erre(i, speed);
        var finalSpeed = Math.max(final_speed(accel, speed), 0.);
        var startDistance = distanceTravelledFreeWilling(speed, finalSpeed, accel, i);

        var margin = marginBehindNextDanger(speed, accel);
        var marge = new MargeCalculation(startDistance, margin, finalSpeed);

        return marge;
    }

    private static class MargeCalculation {
        public final double startDistance;
        public final double margin;
        public final double finalSpeed;

        /**
         * Constructor of MargeCalculation
         * @param startDistance the distance when the braking will be established
         * @param margin        the marge behind the next danger, due to the time step
         * @param finalSpeed    the speed of the train when the braking will be
         *                      established
         */
        public MargeCalculation(double startDistance, double margin, double finalSpeed) {
            this.startDistance = startDistance;
            this.margin = margin;
            this.finalSpeed = finalSpeed;
        }
    }
    

    private double maxGradient(ArrayDeque<TrackSectionRange> trackSectionRanges) {
        var val = 0.;
        var minVal = Double.POSITIVE_INFINITY;
        for (var track : trackSectionRanges) {
            var gradients = track.edge.forwardGradients;
            if (track.direction == EdgeDirection.STOP_TO_START)
                gradients = track.edge.backwardGradients;
            var slopesUnderTheTrain = gradients.getValuesInRange(track.getBeginPosition(), track.getEndPosition());
            for (var slope : slopesUnderTheTrain.entrySet()) {

                if (minVal > slope.getValue()) {
                    val = slope.getValue();
                    minVal = slope.getValue();
                }
            }
        }
        return val;
    }

    private double heightDifferenceBetweenPoints(TrackSectionRange track) {
        var height = 0.;
        var gradients = track.edge.forwardGradients;
        var begin = 0.;
        if (track.direction == EdgeDirection.STOP_TO_START)
            gradients = track.edge.backwardGradients;
        Set<Double> entries = gradients.keySet();
        for (var end : entries) {
            var grad = gradients.get(begin);
            var slope = Math.atan(grad / 1000);
            if (end >= track.getEndPosition() && begin <= track.getBeginPosition()) {
                // logger.debug("height : {}", slope);
                height += Math.sin(slope)
                        * (Math.min(end, track.getBeginPosition()) - Math.max(begin, track.getEndPosition()));
            }
            begin = end;
            if (begin > track.getBeginPosition())
                break;
        }
        return height;

    }

    private TrackSection nextTrackSection(TrackSection track) {
        List<TrackSectionRange> trackSectionPath = state.location.trackSectionPath;
        TrackSection nextTrackSection = null;
        var currentEdge = track;
        for (int i = 1; i < trackSectionPath.size(); i++) {
            if (trackSectionPath.get(i - 1).edge.id.equals(currentEdge.id)
                    && !trackSectionPath.get(i).edge.id.equals(currentEdge.id)) {
                nextTrackSection = trackSectionPath.get(i).edge;
                break;
            }
        }
        return nextTrackSection;
    }

    private ArrayDeque<TrackSectionRange> getListTrackSectionRangeUntilDistance(TrackSectionRange tr, double distance) {
        ArrayDeque<TrackSectionRange> tracks = new ArrayDeque<>();
        var begin = tr.getEndPosition();
        TrackSection edge = tr.edge;
        while (distance > 0 && edge != null) {
            tracks.add(new TrackSectionRange(edge, state.location.trackSectionRanges.getFirst().direction, begin,
                    Math.min(edge.length - begin, distance)));
            distance -= Math.min(edge.length - begin, distance);
            edge = nextTrackSection(edge);
            begin = 0;
        }
        return tracks;
    }

    private ArrayDeque<TrackSectionRange> getListTrackSectionRangeUntilDistance(double distance) {
        return getListTrackSectionRangeUntilDistance(this.state.location.trackSectionRanges.getFirst(), distance);
    }

}
