package fr.sncf.osrd.infra;

import fr.sncf.osrd.simulation.utils.Simulation;
import fr.sncf.osrd.train.TrainState;

public class SpeedExecutionSignal extends StaticSignal {
    public final SpeedSection speedSection;

    public SpeedExecutionSignal(SpeedSection speedSection) {
        this.speedSection = speedSection;
    }

    @Override
    public void onSight(Simulation sim, TrainState trainState, double trainSignalDistance) {
    }
}
