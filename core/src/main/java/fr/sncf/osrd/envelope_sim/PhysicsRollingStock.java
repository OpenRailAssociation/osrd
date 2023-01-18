package fr.sncf.osrd.envelope_sim;

import com.google.common.collect.RangeMap;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.train.RollingStock.Comfort;

import java.util.Arrays;
import java.util.Comparator;

public interface PhysicsRollingStock {
    /** The mass of the train, in kilograms */
    double getMass();

    /** The inertia of the train, in newtons (usually computed from mass * inertiaCoefficient) */
    double getInertia();

    /** The length of the train, in meters */
    double getLength();

    /** The maximum speed the train can reach, in m/s */
    double getMaxSpeed();

    /** The type of gamma input of the train */
    RJSRollingStock.GammaType getGammaType();

    /** The resistance to movement at a given speed, in newtons */
    double getRollingResistance(double speed);

    /** The first derivative of the resistance to movement at a given speed, in kg/s */
    double getRollingResistanceDeriv(double speed);

    /** The second derivative of the resistance to movement at a given speed, in kg/m */
    double getRollingResistanceSecDeriv(double speed);

    /** The effort curves to use depending on the position on the path */
    RangeMap<Double, TractiveEffortPoint[]> mapTractiveEffortCurves(PhysicsPath path, Comfort comfort);

    /** Get the effort the train can apply at a given speed, in newtons */
    static double getMaxEffort(double speed, TractiveEffortPoint[] tractiveEffortCurve) {
        //sort tractiveEffortCurve by speed
        Arrays.sort(tractiveEffortCurve, Comparator.comparing(tractiveEffortPoint -> speed));
        double[] tractiveEffortCurveSpeeds =
                Arrays.stream(tractiveEffortCurve).mapToDouble(tractiveEffortPoint -> speed).toArray();
        //array of speeds sorted
        Arrays.sort(tractiveEffortCurveSpeeds);
        int index = Arrays.binarySearch(tractiveEffortCurveSpeeds, Math.abs(speed));
        if(index < 0) {
            index =  -index - 1;
        }
        if(index == tractiveEffortCurveSpeeds.length) {
            return tractiveEffortCurve[index - 1].maxEffort;
        }
        if(index == 0) {
            return Math.abs(speed) * tractiveEffortCurve[0].maxEffort / tractiveEffortCurve[0].speed;
        }
        TractiveEffortPoint previousPoint = tractiveEffortCurve[index - 1];
        TractiveEffortPoint nextPoint = tractiveEffortCurve[index];
        double coeff = (previousPoint.maxEffort - nextPoint.maxEffort) / (previousPoint.speed - nextPoint.speed);
        return previousPoint.maxEffort + coeff * (Math.abs(speed) - previousPoint.speed);
    }

    /** The maximum constant deceleration, in m/s^2 */
    double getDeceleration();

    /** The maximum braking force which can be applied at a given speed, in newtons */
    double getMaxBrakingForce(double speed);

    /** The maximum acceleration, in m/s^2, which can be applied at a given speed, in m/s */
    record TractiveEffortPoint(double speed, double maxEffort) {
    }
}
