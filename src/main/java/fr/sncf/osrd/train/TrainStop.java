package fr.sncf.osrd.train;

public class TrainStop {

    public final double position;

    public final double stopDuration;

    public TrainStop(double position, double stopDuration) {
        this.position = position;
        this.stopDuration = stopDuration;
    }
}
