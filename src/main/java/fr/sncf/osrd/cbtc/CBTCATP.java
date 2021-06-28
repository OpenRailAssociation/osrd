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
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.infra.trackgraph.TrackSection;

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

    public CBTCATP(Simulation sim, TrainSchedule trainSchedule, TrainState trainState) {
        this.location = trainState.location;
        this.trainSchedule = trainSchedule;
        this.trainState = trainState;
        this.sim = sim;
    }

    private TrackSectionLocation getLocation() {
        return trainSchedule.findLocation(location.getPathPosition());
    }

    private double getNextClosedSwitchPathPosition() {
        ArrayList<TrackSectionRange> fullPath = trainSchedule.fullPath;
        if (location.getPathPosition() > 360) {
            System.out.println("stop");
        }
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

    public double getNextDangerPointPathPostion() {
        // Find next switch
        double nextSwitchPathPosition = getNextClosedSwitchPathPosition();

        // Find next train
        double nextTrainPathPosition = getDistanceNextTrain();

        // Find end of path
        double endOfPathPosition = 0;
        for (TrackSectionRange track : trainSchedule.fullPath) {
            endOfPathPosition += track.length();
        }
        endOfPathPosition -= this.location.getPathPosition();
        // return min of the three potential danger point
        return Math.min(nextSwitchPathPosition, Math.min(nextTrainPathPosition, endOfPathPosition));
    }

    // Retroune True, si l'énergie qu'il peut dissiper sur la distance est plus
    // grande que son énergie initiale
    public boolean canBreak(double distance) {
        if (lostBrakeEnergie(distance) - initialEnergie() > 0) {
            return true;
        }
        return false;
    }

    public double marginBehindNextDanger(double dt, // Time step of the simulation
            double marge // stopping distance behind the next danger
    ) {
        double speed = this.trainState.speed;
        return getNextDangerPointPathPostion() - starting_position() - (dt * speed + marge);
    }

    // Dissipated energie on distance
    public double lostBrakeEnergie(double distance) {
        // TODO : Consider the change of altitude!!
        // Only working with constant Gamma//
        double mass = this.trainSchedule.rollingStock.mass;
        double gamma = this.trainSchedule.rollingStock.timetableGamma;
        double energie = gamma * mass * distance;
        return energie;
    }

    public double initialEnergie() {
        // TODO Consider the altitude
        double vitesse = this.final_speed();
        double mass = this.trainSchedule.rollingStock.mass;
        return 1.0 / 2.0 * mass * Math.pow(vitesse, 2);// TODO : Consider the altitude
    }

    private double max_tilt() {

        return 0;
    }

    private double starting_position() {
        var speed = this.trainState.speed;
        var accel = this.accel_erre();
        double update_position = Math.pow(this.time_react, 2) * (accel) / 2 + this.time_react * speed;
        update_position += this.time_erre * this.final_speed();
        return update_position;
    }

    private double accel_erre() {
        var i = this.max_tilt();
        double mass = this.trainSchedule.rollingStock.mass;
        return Math.sin(i) * 9.81 * mass + this.trainSchedule.rollingStock.getMaxEffort(this.trainState.speed) / mass;
    }

    private double final_speed() {
        return accel_erre() * this.time_react + this.trainState.speed;
    }

    public double CBTC() {
        if (canBreak(marginBehindNextDanger(1, 100)))
            return 0;
        if (canBreak(getNextDangerPointPathPostion() - location.getPathPosition() - 50))
            return 1;
        return 2;
    }

    public ArrayList<SpeedController> directive() {
        double gamma = this.trainSchedule.rollingStock.timetableGamma;
        ArrayList<SpeedController> controllers = new ArrayList<SpeedController>();
        double nextDangerPosition = getNextDangerPointPathPostion();
        if (canBreak(marginBehindNextDanger(1, 100))) {
            logger.debug("true");
            return controllers;
        }
        if (canBreak(nextDangerPosition - location.getPathPosition() - 50) || true) {
            logger.debug("false");
            controllers.add(new LimitAnnounceSpeedController(0, location.getPathPosition() - 50,
                    nextDangerPosition + location.getPathPosition() - 90, gamma));
            controllers.add(new MaxSpeedController(0, nextDangerPosition - 90 + location.getPathPosition(),
                    nextDangerPosition + location.getPathPosition()));
            return controllers;
        } else { // Enter EMERGENCY_BRAKING
            controllers.add(new MaxSpeedController(0, 0, nextDangerPosition));
            controllers.add(new LimitAnnounceSpeedController(0, 0, nextDangerPosition, gamma));
            return controllers;
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
        for (Map.Entry<String, ArrayList<Train>> mapentry1 : ListTrackSection.entrySet()) {
            String a = "";
            for (Train tt : mapentry1.getValue()) {
                a = a + tt.schedule.trainID + " ";
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
            if (listetrain != null && listetrain.size() != 0 && track.edge.id.equals(currentTrackSection.id))
                break;

            if (!section.id.equals(track.edge.id)) {
                logger.debug("On ajoute la taille d'un canton");
                longueur += section.length;
                section = track.edge;
            }
            i++;
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

}
