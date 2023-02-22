package fr.sncf.osrd.envelope_sim;

public class SimpleContextBuilder {
    public static final double TIME_STEP = 4;

    public static EnvelopeSimContext makeSimpleContext(double length, double slope, double timeStep) {
        var testRollingStock = SimpleRollingStock.STANDARD_TRAIN;
        var testPath = new FlatPath(length, slope);
        return new EnvelopeSimContext(testRollingStock, testPath, timeStep, SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP);
    }

    public static EnvelopeSimContext makeSimpleContext(double length, double slope) {
        return makeSimpleContext(length, slope, TIME_STEP);
    }
}
