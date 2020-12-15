package fr.sncf.osrd.simulation;

import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.train.TrainPhysicsSimulator;
import fr.sncf.osrd.train.TrainPhysicsSimulator.PositionUpdate;
import fr.sncf.osrd.train.TrainPositionTracker;

import java.util.ArrayList;

public class TrainLocationChange extends BaseChange {
    public final double newSpeed;
    public final TrainPositionTracker newLocation;
    public final ArrayList<PositionUpdate> positionUpdates;

    /**
     * Creates an event corresponding to the movement of a train
     * @param newSpeed the new speed of the train
     * @param positionUpdates the speed / position curve
     * @param newLocation the new location of the train
     */
    public TrainLocationChange(
            double newSpeed,
            ArrayList<PositionUpdate> positionUpdates,
            TrainPositionTracker newLocation
    ) {
        this.newLocation = newLocation;
        this.positionUpdates = positionUpdates;
        this.newSpeed = newSpeed;
    }
}
