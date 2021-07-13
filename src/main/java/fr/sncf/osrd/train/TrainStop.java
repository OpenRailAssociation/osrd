package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public class TrainStop {

    public final double position;

    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"}) // This will be used with proper stops implementation
    public final double stopDuration;

    public TrainStop(double position, double stopDuration) {
        this.position = position;
        this.stopDuration = stopDuration;
    }
}
