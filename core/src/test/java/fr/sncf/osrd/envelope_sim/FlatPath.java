package fr.sncf.osrd.envelope_sim;

public class FlatPath implements PhysicsPath {
    private final double length;
    private final double slope;

    public FlatPath(double length, double slope) {
        this.length = length;
        this.slope = slope;
    }

    @Override
    public double getLength() {
        return length;
    }

    @Override
    public double getAverageGrade(double begin, double end) {
        return slope;
    }
}
