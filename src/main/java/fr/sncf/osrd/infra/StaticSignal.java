package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.interlocking.VisibleTrackObject;
import fr.sncf.osrd.simulation.utils.Simulation;
import fr.sncf.osrd.train.TrainState;

public abstract class StaticSignal implements VisibleTrackObject {
    @Override
    public double getSightDistance() {
        return 30;
    }
}
