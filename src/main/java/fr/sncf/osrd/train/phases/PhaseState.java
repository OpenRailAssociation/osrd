package fr.sncf.osrd.train.phases;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.utils.DeepComparable;

public abstract class PhaseState implements DeepComparable<PhaseState>, Cloneable {
    public abstract TimelineEvent simulate(Simulation sim, Train train, TrainState trainState) throws SimulationError;

    @Override
    public abstract PhaseState clone();
}
