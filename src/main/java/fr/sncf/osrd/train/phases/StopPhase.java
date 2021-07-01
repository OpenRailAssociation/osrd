package fr.sncf.osrd.train.phases;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.events.TrainRestarts;
import fr.sncf.osrd.utils.TrackSectionLocation;

import java.util.ArrayList;
import java.util.function.Consumer;

public class StopPhase extends PhaseState implements Phase {
    public final double duration;

    public StopPhase(double duration) {
        super(new ArrayList<>());
        this.duration = duration;
    }

    @Override
    public PhaseState getState(Simulation sim, TrainSchedule schedule) {
        return this;
    }

    @Override
    public TrackSectionLocation getEndLocation() {
        return null;
    }

    @Override
    public TimelineEvent simulate(Simulation sim, Train train, TrainState trainState) {
        var nextState = new Train.TrainStateChange(sim, train.getName(), trainState.nextPhase(sim));
        return TrainRestarts.plan(sim, sim.getTime() + duration, train, nextState);
    }

    @Override
    @SuppressFBWarnings({"CN_IDIOM_NO_SUPER_CALL"})
    public PhaseState clone() {
        return new StopPhase(duration);
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST", "FE_FLOATING_POINT_EQUALITY"})
    public boolean deepEquals(PhaseState other) {
        if (other.getClass() != StopPhase.class)
            return false;
        var o = (StopPhase) other;
        return o.duration == duration;
    }
}
