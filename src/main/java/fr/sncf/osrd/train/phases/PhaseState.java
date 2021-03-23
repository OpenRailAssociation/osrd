package fr.sncf.osrd.train.phases;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.utils.DeepComparable;

public abstract class PhaseState implements DeepComparable<PhaseState> {
    public abstract void simulate(Simulation sim, Train train, TrainState trainState) throws SimulationError;
}
