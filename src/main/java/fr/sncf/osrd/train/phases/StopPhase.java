package fr.sncf.osrd.train.phases;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.utils.TrackSectionLocation;

import java.util.function.Consumer;

public class StopPhase extends PhaseState implements Phase {
    public final double duration;

    public StopPhase(double duration) {
        this.duration = duration;
    }

    @Override
    public PhaseState getState() {
        return this;
    }

    @Override
    public TrackSectionLocation getEndLocation() {
        return null;
    }

    @Override
    public void forEachPathSection(Consumer<TrackSectionRange> consumer) {

    }

    @Override
    public void simulate(Simulation sim, Train train, TrainState trainState) {
        sim.scheduleEvent(
                train,
                sim.getTime() + duration,
                new Train.TrainStateChange(sim, train.getID(), trainState.nextPhase())
        );
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
