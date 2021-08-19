package fr.sncf.osrd.speedcontroller;

import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.train.TrainState;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.speedcontroller.CBTCSpeedController;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.utils.graph.EdgeDirection;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

/**
 * Class dedicated to create a speedcontroller use for the CBTCphase, based on the MA.
 * The speed controller used to slow down the train from the announce of a speed
 * limit, or a train or a switch up to its enforcement signal.
 */
public final class CBTCSpeedController extends SpeedController {
    static final Logger logger = LoggerFactory.getLogger(CBTCSpeedController.class);

    public final double targetSpeedLimit;
    public final double gamma;
    public final TrainState state;
    public final TrainSchedule schedule;

    //TODO : use realistic value based on the documentation
    private final double timeErre = .4;
    private final double timeReact = .4;

    private final double jerk = .6;

    private static final double dt = 0.2;

     /**
      * Create a speed Controller for CBTC phases based on the Mouvement Authorithy 
      * @param targetSpeedLimit
      * @param startPosition
      * @param endPosition
      * @param gamma
      * @param state
      * @param schedule
      */
    public CBTCSpeedController(
            double targetSpeedLimit, 
            double startPosition, 
            double endPosition, 
            double gamma,
            TrainState state, 
            TrainSchedule schedule) {
        super(startPosition, endPosition);
        this.targetSpeedLimit = targetSpeedLimit;
        this.gamma = gamma;
        this.state = state;
        this.schedule = schedule;
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

    @Override
    public SpeedDirective getDirective(double pathPosition) {

        double nextDangerDistance = endPosition - state.location.getPathPosition();

        if (nextDangerDistance > 4000)
            return new SpeedDirective(Double.POSITIVE_INFINITY);

        var li = getDistanceStart(nextDangerDistance, this.state.speed);

        double startdistance = li.get(0);
        double marginBehindDanger = li.get(1);
        double finalspeed = li.get(2);

        double gamma = this.schedule.rollingStock.gamma;
        double cineticEnergy = cineticEnergy(finalspeed) - cineticEnergy(targetSpeedLimit);

        double distanceSecure = nextDangerDistance - 5 * marginBehindDanger - startdistance;

        if ((cineticEnergy + potentialEnergy(startdistance, distanceSecure) + lostBrakeEnergy(distanceSecure) < 0
                && nextDangerDistance > 30) || cineticEnergy < 0) {
            return new SpeedDirective(Double.POSITIVE_INFINITY);
        }

        if (cineticEnergy < 15) {
            System.err.println(schedule.trainID + " " + state.location.getPathPosition() + " " + state.accel + " " + 3
                    + " " + targetSpeedLimit + " " + state.speed);
            return new SpeedDirective(Math.max(targetSpeedLimit, 1.)); // max is only for test!
        }

        distanceSecure = nextDangerDistance - 4 * marginBehindDanger - startdistance;

        if (cineticEnergy + potentialEnergy(startdistance, distanceSecure) + lostBrakeEnergy(distanceSecure) < 0) {
            var targetSpeed = state.speed
                    + (state.accel + schedule.rollingStock.rollingResistance(state.speed) / schedule.rollingStock.mass)
                            * dt;
            System.err.println(schedule.trainID + " " + state.location.getPathPosition() + " " + state.accel + " " + 1
                    + " " + targetSpeed + " " + state.speed);
            return new SpeedDirective(targetSpeed);

        }
        distanceSecure = nextDangerDistance - marginBehindDanger - startdistance;

        if (cineticEnergy + potentialEnergy(startdistance, distanceSecure) + lostBrakeEnergy(distanceSecure) < 0) {
            var targetSpeed = 0.;

            if (state.accel > -gamma / 10)
                targetSpeed = state.speed;

            System.err.println(schedule.trainID + " " + state.location.getPathPosition() + " " + state.accel + " " + 2
                    + " " + targetSpeed + " " + state.speed);

            return new SpeedDirective(targetSpeed);
        }

        distanceSecure = nextDangerDistance - startdistance;

        if (cineticEnergy + potentialEnergy(startdistance, nextDangerDistance) + lostBrakeEnergy(distanceSecure) <= 0) {
            System.err.println(schedule.trainID + " " + state.location.getPathPosition() + " " + state.accel + " " + 4
                    + " " + targetSpeedLimit + " " + state.speed);
            return new SpeedDirective(targetSpeedLimit);


        } // Enter EMERGENCY_BRAKING
        double brakingDistance = (cineticEnergy + potentialEnergy(startdistance, distanceSecure)) / gamma;
        throw new RuntimeException("Enter Emergency Breaking" + schedule.trainID
                + (nextDangerDistance - startdistance - brakingDistance) / marginBehindDanger);
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
    private double marginBehindNextDanger(double speed, double finalSpeed, double accel, double i, double startdistance,
            double nextDangerDistance) {
        double gamma = this.schedule.rollingStock.gamma;

        // Distance travelled by the train at the next time
        double distance = speed * dt + dt * dt / 2. + (speed * accel * dt + accel * accel * dt * dt / 2.) / gamma;

        /* Time to settle braking */
        /* TODO : add freewheeling */
        var brakingSettlingTime = dt * 1.;
        distance += jerk * Math.pow(brakingSettlingTime, 3) / 6.;

        return distance + 10.;
    }

    /**
     * Dissipated energy on distance
     * Only work with constant gamma
     */
    private double lostBrakeEnergy(double distance) {
        // Only working with constant Gamma//
        double gamma = this.schedule.rollingStock.gamma;
        double energy = -gamma * distance;
        return energy;
    }

    /**
     * @param vitesse
     * @return cintetic energie divided by the mass of the train
     */
    public double cineticEnergy(double vitesse) {
        return 1.0 / 2.0 * Math.pow(vitesse, 2);
    }

    /**
     * Calculate the difference of potential Energy
     * @param end Distance in front of the train
     * @return Difference of potentiel energy
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
        ArrayDeque<TrackSectionRange> listTrack = getListTrackSectionRangeUntilDistance(tr, distance);
        var height = 0.;
        for (TrackSectionRange track : listTrack) {
            height += heigthDifferenceBetweenPoints(track);
        }
        return height;
    }

    private double startingDistance(double speed, double finalspeed, double accel, double i) {
        double gamma = this.schedule.rollingStock.gamma;
        var brakingSettlingTime = (accel + gamma) / jerk;
        double updatePosition = brakingSettlingTime * finalspeed - jerk * Math.pow(brakingSettlingTime, 3) / 6.;

        //TODO : add freewheeling
        if (true)
            return updatePosition;

        updatePosition = Math.pow(this.timeReact, 2) * (accel + 9.81 * Math.sin(i)) / 2. + this.timeReact * (speed);
        updatePosition += this.timeErre * finalspeed;
        return updatePosition;
    }

    private double accel_erre(double i, double speed) {
        double mass = this.schedule.rollingStock.mass;
        return -Math.sin(i) * 9.81
                + Math.min(state.accel + jerk * dt, this.schedule.rollingStock.getMaxEffort(this.state.speed) / mass);
    }

    private double final_speed(double accel, double speed) {
        return accel * this.timeReact + speed;
    }

    /**
     * 
     * @param nextDangerDistance
     * @param speed
     * @return
     */
    private margeCalcul getDistanceStart(double nextDangerDistance, double speed) {
        ArrayDeque<TrackSectionRange> listTrack = getListTrackSectionRangeUntilDistance(nextDangerDistance);
        double grad = maxGradient(listTrack);
        double i = Math.atan(grad / 1000);
        double accel = accel_erre(i, speed);
        double finalSpeed = final_speed(accel, speed);
        double startDistance = startingDistance(speed, finalSpeed, accel, i);

        double margin = marginBehindNextDanger(speed, finalSpeed, accel, i, startDistance, nextDangerDistance);

        ArrayList<Double> li = new ArrayList<Double>();
        li.add(startDistance);
        li.add(margin);
        li.add(finalSpeed);

        var marge = new margeCalcul(startDistance, margin, finalSpeed);

        return marge;
    }

    private class margeCalcul {
        public final double startDistance;
        public final double margin;
        public final double finalSpeed;

        /**
         * @param startDistance
         * @param margin
         * @param finalSpeed
         */
        margeCalcul(double startDistance, double margin, double finalSpeed){
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

            for (var slope : gradients.getValuesInRange(track.getBeginPosition(), track.getEndPosition())) {
                if (minVal > slope) {
                    val = slope;
                    minVal = slope;
                }
            }
        }
        return val;
    }

    private double heigthDifferenceBetweenPoints(TrackSectionRange track) {
        var height = 0.;
        var gradients = track.edge.forwardGradients;
        var begin = 0.;
        if (track.direction == EdgeDirection.STOP_TO_START)
            gradients = track.edge.backwardGradients;
        Set<Double> entries = gradients.keySet();
        for (var end : entries) {
            double grad = gradients.get(begin);
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
        double begin = tr.getEndPosition();
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
