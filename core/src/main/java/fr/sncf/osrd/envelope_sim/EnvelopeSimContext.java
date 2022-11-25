package fr.sncf.osrd.envelope_sim;

import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.RollingStock.Comfort;

public class EnvelopeSimContext {
    public final PhysicsRollingStock rollingStock;
    public final PhysicsPath path;
    public final double timeStep;
    public final Comfort comfort;

    /** Creates a context suitable to run simulations on envelopes */
    public EnvelopeSimContext(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double timeStep,
            RollingStock.Comfort comfort
    ) {
        this.rollingStock = rollingStock;
        this.path = path;
        this.timeStep = timeStep;
        this.comfort = comfort;
    }
}
