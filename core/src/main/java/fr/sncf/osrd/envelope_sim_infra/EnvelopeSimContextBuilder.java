package fr.sncf.osrd.envelope_sim_infra;

import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.train.RollingStock;

public class EnvelopeSimContextBuilder {
    /** Computes the rolling stock effort curves that will be used and creates a context */
    public static EnvelopeSimContext build(
            RollingStock rollingStock,
            EnvelopePath path,
            double timeStep,
            RollingStock.Comfort comfort,
            boolean ignoreElectricalProfiles
    ) {
        var powerClass = ignoreElectricalProfiles ? null : rollingStock.powerClass;
        var modeAndProfileMap = path.getModeAndProfileMap(powerClass);
        var curvesAndConditions = rollingStock.mapTractiveEffortCurves(modeAndProfileMap, comfort, path.getLength());
        return new EnvelopeSimContext(rollingStock, path, timeStep, curvesAndConditions.curves());
    }

    /** Computes the rolling stock effort curves that will be used and creates a context */
    public static EnvelopeSimContext build(
            RollingStock rollingStock,
            EnvelopePath path,
            double timeStep,
            RollingStock.Comfort comfort
    ) {
        return build(rollingStock, path, timeStep, comfort, false);
    }

}
