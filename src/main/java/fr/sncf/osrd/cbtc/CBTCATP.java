package fr.sncf.osrd.cbtc;

import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.TrainPositionTracker;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.TrackSectionLocation;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.simulation.Simulation;

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

    private double getNextSwitchPathPosition() {
        /* For a temporary search, we will look at the next 
        TrackSection that have more than one Neighbors */
        var curTrackSectionPos = location.trackSectionRanges.getFirst();
        var neighbors = sim.infra.trackGraph.getEndNeighborRels(curTrackSectionPos.edge, curTrackSectionPos.direction);

        if (neighbors.isEmpty())
            return Double.POSITIVE_INFINITY;

        var next = neighbors.get(0);
        var nextTrackSection = next.getEdge(curTrackSectionPos.edge, curTrackSectionPos.direction);

        var nodeIndex = curTrackSectionPos.edge.getEndNode(curTrackSectionPos.direction);
        var node = sim.infra.trackGraph.getNode(nodeIndex);

        ArrayList<TrackSectionRange> fullPath = trainSchedule.fullPath;
        return Double.POSITIVE_INFINITY;

    }

    public double getNextDangerPointPathPostion() {
        // Find next switch
        double nextSwitchPathPosition = getNextSwitchPathPosition();

        // Find next train
        double nextTrainPathPosition = getDistanceNextTrain();
        logger.debug("next train position {}",nextTrainPathPosition);

        // Find end of path
        double endOfPathPosition = 0;
        for(TrackSectionRange track : trainSchedule.fullPath) {
            endOfPathPosition += track.length();
        }

        // return min of the three potential danger point
        return Math.min(nextSwitchPathPosition, Math.min(nextTrainPathPosition, endOfPathPosition));
    }

    public boolean canBreak(double distance) {
        double dpPathPosition = getNextDangerPointPathPostion();
        double trainPathPosition = location.getPathPosition();
        //logger.debug("{} - {} -> {}", dpPathPosition, trainPathPosition, dpPathPosition-trainPathPosition);
        //logger.debug("distance sans la marge = {}, vitesse du train : {}", distance, vitesse_finale() );
        //logger.debug("energie initiale : {}, energie dissipée : {}", initialEnergie(), lostBrakeEnergie(distance));
        //logger.debug("acceleration : {}, energie dissipée : {}", accel_erre(), lostBrakeEnergie());
        //logger.debug("{}",lostBrakeEnergie(distance)-initialEnergie()>0);
        if (lostBrakeEnergie(distance)-initialEnergie()>0){
            return true;
        }
        return false;
    }

    public double marginBehindNextDanger(
        double dt,
        double marge
        ){
        double vitesse = this.trainState.speed;
        return getNextDangerPointPathPostion()-location.getPathPosition()-(dt*vitesse + marge);
    }

    public double lostBrakeEnergie(double distance){
        // Attention la différence d'altitude n'est pas prise en compte!!//
        // Ne marche uniquement avec un gamma constant!!//
        //var distance = marginBehindNextDanger(1,100);
        double mass = this.trainSchedule.rollingStock.mass;
        double gamma = this.trainSchedule.rollingStock.timetableGamma;
        double energie = gamma*mass*distance;
        return energie;
    }

    public double initialEnergie(){
        double vitesse = this.vitesse_finale();
        double mass =  this.trainSchedule.rollingStock.mass;
        //logger.debug("Energie initiale {}", 1.0/2.0*mass*vitesse );
        return 1.0/2.0*mass*Math.pow(vitesse,2);//Penser à rajouter la hauteur du train;
    }

    private double inclinaison_max(){
        //recherche entre le train et le point la plus petite pente 
        return 0;
    }

    private double position_depart(){
        var speed = this.trainState.speed;
        var accel = this.accel_erre();
        double update_position = Math.pow(this.time_react,2)*(accel)/2+ this.time_react*speed;
        update_position += this.time_erre * this.vitesse_finale();
        return update_position;
    }

    private double accel_erre(){
        var i = this.inclinaison_max();
        double mass =  this.trainSchedule.rollingStock.mass;
        return Math.sin(i)*9.81*mass + this.trainSchedule.rollingStock.getMaxEffort(this.trainState.speed)/mass;
    }

    private double vitesse_finale(){
        return accel_erre()*this.time_react+this.trainState.speed;
    }

    public double CBTC(){
        if (canBreak(marginBehindNextDanger(1,100))) return 0; 
        if (canBreak(getNextDangerPointPathPostion()-location.getPathPosition()-50)) return 1;
        return 2;
    } 

    public LimitAnnounceSpeedController directive(){
        double mass = this.trainSchedule.rollingStock.mass;
        double gamma = this.trainSchedule.rollingStock.timetableGamma;
        if (canBreak(marginBehindNextDanger(1,100))) {
            return new LimitAnnounceSpeedController(this.trainSchedule.rollingStock.maxSpeed,getNextDangerPointPathPostion()-100,getNextDangerPointPathPostion(),gamma);
        }
        if (canBreak(getNextDangerPointPathPostion()-location.getPathPosition()-50) || true) {
            return new LimitAnnounceSpeedController(0,location.getPathPosition()-50,getNextDangerPointPathPostion()-90,gamma);
        }
        return new LimitAnnounceSpeedController(0,0,getNextDangerPointPathPostion(),gamma);
    }

    private static ArrayList<Train> getListNextTrain(TrackSectionRange tracksection, HashMap<Integer, ArrayList<Train>> ListTrackSectionRange){
        var cle = tracksection.hashCode();
        if (ListTrackSectionRange.containsKey(cle)){
            return ListTrackSectionRange.get(cle);
        }
        return null;
    }

    private HashMap<Integer,  ArrayList<Train>> getTrainTracks(){
        var trains = sim.trains;
        Iterator<Map.Entry<String,Train>> iterator = trains.entrySet().iterator();
        HashMap<Integer, ArrayList<Train>> ListTrackSectionRange=  new HashMap<>();
        while (iterator.hasNext()) {
            Map.Entry<String,Train> mapentry = iterator.next();
            Train train = mapentry.getValue();
            var trackSectionRanges = mapentry.getValue().getLastState().location.trackSectionRanges.clone();
            while (!trackSectionRanges.isEmpty()) {
                TrackSectionRange tracksectionrange = trackSectionRanges.pop();
                int cle = tracksectionrange.hashCode();
                if (ListTrackSectionRange.containsKey(cle)){
                    ListTrackSectionRange.get(cle).add(train);
                }else {
                    ArrayList<Train> list = new ArrayList<>();
                    list.add(train);
                    ListTrackSectionRange.put(cle, list);
                }
            }
        }
        return ListTrackSectionRange;
    }

    private double getDistanceNextTrain(){
        var distance = Double.POSITIVE_INFINITY;
        var tracksectionpath = this.trainState.location.trackSectionPath;
        HashMap<Integer, ArrayList<Train>> ListTrackSectionRange = getTrainTracks();
        ArrayList<Train> listetrain=null;
        TrackSectionRange tracksectionrange = null;
        for (TrackSectionRange tracksection : tracksectionpath){
            tracksectionrange = tracksection;
            listetrain = getListNextTrain(tracksection, ListTrackSectionRange);
            if (listetrain!= null){
                break;
            }
        }
        if (listetrain==null) return distance;
        assert tracksectionrange!=null;
        for (Train train : listetrain){
            var distance2 = distancetoPreviousTrackSection(train, tracksectionrange);
            if (distance2 < distance){
                distance = distance2;
            }
        }
        var DistanceTrack = getPositionTrack(this.trainSchedule, tracksectionrange);
        var trainPosition = this.trainState.location.getPathPosition();
        assert DistanceTrack-trainPosition+DistanceTrack>0;
        return DistanceTrack-trainPosition+DistanceTrack;
    }

    private double distancetoPreviousTrackSection(Train train, TrackSectionRange tracksection ){
        return distancetoPreviousTrackSection(train.getLastState(), tracksection, train.schedule);
    }

    private double distancetoPreviousTrackSection(TrainState trainstate, TrackSectionRange tracksection, TrainSchedule schedule){
        var PositionTrackSession = getPositionTrack(schedule, tracksection);
        assert trainstate.location.getPathPosition()-PositionTrackSession>0;
        return trainstate.location.getPathPosition()-PositionTrackSession;
    }

    private double getPositionTrack(TrainSchedule schedule, TrackSectionRange tracksection){

        Iterator<TrackSectionRange> i = schedule.fullPath.iterator();
        assert i.hasNext();
        TrackSectionRange t = i.next();
        double PositionTrackSession = 0;
        while (i.hasNext() && t!=tracksection) {
            PositionTrackSession += t.length();
            t = i.next();
        }
        return  PositionTrackSession;
    }


}
