package fr.sncf.osrd.train.lifestages;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainState;

import java.util.function.Consumer;

public class StopStage extends LifeStageState implements LifeStage {
    public final double duration;

    public StopStage(double duration) {
        this.duration = duration;
    }

    @Override
    public LifeStageState getState() {
        return this;
    }

    @Override
    public void forEachPathSection(Consumer<TrackSectionRange> consumer) {

    }

    @Override
    public void simulate(Simulation sim, Train train, TrainState trainState) {
        sim.scheduleEvent(
                train,
                sim.getTime() + duration,
                new Train.TrainStateChange(sim, train.getID(), trainState.nextStage())
        );
    }
}
