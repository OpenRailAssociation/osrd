package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.interlocking.VisibleTrackObject;
import fr.sncf.osrd.simulation.utils.Simulation;
import fr.sncf.osrd.train.TrainState;

public class DynamicSignal implements VisibleTrackObject {
    @Override
    public double getSightDistance() {
        return 0;
    }

    @Override
    public void onSight(Simulation sim, TrainState trainState, double trainSignalDistance) {

    }
}
