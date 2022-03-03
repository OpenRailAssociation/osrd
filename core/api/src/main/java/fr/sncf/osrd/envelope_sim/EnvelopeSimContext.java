package fr.sncf.osrd.envelope_sim;

public class EnvelopeSimContext {
    public final PhysicsRollingStock rollingStock;
    public final PhysicsPath path;
    public final double timeStep;

    /** Creates a context suitable to run simulations on envelopes */
    public EnvelopeSimContext(PhysicsRollingStock rollingStock, PhysicsPath path, double timeStep) {
        this.rollingStock = rollingStock;
        this.path = path;
        this.timeStep = timeStep;
    }
}
