package fr.sncf.osrd.envelope_sim;

import com.google.common.collect.RangeMap;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.RollingStock.Comfort;

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
        this.tractiveEffortCurveMap = tractiveEffortCurveMap;
    }

    /** Computes the rolling stock effort curves that will be used and creates a context */
    public static EnvelopeSimContext build(
            RollingStock rollingStock,
            PhysicsPath path,
            double timeStep,
            Comfort comfort,
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
            PhysicsPath path,
            double timeStep,
            Comfort comfort
    ) {
        return build(rollingStock, path, timeStep, comfort, false);
    }
}
