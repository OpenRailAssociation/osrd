package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.Train;

/**
 * A stop block prevents trains from going past the end of a track.
 * https://en.wikipedia.org/wiki/Buffer_stop
 */
public class BufferStop extends Waypoint {

    public BufferStop(int index, String id) {
        super(index, id);
    }

    @Override
    public void onTrainArrival(Simulation sim, Train train) {
        // TODO
    }

    @Override
    public void onTrainDeparture(Simulation sim, Train train) {
        // TODO
    }
}
