package fr.sncf.osrd.train.phases;


import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.utils.TrackSectionLocation;

import java.util.List;
import java.util.function.Consumer;

public interface Phase {
    PhaseState getState(Simulation sim, TrainSchedule schedule);

    TrackSectionLocation getEndLocation();
}
