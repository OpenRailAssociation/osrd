package fr.sncf.osrd.envelope;

import java.util.Comparator;

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

    public static class EnvelopePointComparator implements Comparator<EnvelopePoint> {
        @Override public int compare(EnvelopePoint point1, EnvelopePoint point2) {
            if (point1.position == point2.position)
                return Double.compare(point1.speed, point2.speed);
            return Double.compare(point1.position, point2.position);
        }
    }
}
