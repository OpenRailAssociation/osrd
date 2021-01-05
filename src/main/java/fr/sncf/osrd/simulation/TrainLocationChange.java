package fr.sncf.osrd.simulation;

import fr.sncf.osrd.simulation.utils.BaseChange;
import fr.sncf.osrd.train.TrainPhysicsSimulator.PositionUpdate;
import fr.sncf.osrd.train.TrainState;

import java.util.ArrayList;

public class TrainLocationChange extends BaseChange {
    public final TrainState newState;
    public final ArrayList<PositionUpdate> positionUpdates;

    /**
     * Creates an event corresponding to the movement of a train
     * @param newState the state of the train after the change
     * @param positionUpdates the speed / position curve
     */
    public TrainLocationChange(
            TrainState newState,
            ArrayList<PositionUpdate> positionUpdates
    ) {
        this.newState = newState;
        this.positionUpdates = positionUpdates;
    }
}
