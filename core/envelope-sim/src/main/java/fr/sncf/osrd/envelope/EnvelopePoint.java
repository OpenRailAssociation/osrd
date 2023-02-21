package fr.sncf.osrd.envelope;

public final class EnvelopePoint {
    public double position;
    public double speed;

    public EnvelopePoint(double position, double speed) {
        this.position = position;
        this.speed = speed;
    }

    public EnvelopePoint() {
        this.position = Double.NaN;
        this.speed = Double.NaN;
    }
}
