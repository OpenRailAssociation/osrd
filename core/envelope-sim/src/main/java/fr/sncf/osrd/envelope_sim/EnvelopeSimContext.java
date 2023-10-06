package fr.sncf.osrd.envelope_sim;

import com.google.common.collect.RangeMap;

public class EnvelopeSimContext {
    public final PhysicsRollingStock rollingStock;
    public final PhysicsPath path;
    public final double timeStep;
    public final RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> tractiveEffortCurveMap;

    /** Creates a context suitable to run simulations on envelopes */
    public EnvelopeSimContext(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double timeStep,
            RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> tractiveEffortCurveMap
    ) {
        this.rollingStock = rollingStock;
        this.path = path;
        this.timeStep = timeStep;
        assert tractiveEffortCurveMap != null;
        this.tractiveEffortCurveMap = tractiveEffortCurveMap;
    }

    public EnvelopeSimContext updateCurves(
            RangeMap<Double, PhysicsRollingStock.TractiveEffortPoint[]> tractiveEffortCurveMap) {
        return new EnvelopeSimContext(rollingStock, path, timeStep, tractiveEffortCurveMap);
    }
}
