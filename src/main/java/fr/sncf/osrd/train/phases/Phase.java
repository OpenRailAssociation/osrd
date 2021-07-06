package fr.sncf.osrd.train.phases;


import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.utils.TrackSectionLocation;

public interface Phase {
    PhaseState getState(Simulation sim, TrainSchedule schedule);

    TrackSectionLocation getEndLocation();
}
