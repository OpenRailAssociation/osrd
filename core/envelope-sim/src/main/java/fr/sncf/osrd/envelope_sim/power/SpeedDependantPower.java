package fr.sncf.osrd.envelope_sim.power;

import fr.sncf.osrd.envelope_utils.Point2d;

import static fr.sncf.osrd.envelope_utils.CurveUtils.generateCurve;
import static fr.sncf.osrd.envelope_utils.CurveUtils.interpolate;

public class SpeedDependantPower {
    Point2d[] curve;

    public SpeedDependantPower(double[] speeds, double[] powers) {
        this.curve = generateCurve(speeds, powers);
    }

    public static SpeedDependantPower constantPower(double power){
        return new SpeedDependantPower(new double[]{0.}, new double[]{power});
    };

    /** Return Power Coefficient at a given speed*/
    double get(double speed){
        return interpolate(speed, this.curve);
    }
}
