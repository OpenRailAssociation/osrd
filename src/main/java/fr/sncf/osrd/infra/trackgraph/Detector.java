package fr.sncf.osrd.infra.trackgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.signaling.TrackSensor;
import fr.sncf.osrd.infra.railjson.schema.Identified;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.Train;

public class Detector implements TrackSensor, Identified {
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public final String id;

    public Detector(String id) {
        this.id = id;
    }

    @Override
    public void onTrainArrival(Simulation sim, Train train) {
        // TODO
    }

    @Override
    public void onTrainDeparture(Simulation sim, Train train) {
        // TODO
    }

    @Override
    public String getID() {
        return id;
    }
}
