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
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.SwitchPosition;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.train.TrackSectionRange;


import java.util.*;

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
     * Calculates the position of the next swchitch in movement or not reserved
     * 
     * @return Position of the next switch
     */
    private double getNextClosedSwitchPathPosition() {
        
        var fullPath = trainSchedule.plannedPath.trackSectionPath;

        double maLength = 0;
        for (int i = 0; i < fullPath.size(); i++) {
            var range = fullPath.get(i);
            var nodeIndex = range.edge.getEndNode(range.direction);
            var node = sim.infra.trackGraph.getNode(nodeIndex);
            if (node.getClass() == Switch.class && maLength>this.location.getPathPosition()) {
                var switchRef = (Switch) node;
                if (!sim.infraState.towerState.isCurrentAllowed(switchRef.id, trainSchedule.trainID))
                    break;
                if (sim.infraState.getSwitchState(switchRef.switchIndex).getPosition() == SwitchPosition.MOVING)
                    break;
            }
            maLength += range.edge.length;
        }
        return maLength;
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
