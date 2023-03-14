package fr.sncf.osrd.envelope_sim_infra;

import fr.sncf.osrd.envelope_sim.EnvelopeSimPath;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.train.RollingStock;

public class EnvelopeSimContextBuilder {
    /** Computes the rolling stock effort curves that will be used and creates a context */
    public static EnvelopeSimContext build(
            RollingStock rollingStock,
            EnvelopeSimPath path,
            double timeStep,
            RollingStock.Comfort comfort
    ) {
        var modeAndProfileMap = path.getModeAndProfileMap(null); // Only modes
        var curvesAndConditions = rollingStock.mapTractiveEffortCurves(modeAndProfileMap, comfort, path.getLength());
        return new EnvelopeSimContext(rollingStock, path, timeStep, curvesAndConditions.curves());
    }

}
