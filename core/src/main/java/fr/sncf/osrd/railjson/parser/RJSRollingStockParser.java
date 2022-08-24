package fr.sncf.osrd.railjson.parser;

import static java.lang.Double.isNaN;

import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStockField;
import fr.sncf.osrd.railjson.parser.exceptions.MissingRollingStockField;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.train.RollingStock;


public class RJSRollingStockParser {
    /** Parse the RailJSON  rolling stock into something the backend can work with */
    public static RollingStock parse(RJSRollingStock rjsRollingStock) throws InvalidRollingStock {
        if (!rjsRollingStock.version.equals(RJSRollingStock.CURRENT_VERSION)) {
            throw new InvalidRollingStock(
                    String.format("Invalid rolling stock format version: got '%s' expected '%s'",
                            rjsRollingStock.version, RJSRollingStock.CURRENT_VERSION));
        }

        // parse tractive effort curve
        final var tractiveEffortCurve = parseEffortCurve(rjsRollingStock.effortCurve);

        if (rjsRollingStock.name == null)
            throw new MissingRollingStockField("name");

        if (isNaN(rjsRollingStock.length))
            throw new MissingRollingStockField("length");

        if (isNaN(rjsRollingStock.maxSpeed))
            throw new MissingRollingStockField("max_speed");

        if (isNaN(rjsRollingStock.startUpTime))
            throw new MissingRollingStockField("startup_time");

        if (isNaN(rjsRollingStock.startUpAcceleration))
            throw new MissingRollingStockField("startup_acceleration");

        if (isNaN(rjsRollingStock.comfortAcceleration))
            throw new MissingRollingStockField("comfort_acceleration");

        if (isNaN(rjsRollingStock.timetableGamma))
            throw new MissingRollingStockField("timetable_gamma");

        if (isNaN(rjsRollingStock.maxBrakingForce))
            throw new MissingRollingStockField("max_braking_force");

        if (isNaN(rjsRollingStock.inertiaCoefficient))
            throw new MissingRollingStockField("inertia_coefficient");

        if (rjsRollingStock.powerClass < 0)
            throw new MissingRollingStockField("power_class");

        if (rjsRollingStock.features == null)
            throw new MissingRollingStockField("features");

        if (isNaN(rjsRollingStock.mass))
            throw new MissingRollingStockField("mass");

        if (rjsRollingStock.loadingGauge == null)
            throw new MissingRollingStockField("loading_gauge");

        if (isNaN(rjsRollingStock.mass))
            throw new MissingRollingStockField("mass");

        var rollingResistance = parseRollingResistance(rjsRollingStock.rollingResistance);

        return new RollingStock(
                rjsRollingStock.getID(),
                rjsRollingStock.length,
                rjsRollingStock.mass,
                rjsRollingStock.inertiaCoefficient,
                rollingResistance.A,
                rollingResistance.B,
                rollingResistance.C,
                rjsRollingStock.maxSpeed,
                rjsRollingStock.startUpTime,
                rjsRollingStock.startUpAcceleration,
                rjsRollingStock.comfortAcceleration,
                rjsRollingStock.timetableGamma,
                rjsRollingStock.maxBrakingForce,
                tractiveEffortCurve,
                rjsRollingStock.loadingGauge
        );
    }

    private static RJSRollingResistance.Davis parseRollingResistance(
            RJSRollingResistance rjsRollingResistance
    ) throws InvalidRollingStock {
        if (rjsRollingResistance == null)
            throw new MissingRollingStockField("rolling_resistance");
        if (rjsRollingResistance.getClass() != RJSRollingResistance.Davis.class)
            throw new InvalidRollingStockField("rolling_resistance", "unsupported rolling resistance type");
        return (RJSRollingResistance.Davis) rjsRollingResistance;
    }

    // these are commented as they'll be used soon for profiles

    private static RollingStock.TractiveEffortPoint[] parseEffortCurve(
            RJSRollingStock.RJSEffortCurve rjsEffortCurve
    ) throws InvalidRollingStockField {
        if (rjsEffortCurve.speeds == null)
            throw new MissingRollingStockField("effort_curve.speeds");
        if (rjsEffortCurve.maxEfforts == null)
            throw new MissingRollingStockField("effort_curve.max_efforts");
        if (rjsEffortCurve.speeds.length != rjsEffortCurve.maxEfforts.length)
            throw new InvalidRollingStock(
                    "Invalid rolling stock effort curve, speeds and max_efforts should be same length");

        var tractiveEffortCurve  = new RollingStock.TractiveEffortPoint[rjsEffortCurve.speeds.length];
        for (int i = 0; i < rjsEffortCurve.speeds.length; i++) {
            var speed = rjsEffortCurve.speeds[i];
            if (speed < 0)
                throw new InvalidRollingStockField("effort_curve", "negative speed");
            var maxEffort = rjsEffortCurve.maxEfforts[i];
            if (maxEffort < 0)
                throw new InvalidRollingStockField("effort_curve", "negative max effort");
            tractiveEffortCurve[i] = new RollingStock.TractiveEffortPoint(speed, maxEffort);
            assert i == 0 || tractiveEffortCurve[i - 1].speed < speed;
        }
        return tractiveEffortCurve;
    }
}
