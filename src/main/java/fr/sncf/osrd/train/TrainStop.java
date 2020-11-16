package fr.sncf.osrd.train;

public class TrainStop {
    final double position;
    final double stopDuration;

    public TrainStop(double position, double stopDuration) {
        this.position = position;
        this.stopDuration = stopDuration;
    }
}
