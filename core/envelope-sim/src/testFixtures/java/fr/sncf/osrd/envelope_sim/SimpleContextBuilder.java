package fr.sncf.osrd.envelope_sim;

public class SimpleContextBuilder {
    public static final double TIME_STEP = 4;

    /** Creates a simple envelope sim context from a length, constant slope, and time step */
    public static EnvelopeSimContext makeSimpleContext(double length, double slope, double timeStep) {
        var testRollingStock = SimpleRollingStock.STANDARD_TRAIN;
        var testPath = new FlatPath(length, slope);
        return new EnvelopeSimContext(testRollingStock, testPath, timeStep, SimpleRollingStock.LINEAR_EFFORT_CURVE_MAP);
    }

    /** Creates a simple envelope sim context from a length and a constant slope */
    public static EnvelopeSimContext makeSimpleContext(double length, double slope) {
        return makeSimpleContext(length, slope, TIME_STEP);
    }
}
