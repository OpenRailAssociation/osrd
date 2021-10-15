package fr.sncf.osrd.infra_state.regulator;

import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.simulation.EntityChange;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import java.util.ArrayDeque;

/**
 * The mutable succesion table for a switch (order of trains on that switch)
 * There must be a SuccesionTable instance per switch on the network.
 */

public class TrainSuccessionTable {
    /** the switch identifier whose it is the succession table */
    public final String switchID;

    /** the table itself, an ordered list of trains identifier */
    private ArrayDeque<String> trainOrder;

    /** Creates a new succession table */
    public TrainSuccessionTable(String s, ArrayDeque<String> trainOrder) {
        this.switchID = s;
        this.trainOrder = trainOrder;
    }

    public TrainSuccessionTable(String s) {
        this.switchID = s;
        this.trainOrder = new ArrayDeque<>();
    }

    public boolean containsTrain(String trainID) {
        return trainOrder.contains(trainID);
    }

    public String peekTrain() {
        return trainOrder.peekFirst();
    }

    public String popTrain() {
        return trainOrder.pop();
    }

    public boolean isEmpty() {
        return trainOrder.isEmpty();
    }

    /** Change the train order */
    public void changeTrainOrder(Simulation sim, ArrayDeque<String> newTrainOrder) throws SimulationError {
        // Check newTrainOrder validity
        var trainLog = sim.infraState.towerState.trainSuccessionLog.get(switchID);
        for (var newTrain : newTrainOrder) {
            if (trainLog.contains(newTrain))
                throw new SimulationError(String.format(
                        "Can't change TST: Train '%s' was already approved by the tower state", newTrain));
        }

        // Change train order
        var change = new TrainSuccessionTableChange(sim, switchID, newTrainOrder);
        change.apply(sim, this);
        sim.publishChange(change);
        // Notify TowerState of the modification
        sim.infraState.towerState.notifyTSTChanged(sim, switchID);
    }

    public static final class TrainSuccessionTableChange extends EntityChange<TrainSuccessionTable, Void> {
        private final String switchID;
        private final ArrayDeque<String> newTrainList;

        public TrainSuccessionTableChange(Simulation sim, String switchID, ArrayDeque<String> newTrainList) {
            super(sim);
            this.switchID = switchID;
            this.newTrainList = newTrainList;
        }

        @Override
        public Void apply(Simulation sim, TrainSuccessionTable entity) {
            entity.trainOrder = newTrainList;
            return null;
        }

        @Override
        public TrainSuccessionTable getEntity(Simulation sim) {
            return sim.infraState.towerState.getTrainSuccessionTable(switchID);
        }

        @Override
        public String toString() {
            return String.format(
                    "SuccessionTableChange { the succession table of the switch %s changes }", switchID);
        }
    }
}
