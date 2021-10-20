package fr.sncf.osrd.infra_state.regulator;

import fr.sncf.osrd.infra.TVDSection;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra_state.routes.RouteStatus;
import fr.sncf.osrd.simulation.EntityChange;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.infra.Infra;
import java.util.*;

public class TowerState {

    // trainSuccessionTables a map of switchIDs to trainSuccessionTable
    public final HashMap<String, TrainSuccessionTable> trainSuccessionTables;
    // waitingLists a map from switchIDs to waitingList
    private final HashMap<String, LinkedHashSet<Request>> waitingLists;
    // map from switchIDs to the trains passage history
    public final HashMap<String, ArrayList<String>> trainSuccessionLog;

    private TowerState(
            HashMap<String, TrainSuccessionTable> trainSuccessionTables,
            HashMap<String, LinkedHashSet<Request>> waitingLists,
            HashMap<String, ArrayList<String>> trainSuccessionLog
    ) {
        this.trainSuccessionTables = trainSuccessionTables;
        this.waitingLists = waitingLists;
        this.trainSuccessionLog = trainSuccessionLog;
    }

    /** Create a switch post with given trains successions tables */
    public static TowerState makeTowerState(Infra infra, List<TrainSuccessionTable> initTSTs) {
        
        var trainSuccessionTables = new HashMap<String, TrainSuccessionTable>();
        var waitingLists = new HashMap<String, LinkedHashSet<Request>>();
        var trainSuccessionLog = new HashMap<String, ArrayList<String>>();

        if (initTSTs != null) {
            for (var tst : initTSTs)
                trainSuccessionTables.put(tst.switchID, tst);
        }

        for (var s : infra.switches) {
            if (trainSuccessionTables.containsKey(s.id))
                continue;
            var newTST = new TrainSuccessionTable(s.id);
            trainSuccessionTables.put(s.id, newTST);
        }

        for (var s : infra.switches) {
            waitingLists.put(s.id, new LinkedHashSet<>());
            trainSuccessionLog.put(s.id, new ArrayList<>());
        }

        return new TowerState(trainSuccessionTables, waitingLists, trainSuccessionLog);
    }

    /** Check if a request can be approved. Verify that the route state is FREE and the train next in TSTs. */
    public boolean requestIsApprovable(Simulation sim, Request request) {
        // check if the route is free
        if (request.getRouteState(sim).status != RouteStatus.FREE)
            return false;

        // check if the train is next on each switch of the route
        for (var s : request.getRouteState(sim).route.switchesGroup.keySet()) {
            var trainID = request.trainID;
            var tst = trainSuccessionTables.get(s.id);
            if (tst.containsTrain(trainID) && !tst.peekTrain().equals(trainID))
                return false;
        }
        return true;
    }

    /** Request a route reservation and return whether it was approved */
    public boolean request(Simulation sim, Request request) throws SimulationError {
        if (request.getRouteState(sim).route.switchesGroup.isEmpty())
            throw new SimulationError("Can't request reservation cause the route does not contain any switch");
        if (requestIsApprovable(sim, request)) {
            approveRequest(sim, request);
            return true;
        }
        queueRequest(sim, request);
        return false;
    }

    private void queueRequest(Simulation sim, Request request) {
        var changeQueueRequest = new QueueRequestChange(sim, request);
        changeQueueRequest.apply(sim, this);
        sim.publishChange(changeQueueRequest);
    }

    private void approveRequest(Simulation sim, Request request) throws SimulationError {
        // change the towerState
        var changeApproveRequest = new ApproveRequestChange(sim, request);
        changeApproveRequest.apply(sim, this);
        sim.publishChange(changeApproveRequest);

        // reserve the root
        request.getRouteState(sim).reserve(sim);
    }

    /** Notify the towerState that a TVDSection is released and that he can try to process some waiting requests */
    public void notifyRouteFreed(Simulation sim, Route route) throws SimulationError {
        for (var switchRef : route.switchesGroup.keySet()) {
            if (checkWaitingList(sim, switchRef.id))
                return;
        }
    }

    /** Notify the towerState that a TST has changed and that he can try to process some waiting requests */
    public void notifyTSTChanged(Simulation sim, String switchID) throws SimulationError {
        checkWaitingList(sim, switchID);
    }

    /** Checks if a pending request can be approved and returns if it has been approved */
    private boolean checkWaitingList(Simulation sim, String switchID) throws SimulationError {
        var waitingList = waitingLists.get(switchID);
        for (var request : waitingList) {
            if (requestIsApprovable(sim, request)) {
                approveRequest(sim, request);
                return true;
            }
        }
        return false;
    }

    public TrainSuccessionTable getTrainSuccessionTable(String switchID) {
        return trainSuccessionTables.get(switchID);
    }

    public boolean isRequestPending(Simulation sim, Request request) {
        var switchID = request.getRouteState(sim).route.switchesGroup.keySet().iterator().next().id;
        return waitingLists.get(switchID).contains(request);
    }

    public boolean isRequestApproved(Simulation sim, Request request) {
        var switchID = request.getRouteState(sim).route.switchesGroup.keySet().iterator().next().id;
        return trainSuccessionLog.get(switchID).contains(request.trainID);
    }

    public static final class ApproveRequestChange extends EntityChange<TowerState, Void> {
        private final Request request;

        ApproveRequestChange(Simulation sim, Request request) {
            super(sim);
            this.request = request;
        }

        @Override
        public Void apply(Simulation sim, TowerState towerState) {
            var routeState = sim.infraState.getRouteState(request.routeIndex);

            // add to the log
            for (var s : routeState.route.switchesGroup.keySet())
                towerState.trainSuccessionLog.get(s.id).add(request.trainID);

            // delete the train from the waiting lists
            for (var s : routeState.route.switchesGroup.keySet())
                towerState.waitingLists.get(s.id).remove(request);

            // delete the train from the tst
            for (var s : routeState.route.switchesGroup.keySet()) {
                var tst = towerState.trainSuccessionTables.get(s.id);
                if (!tst.isEmpty() && tst.peekTrain().equals(request.trainID))
                    tst.popTrain();
            }
            return null;
        }

        @Override
        public TowerState getEntity(Simulation sim) {
            return sim.infraState.towerState;
        }

        @Override
        public String toString() {
            return String.format(
                    "SuccessionTableChange { the succession table of the switches part of route %d changes }",
                    request.routeIndex);
        }

    }

    public static final class QueueRequestChange extends EntityChange<TowerState, Void> {
        private final Request request;

        QueueRequestChange(Simulation sim, Request request) {
            super(sim);
            this.request = request;
        }

        @Override
        public Void apply(Simulation sim, TowerState towerState) {
            var routeState = sim.infraState.getRouteState(request.routeIndex);
            // add the train to the waiting lists
            for (var s : routeState.route.switchesGroup.keySet())
                towerState.waitingLists.get(s.id).add(request);
            return null;
        }

        @Override
        public TowerState getEntity(Simulation sim) {
            return sim.infraState.towerState;
        }

        @Override
        public String toString() {
            return String.format(
                    "SuccessionTableChange { the succession table of the switches part of route %d changes }",
                    request.routeIndex);
        }

    }
}
