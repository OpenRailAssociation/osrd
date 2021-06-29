package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStockField;
import fr.sncf.osrd.railjson.parser.exceptions.MissingRollingStockField;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSTrainCapability;
import fr.sncf.osrd.train.TrainCapability;

public class RJSRollingStockParser {
    /** Parses a RailJSON rolling stock */
    public static RollingStock parse(RJSRollingStock rjsRollingStock) throws InvalidRollingStock {
        if (rjsRollingStock.id == null)
            throw new MissingRollingStockField("id");

        if (Double.isNaN(rjsRollingStock.length))
            throw new MissingRollingStockField("length");

        if (Double.isNaN(rjsRollingStock.mass))
            throw new MissingRollingStockField("mass");

        if (Double.isNaN(rjsRollingStock.inertiaCoefficient))
            throw new MissingRollingStockField("inertia_coefficient");

        if (rjsRollingStock.rollingResistance == null)
            throw new MissingRollingStockField("rolling_resistance");

        if (rjsRollingStock.capabilities == null)
            throw new MissingRollingStockField("capabilities");

        if (Double.isNaN(rjsRollingStock.maxSpeed))
            throw new MissingRollingStockField("max_speed");

        if (Double.isNaN(rjsRollingStock.startUpTime))
            throw new MissingRollingStockField("startup_time");

        if (Double.isNaN(rjsRollingStock.startUpAcceleration))
            throw new MissingRollingStockField("startup_acceleration");

        if (Double.isNaN(rjsRollingStock.comfortAcceleration))
            throw new MissingRollingStockField("comfort_acceleration");

        if (Double.isNaN(rjsRollingStock.timetableGamma))
            throw new MissingRollingStockField("timetable_gamma");

        if (rjsRollingStock.tractiveEffortCurve == null)
            throw new MissingRollingStockField("tractive_effort_curve");

        if (rjsRollingStock.rollingResistance.getClass() != RJSRollingResistance.Davis.class)
            throw new InvalidRollingStockField("rolling_resistance", "unsupported rolling resistance type");
        var rollingResistance = (RJSRollingResistance.Davis) rjsRollingStock.rollingResistance;

        var capabilities = new TrainCapability[rjsRollingStock.capabilities.length];
        for (int i = 0; i < rjsRollingStock.capabilities.length; i++)
            capabilities[i] = parseCapability(rjsRollingStock.capabilities[i]);

        var tractiveEffortCurve = new RollingStock.TractiveEffortPoint[rjsRollingStock.tractiveEffortCurve.length];
        for (int i = 0; i < rjsRollingStock.tractiveEffortCurve.length; i++)
            tractiveEffortCurve[i] = parseTractiveEffortPoint(rjsRollingStock.tractiveEffortCurve[i]);

        return new RollingStock(
                rjsRollingStock.id,
                rjsRollingStock.length,
                rjsRollingStock.mass,
                rjsRollingStock.inertiaCoefficient,
                rollingResistance.A,
                rollingResistance.B,
                rollingResistance.C,
                capabilities,
                rjsRollingStock.maxSpeed,
                rjsRollingStock.startUpTime,
                rjsRollingStock.startUpAcceleration,
                rjsRollingStock.comfortAcceleration,
                rjsRollingStock.timetableGamma,
                tractiveEffortCurve
        );
    }

    private static TrainCapability parseCapability(RJSTrainCapability capability) throws InvalidRollingStock {
        switch (capability) {
            case TVM300:
                return TrainCapability.TVM300;
            case TVM430:
                return TrainCapability.TVM430;
            case ETCS1:
                return TrainCapability.ETCS1;
            case ETCS2:
                return TrainCapability.ETCS2;
            case KVB:
                return TrainCapability.KVB;
            default:
                throw new InvalidRollingStockField(
                        "capabilities",
                        "unsupported train capability: " + capability.toString()
                );
        }
    }

    private static RollingStock.TractiveEffortPoint parseTractiveEffortPoint(
            RJSRollingStock.RJSTractiveEffortPoint rjsTractiveEffortPoint
    ) throws InvalidRollingStockField {
        var speed = rjsTractiveEffortPoint.speed;
        var maxEffort = rjsTractiveEffortPoint.maxEffort;

        if (Double.isNaN(speed))
            throw new InvalidRollingStockField("tractive_effort_curve", "missing speed");

        if (Double.isNaN(maxEffort))
            throw new InvalidRollingStockField("tractive_effort_curve", "missing max effort");

        if (speed < 0)
            throw new InvalidRollingStockField("tractive_effort_curve", "negative speed");

        if (maxEffort < 0)
            throw new InvalidRollingStockField("tractive_effort_curve", "negative max effort");

        return new RollingStock.TractiveEffortPoint(speed, maxEffort);
    }
}
