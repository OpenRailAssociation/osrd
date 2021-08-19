package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public class TrainStop {

    public final double position;

    public final double stopDuration;

    public TrainStop(double position, double stopDuration) {
        this.position = position;
        this.stopDuration = stopDuration;
    }
}
