package fr.sncf.osrd.train.phases;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;

public abstract class PhaseState {
    public abstract void simulate(Simulation sim, Train train, TrainState trainState) throws SimulationError;
}
