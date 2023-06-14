package fr.sncf.osrd.stdcm.graph;

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
        var elecCondMap = path.getElectrificationMap(null, null, null, true); // Only electrification modes for now
        var curvesAndConditions = rollingStock.mapTractiveEffortCurves(elecCondMap, comfort);
        return new EnvelopeSimContext(rollingStock, path, timeStep, curvesAndConditions.curves());
    }
}
