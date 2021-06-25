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
                            || nextTrackSection.edge.id != switchState.getBranch().id) {
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
        logger.debug("id train {}, next train position {}", trainSchedule.trainID, nextTrainPathPosition);
        // Find end of path
        double endOfPathPosition = 0;
        for (TrackSectionRange track : trainSchedule.fullPath) {
            endOfPathPosition += track.length();
        }
        endOfPathPosition -= this.location.getPathPosition();
        // return min of the three potential danger point
        logger.debug(
                "Train : {} -> sa position : {} -> Distance fin de track : {} -> Distance porchain train {}, retenu : {}",
                this.trainSchedule.trainID, this.location.getPathPosition(), endOfPathPosition, nextTrainPathPosition,
                Math.min(nextSwitchPathPosition, Math.min(nextTrainPathPosition, endOfPathPosition)));
        // return Double.POSITIVE_INFINITY;
        return Math.min(nextSwitchPathPosition, Math.min(nextTrainPathPosition, endOfPathPosition));
    }

    public boolean canBreak(double distance) {
        if (lostBrakeEnergie(distance) - initialEnergie() > 0) {
            return true;
        }
        return false;
    }

    public double marginBehindNextDanger(double dt, double marge) {
        double vitesse = this.trainState.speed;
        return getNextDangerPointPathPostion() - position_depart() - (dt * vitesse + marge);
    }

    public double lostBrakeEnergie(double distance) {
        // Attention la différence d'altitude n'est pas prise en compte!!//
        // Ne marche uniquement avec un gamma constant!!//
        // var distance = marginBehindNextDanger(1,100);
        double mass = this.trainSchedule.rollingStock.mass;
        double gamma = this.trainSchedule.rollingStock.timetableGamma;
        double energie = gamma * mass * distance;
        return energie;
    }

    public double initialEnergie() {
        double vitesse = this.vitesse_finale();
        double mass = this.trainSchedule.rollingStock.mass;
        // logger.debug("Energie initiale {}", 1.0/2.0*mass*vitesse );
        return 1.0 / 2.0 * mass * Math.pow(vitesse, 2);// Penser à rajouter la hauteur du train;
    }

    private double inclinaison_max() {
        // recherche entre le train et le point la plus petite pente
        return 0;
    }

    private double position_depart() {
        var speed = this.trainState.speed;
        var accel = this.accel_erre();
        double update_position = Math.pow(this.time_react, 2) * (accel) / 2 + this.time_react * speed;
        update_position += this.time_erre * this.vitesse_finale();
        return update_position;
    }

    private double accel_erre() {
        var i = this.inclinaison_max();
        double mass = this.trainSchedule.rollingStock.mass;
        return Math.sin(i) * 9.81 * mass + this.trainSchedule.rollingStock.getMaxEffort(this.trainState.speed) / mass;
    }

    private double vitesse_finale() {
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
        } else {
            controllers.add(new MaxSpeedController(0, 0, nextDangerPosition));
            controllers.add(new LimitAnnounceSpeedController(0, 0, nextDangerPosition, gamma));
            return controllers;
        }
    }

    private HashMap<String, ArrayList<Train>> getTrainTracks() {
        var trains = sim.trains;
        Iterator<Map.Entry<String, Train>> iterator = trains.entrySet().iterator();
        HashMap<String, ArrayList<Train>> ListTrackSectionRange = new HashMap<>();
        while (iterator.hasNext()) {
            Map.Entry<String, Train> mapentry = iterator.next();
            Train train = mapentry.getValue();
            if (!train.schedule.trainID.equals(this.trainSchedule.trainID)) {
                TrackSection tracksection = train.getLastState().location.trackSectionRanges.getLast().edge;
                // logger.debug("train : {}, tracksection :{}", train.schedule.trainID,
                // train.getLastState().location.trackSectionRanges.getFirst().edge.id);
                String cle = tracksection.id;
                if (ListTrackSectionRange.containsKey(cle)) {
                    ListTrackSectionRange.get(cle).add(train);
                } else {
                    ArrayList<Train> list = new ArrayList<>();
                    list.add(train);
                    ListTrackSectionRange.put(cle, list);
                }
            }
        }
        for (Map.Entry<String, ArrayList<Train>> mapentry1 : ListTrackSectionRange.entrySet()) {
            String a = "";
            for (Train tt : mapentry1.getValue()) {
                a = a + tt.schedule.trainID + " ";
            }
            // logger.debug("tracksection : {}, train sur la tracksection {}",
            // mapentry1.getKey(), a);
        }
        // logger.debug("{}!!!!!!!!!!!!!!!!!!!!!!!", ListTrackSectionRange);
        return ListTrackSectionRange;
    }

    private double getDistanceNextTrain() {
        var distance = Double.POSITIVE_INFINITY;
        var tracksectionpath = this.trainSchedule.fullPath;
        var currentTrackSection = this.trainState.location.trackSectionRanges.getLast().edge;
        HashMap<String, ArrayList<Train>> ListTrackSectionRange = getTrainTracks();
        ArrayList<Train> listetrain = null;
        boolean devant = false;
        int i = 0;
        for (i = 0; i < tracksectionpath.size(); i++) {
            TrackSectionRange tsr = tracksectionpath.get(i);
            if (tsr.edge.id == currentTrackSection.id) {
                devant = true;
            }
            if (devant)
                break;
        }
        ;

        // On considère les trains sur la meme tracksection
        listetrain = ListTrackSectionRange.get(currentTrackSection.id);
        ArrayList<Train> listetrain2 = new ArrayList<>();
        if (listetrain != null && listetrain.size() != 0) {
            for (Train train : listetrain) {
                if (train.getLastState().location.trackSectionRanges.getFirst()
                        .getBeginPosition() > this.trainState.location.trackSectionRanges.getLast().getEndPosition()) {
                    listetrain2.add(train);
                }
            }
            listetrain = listetrain2;
            if (listetrain != null && listetrain.size() != 0) {
                Train tr = listetrain.get(0);
                for (Train train : listetrain) {
                    if (train.getLastState().location.trackSectionRanges.getFirst()
                            .getBeginPosition() < tr.getLastState().location.trackSectionRanges.getFirst()
                                    .getBeginPosition()) {
                        tr = train;
                    }
                }
                return tr.getLastState().location.trackSectionRanges.getFirst().getBeginPosition()
                        - this.trainState.location.trackSectionRanges.getLast().getEndPosition(); // a vérifier getLast
                                                                                                  // et getFirst
            }
        }
        var longueur = currentTrackSection.length
                - this.trainState.location.trackSectionRanges.getLast().getEndPosition();
        TrackSection section = currentTrackSection;
        i++;
        while (i < tracksectionpath.size() && (listetrain == null || listetrain.size() == 0)) {
            var track = tracksectionpath.get(i);
            listetrain = ListTrackSectionRange.get(track.edge.id);
            if (listetrain != null && listetrain.size() != 0)
                break;
            if (!section.id.equals(track.edge.id)) {
                logger.debug("On ajoute la taille d'un canton");
                longueur += track.edge.length;
            }
            section = track.edge;
            i++;
        }
        if (listetrain == null || listetrain.isEmpty()) {
            // logger.debug("111111111111111111");
            return Double.POSITIVE_INFINITY;
        }
        Train tr = listetrain.get(0);
        for (Train train : listetrain) {
            if (train.getLastState().location.trackSectionRanges.getFirst()
                    .getBeginPosition() < tr.getLastState().location.trackSectionRanges.getFirst().getBeginPosition()) {
                tr = train;
            }
        }
        logger.debug("begin : {}, end : {}",
                tr.getLastState().location.trackSectionRanges.getFirst().getBeginPosition(),
                tr.getLastState().location.trackSectionRanges.getFirst().getEndPosition());
        distance = longueur + tr.getLastState().location.trackSectionRanges.getFirst().getBeginPosition();
        assert distance > 0;
        return distance;
    }

}
