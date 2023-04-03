package fr.sncf.osrd.envelope_sim;

import com.google.common.collect.RangeMap;
import fr.sncf.osrd.envelope_utils.CurveUtils;
import fr.sncf.osrd.envelope_utils.Point2d;

public class EnvelopeSimContext {
    public final PhysicsRollingStock rollingStock;
    public final PhysicsPath path;
    public final double timeStep;
    public final RangeMap<Double, Point2d[]> tractiveEffortCurveMap;

    /** Creates a context suitable to run simulations on envelopes */
    public EnvelopeSimContext(
            PhysicsRollingStock rollingStock,
            PhysicsPath path,
            double timeStep,
            RangeMap<Double, Point2d[]> tractiveEffortCurveMap
    ) {
        this.rollingStock = rollingStock;
        this.path = path;
        this.timeStep = timeStep;
        this.tractiveEffortCurveMap = tractiveEffortCurveMap;
    }
}
