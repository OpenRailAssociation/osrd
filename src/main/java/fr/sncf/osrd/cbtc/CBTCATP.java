package fr.sncf.osrd.cbtc;

import java.util.ArrayList;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPositionTracker;
import fr.sncf.osrd.speedcontroller.CBTCSpeedController;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.train.TrackSectionRange;


import java.util.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Class dedicated to the calculation of speed constraints related to the CBTC.
 * Calculates the movement authorithy (MA) of the train and a list of
 * speedController related to these MA. This class is for the moment a
 * receptacle for a future implementation. TODO : Implement CBTCATP
 */
public class CBTCATP {
    // TODO : remove the warnings suppression
    @SuppressFBWarnings("URF_UNREAD_FIELD")
    private final Simulation sim;
    @SuppressFBWarnings("URF_UNREAD_FIELD")
    private final TrainSchedule trainSchedule;
    @SuppressFBWarnings("URF_UNREAD_FIELD")
    private final TrainState trainState;
    private TrainPositionTracker location;

    /**
     * Create a new ATP object
     * 
     * @param sim           the current simumation
     * @param trainSchedule the schedule of the train
     * @param trainState    the state of the train
     */
    public CBTCATP(Simulation sim, TrainSchedule trainSchedule, TrainState trainState) {
        this.trainSchedule = trainSchedule;
        this.trainState = trainState;
        this.sim = sim;
        this.location = trainState.location;
    }

    /**
     * Computes the list of speedControllers related to the CBTC.
     */
    public ArrayList<SpeedController> directive() {
        double gamma = this.trainSchedule.rollingStock.gamma;

        double nextDangerDistance = getNextDangerDistance();
        SpeedController controller = new CBTCSpeedController(0, location.getPathPosition() - 20,
                nextDangerDistance + location.getPathPosition(), gamma, trainState, trainSchedule);
        var list = new ArrayList<SpeedController>();
        list.add(controller);
        return list;
    }

    /**
     * Calculates the movement authorithy (MA) of the train
     * 
     * @return movement authorithy
     */
    public double getNextDangerDistance() {
        // Find next switch
        double nextSwitchPathPosition = getNextClosedSwitchPathPosition();
        double nextSwitchPathDistance = nextSwitchPathPosition - this.location.getPathPosition();

        // Find next train
        double nextTrainPathDistance = getDistanceNextTrain();

        // Find end of path
        double endOfPathPosition = 0;
        for (TrackSectionRange track : trainSchedule.plannedPath.trackSectionPath) {
            endOfPathPosition += track.length();
        }
        double endOfPathDistance = endOfPathPosition - this.location.getPathPosition();
        // return min of the three potential danger point

        double distance = Math.min(nextSwitchPathDistance, Math.min(nextTrainPathDistance, endOfPathDistance));
        assert (distance > 0.);
        return distance;
    }

    /**
     * Calculate the position of the next switch which is not reserved TODO : to
     * review
     * 
     * @return Position of the next switch
     */
    private double getNextClosedSwitchPathPosition() {
        // ArrayList<TrackSectionRange> fullPath = trainSchedule.plannedPath.trackSectionPath;
        // var curTrackSectionPos = location.trackSectionRanges.getFirst();

        // boolean seen = false;
        // double switchPosition = 0;
        // for (int i = 0; i < fullPath.size(); i++) {
        //     TrackSectionRange range = fullPath.get(i);
        //     switchPosition += range.length();
        //     if (!seen && range.edge.id == curTrackSectionPos.edge.id) {
        //         seen = true;
        //     }
        //     if (seen) {
        //         var nodeIndex = range.edge.getEndNode(range.direction);
        //         var node = sim.infra.trackGraph.getNode(nodeIndex);

        //         if (node.getClass() == Switch.class) {
        //             var switchState = sim.infraState.getSwitchState(((Switch) node).switchIndex);
        //             var nextTrackSection = (i < fullPath.size() - 1) ? fullPath.get(i + 1) : null;
        //             if (switchState.getPosition() == SwitchPosition.MOVING || nextTrackSection == null
        //                     || nextTrackSection.edge.id != switchState.getBranch().id
        //                             && range.edge.id != switchState.getBranch().id) {
        //                 logger.debug("CLOSED SWITCH POSITION : {} | {}", switchPosition - 50,
        //                         location.getPathPosition());
        //                 return switchPosition - 50; // TODO : change 50 for a meaningfull variable
        //             }
        //         }
        //     }
        // }
        return Double.POSITIVE_INFINITY;
    }

    /**
     * Calculate the distance to the next train
     * 
     * @return the distance to the next train
     */
    private double getDistanceNextTrain() {
        var tracksectionpath = this.trainSchedule.plannedPath.trackSectionPath;
        var currentTrackSection = this.trainState.location.trackSectionRanges.getFirst().edge;
        HashMap<String, ArrayList<Train>> listTrackSection = getTrainTracks();
        ArrayList<Train> listetrain = null;

        // get the indice of the current tracksection
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

        // Find the closest tracksection on which there are trains
        while (i < tracksectionpath.size() && (listetrain == null || listetrain.size() == 0)) {
            var track = tracksectionpath.get(i);
            listetrain = listTrackSection.get(track.edge.id);

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

        // find the closest train on the tracksection
        Train tr = listetrain.get(0);
        for (Train train : listetrain) {
            if (train.getLastState().location.trackSectionRanges.getLast()
                    .getBeginPosition() < tr.getLastState().location.trackSectionRanges.getLast().getBeginPosition()) {
                tr = train;
            }
        }
        double distance = longueur + tr.getLastState().location.trackSectionRanges.getLast().getBeginPosition();
        assert distance > 0;
        return distance;
    }

    /**
     * Calculate a HashMap with entry the name of the tracksections and in object
     * contains all the trains on this tracksection
     * 
     * @return A HashMap(name tracksection, list(trains on it))
     */
    private HashMap<String, ArrayList<Train>> getTrainTracks() {
        var trains = sim.trains;
        Iterator<Map.Entry<String, Train>> iterator = trains.entrySet().iterator();
        HashMap<String, ArrayList<Train>> listTrackSection = new HashMap<>();
        while (iterator.hasNext()) {
            Map.Entry<String, Train> mapentry = iterator.next();
            Train train = mapentry.getValue();
            if (!train.schedule.trainID.equals(this.trainSchedule.trainID)) {
                TrackSection tracksection = train.getLastState().location.trackSectionRanges.getLast().edge;
                String key = tracksection.id;
                if (listTrackSection.containsKey(key)) {
                    listTrackSection.get(key).add(train);
                } else {
                    ArrayList<Train> list = new ArrayList<>();
                    list.add(train);
                    listTrackSection.put(key, list);
                }
            }
        }
        return listTrackSection;
    }
}