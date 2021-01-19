package fr.sncf.osrd.infra;

import fr.sncf.osrd.simulation.utils.Simulation;
import fr.sncf.osrd.train.TrainState;

public class SpeedAnnounceSignal extends StaticSignal {
    public final SpeedExecutionSignal executionSignal;
    public final double distanceToExecution;

    public SpeedAnnounceSignal(SpeedExecutionSignal executionSignal, double distanceToExecution) {
        this.executionSignal = executionSignal;
        this.distanceToExecution = distanceToExecution;
    }

    @Override
    public void onSight(Simulation sim, TrainState trainState, double trainSignalDistance) {
        trainState.onLimitAnnounce(trainSignalDistance, trainSignalDistance + distanceToExecution, executionSignal.speedSection.speedLimit);
    }
}
