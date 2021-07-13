package fr.sncf.osrd.cbtc;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.TrainPositionTracker;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.CBTCSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import kotlin.internal.AccessibleLateinitPropertyLiteral;

import java.util.*;
//import java.util.ArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class CBTCATP {
    static final Logger logger = LoggerFactory.getLogger(CBTCATP.class);
    TrainState trainState;
    TrainPositionTracker location;
    TrainSchedule trainSchedule;
    Simulation sim;

    double time_erre = 0.4;
    double time_react = 0.4;
    double braking_settling_time;

    double jerk = 0.6;

    double margeBehindTrain = 10;

    double dt = 0.2;
    double marge = 10;

    public CBTCATP(Simulation sim, TrainSchedule trainSchedule, TrainState trainState) {
        this.location = trainState.location;
        this.trainSchedule = trainSchedule;
        this.trainState = trainState;
        this.sim = sim;
        braking_settling_time = trainSchedule.rollingStock.timetableGamma / jerk;
    }

    private TrackSectionLocation getLocation() {
        return trainSchedule.findLocation(location.getPathPosition());
    }

    private double getNextClosedSwitchPathPosition() {
        ArrayList<TrackSectionRange> fullPath = trainSchedule.fullPath;
        var curTrackSectionPos = location.trackSectionRanges.getFirst();

        boolean seen = false;
        double switchPosition = 0;
        for (int i = 0; i < fullPath.size(); i++) {
            TrackSectionRange range = fullPath.get(i);
            switchPosition += range.length();
            if (!seen && range.edge.id == curTrackSectionPos.edge.id) {
                seen = true;
            }
            if (seen) {
                var nodeIndex = range.edge.getEndNode(range.direction);
                var node = sim.infra.trackGraph.getNode(nodeIndex);

                if (node.getClass() == Switch.class) {
                    var switchState = sim.infraState.getSwitchState(((Switch) node).switchIndex);
                    var nextTrackSection = (i < fullPath.size() - 1) ? fullPath.get(i + 1) : null;
                    if (switchState.getPosition() == SwitchPosition.MOVING || nextTrackSection == null
                            || nextTrackSection.edge.id != switchState.getBranch().id
                                    && range.edge.id != switchState.getBranch().id) {
                        logger.debug("CLOSED SWITCH POSITION : {} | {}", switchPosition - 50,
                                location.getPathPosition());
                        return switchPosition - 50; // TODO : change 50 for a meaningfull variable
                    }
                }
            }
        }

        return Double.POSITIVE_INFINITY;

    }

    public double getNextDangerPointPathDistance() {
        // Find next switch
        double nextSwitchPathPosition = getNextClosedSwitchPathPosition();
        double nextSwitchPathDistance = nextSwitchPathPosition - this.location.getPathPosition();

        // Find next train
        double nextTrainPathDistance = getDistanceNextTrain();

        // Find end of path
        double endOfPathPosition = 0;
        for (TrackSectionRange track : trainSchedule.fullPath) {
            endOfPathPosition += track.length();
        }
        double endOfPathDistance = endOfPathPosition - this.location.getPathPosition();
        // return min of the three potential danger point
        return Math.min(nextSwitchPathDistance, Math.min(nextTrainPathDistance, endOfPathDistance));
    }

    // Retroune True, si l'énergie qu'il peut dissiper sur la distance est plus
    // grande que son énergie initiale

    public double marginBehindNextDanger(double speed, double finalSpeed, double accel, double i, double startdistance, double nextDangerDistance) {
        //TODO : à revoir

        //Distance travelled by the train at the next time
        double distance = speed * dt + dt * dt / 2. * accel
                + (speed * accel * dt + accel * accel * dt * dt / 2.) / this.trainSchedule.rollingStock.timetableGamma;
        
        //Time to settle braking
        double gamma = this.trainSchedule.rollingStock.timetableGamma;
        var braking_settling_time = (this.trainState.accel + gamma)/jerk;
        distance += jerk * Math.pow(braking_settling_time, 3) / 6.; 

        //Difference Distance between current StartDistance and the next one
        var nextAccel = Math.min(accel + jerk * dt, this.trainSchedule.rollingStock.getMaxEffort(speed)); 
        var nextSpeed = speed + nextAccel * dt;
        distance += startingDistance(speed, finalSpeed, accel, i) - startdistance; 

        //Energy acquiere 
        distance += 1. / 2. * (Math.pow(nextSpeed,2) - Math.pow(speed,2)) / gamma;
        
        //No potential energy acquire
        return distance + 10; 
    }

    // Dissipated energy on distance
    public double lostBrakeEnergy(double distance) {
        // Only working with constant Gamma//
        double gamma = this.trainSchedule.rollingStock.timetableGamma;
        double energy = -gamma * distance;
        return energy;
    }

    public double cineticEnergy(double vitesse) {
        return 1.0 / 2.0 * Math.pow(vitesse, 2);
    }

    public double potentialEnergy(double end) {
        return -HeightDifference(0, end) * 9.81;
    }

    private double potentialEnergy(double distance, double end) {
        var height = HeightDifference(distance, end);
        // System.err.println(height);
        return -height * 9.81;
    }

    private double HeightDifference(double begin, double end) {
        return HeightDifference(end) - HeightDifference(begin);
    }

    private double HeightDifference(double distance) {
        return HeightDifference(this.trainState.location.trackSectionRanges.getFirst(), distance);
    }

    private double HeightDifference(TrackSectionRange tr, double distance) {
        ArrayDeque<TrackSectionRange> listTrack = getListTrackSectionRangeUntilDistance(tr, distance);
        var height = 0.;
        for (TrackSectionRange track : listTrack) {
            height += HeigthDifferenceBetweenPoints(track);
        }
        return height;
    }

    private double startingDistance(double speed, double finalspeed, double accel, double i) {
        double gamma = this.trainSchedule.rollingStock.timetableGamma;
        var braking_settling_time = (accel + gamma) / jerk;
        double update_position = Math.pow(this.time_react, 2) * (accel + 9.81 * Math.sin(i)) / 2.
                + this.time_react * (speed);
        update_position += this.time_erre * finalspeed;
        update_position += braking_settling_time * finalspeed - jerk * Math.pow(braking_settling_time, 2) / 2.;
        return update_position;
    }

    private double accel_erre(double i, double speed) {
        //TODO : optimise the acceleration with the jerk 
        double mass = this.trainSchedule.rollingStock.mass;
        return - Math.sin(i) * 9.81 + this.trainSchedule.rollingStock.getMaxEffort(this.trainState.speed) / mass;
    }

    private double final_speed(double accel, double speed) {
        return accel * this.time_react + speed;
    }

    public List<Double> getDistanceStart(double nextDangerDistance, double speed){
        ArrayDeque<TrackSectionRange> listTrack = getListTrackSectionRangeUntilDistance(nextDangerDistance);
        double grad = maxGradient(listTrack);
        double i = Math.atan(grad / 1000);
        double accel = accel_erre(i, speed);
        double finalSpeed = final_speed(accel, speed);
        double startdistance = startingDistance(speed, finalSpeed, accel, i);

        double margin = marginBehindNextDanger(speed, finalSpeed, accel, i, startdistance, nextDangerDistance);

        ArrayList<Double> li = new ArrayList<Double>();
        li.add(startdistance);
        li.add(margin);
    
        return li;
    }

    public ArrayList<SpeedController> directive() {
        double gamma = this.trainSchedule.rollingStock.timetableGamma;

        ArrayList<SpeedController> controllers = new ArrayList<SpeedController>();
        double nextDangerDistance = getNextDangerPointPathDistance();

        var li =  getDistanceStart(nextDangerDistance, this.trainState.speed);
        
        double startdistance = li.get(0);
        double marginBehindDanger = li.get(1);

        double distanceSecure = nextDangerDistance - marginBehindDanger - startdistance;

        double cineticEnergy = cineticEnergy(this.trainState.speed);

        System.err.println(trainSchedule.trainID + " " + trainState.location.getPathPosition() + " " + trainState.speed
                + " " + startdistance + " " + marginBehindDanger + " "
                + potentialEnergy(startdistance, nextDangerDistance)+" "+ (cineticEnergy + potentialEnergy(startdistance, distanceSecure) + lostBrakeEnergy(distanceSecure) < 0));

        if (cineticEnergy + potentialEnergy(startdistance, distanceSecure) + lostBrakeEnergy(distanceSecure) < 0) {
            logger.debug("true");
            return controllers;
        }

        if (cineticEnergy + potentialEnergy(startdistance, nextDangerDistance)
                + lostBrakeEnergy(nextDangerDistance - startdistance) < 0 ) {
            logger.debug("false");
            controllers.add(new CBTCSpeedController(0, location.getPathPosition() - 20,
                    nextDangerDistance + location.getPathPosition() - margeBehindTrain + 10, gamma));
            return controllers;

        } else { // Enter EMERGENCY_BRAKING
            throw new RuntimeException("Enter Emergency Braking");
            // controllers.add(new MaxSpeedController(0, 0, nextDangerDistance));
            // controllers.add(new LimitAnnounceSpeedController(0, 0, nextDangerDistance,
            // gamma));
            // controllers.add(new CBTCSpeedController(0, location.getPathPosition() - 20,
            // nextDangerDistance + location.getPathPosition() - margeBehindTrain + 10,
            // gamma));
            // return controllers;

        }
    }

    // Return a HashMap : Entry Tracksection id, Value List Train
    private HashMap<String, ArrayList<Train>> getTrainTracks() {
        var trains = sim.trains;
        Iterator<Map.Entry<String, Train>> iterator = trains.entrySet().iterator();
        HashMap<String, ArrayList<Train>> ListTrackSection = new HashMap<>();
        while (iterator.hasNext()) {
            Map.Entry<String, Train> mapentry = iterator.next();
            Train train = mapentry.getValue();
            if (!train.schedule.trainID.equals(this.trainSchedule.trainID)) {
                TrackSection tracksection = train.getLastState().location.trackSectionRanges.getLast().edge;
                String key = tracksection.id;
                if (ListTrackSection.containsKey(key)) {
                    ListTrackSection.get(key).add(train);
                } else {
                    ArrayList<Train> list = new ArrayList<>();
                    list.add(train);
                    ListTrackSection.put(key, list);
                }
            }
        }
        return ListTrackSection;
    }

    private double getDistanceNextTrain() {
        var distance = Double.POSITIVE_INFINITY;
        var tracksectionpath = this.trainSchedule.fullPath;
        var currentTrackSection = this.trainState.location.trackSectionRanges.getFirst().edge;
        HashMap<String, ArrayList<Train>> ListTrackSection = getTrainTracks();
        ArrayList<Train> listetrain = null;
        boolean before = false;
        int i = 0;
        for (i = 0; i < tracksectionpath.size(); i++) {
            TrackSectionRange tsr = tracksectionpath.get(i);
            if (tsr.edge.id == currentTrackSection.id) {
                before = true;
            }
            if (before)
                break;
        }
        var longueur = -this.trainState.location.trackSectionRanges.getFirst().getEndPosition();
        TrackSection section = currentTrackSection;
        while (i < tracksectionpath.size() && (listetrain == null || listetrain.size() == 0)) {
            var track = tracksectionpath.get(i);
            listetrain = ListTrackSection.get(track.edge.id);

            if (listetrain != null && listetrain.size() != 0 && track.edge.id.equals(currentTrackSection.id)) {
                ArrayList<Train> listetrain2 = new ArrayList<>();
                for (Train train : listetrain) {
                    if (train.getLastState().location.trackSectionRanges.getLast()
                            .getBeginPosition() > this.trainState.location.trackSectionRanges.getFirst()
                                    .getEndPosition()) {
                        listetrain2.add(train);
                    }
                }
                listetrain = listetrain2;
            }
            if (!section.id.equals(track.edge.id)) {
                longueur += section.length;
                section = track.edge;
            }
            i++;

            if (listetrain != null && listetrain.size() != 0 && track.edge.id.equals(currentTrackSection.id))
                break;

        }
        if (listetrain == null || listetrain.isEmpty()) {
            return Double.POSITIVE_INFINITY;
        }
        Train tr = listetrain.get(0);
        for (Train train : listetrain) {
            if (train.getLastState().location.trackSectionRanges.getFirst()
                    .getBeginPosition() < tr.getLastState().location.trackSectionRanges.getFirst().getBeginPosition()) {
                tr = train;
            }
        }
        distance = longueur + tr.getLastState().location.trackSectionRanges.getLast().getBeginPosition();
        assert distance > 0;
        return distance;
    }

    // function to determine max tilt before nextdanger
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

    private double HeigthDifferenceBetweenPoints(TrackSectionRange track) {
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
        List<TrackSectionRange> trackSectionPath = trainState.location.trackSectionPath;
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
            tracks.add(new TrackSectionRange(edge, trainState.location.trackSectionRanges.getFirst().direction, begin,
                    Math.min(edge.length - begin, distance)));
            distance -= Math.min(edge.length - begin, distance);
            edge = nextTrackSection(edge);
            begin = 0;
        }
        return tracks;
    }

    private ArrayDeque<TrackSectionRange> getListTrackSectionRangeUntilDistance(double distance) {
        return getListTrackSectionRangeUntilDistance(this.trainState.location.trackSectionRanges.getFirst(), distance);
    }
}
