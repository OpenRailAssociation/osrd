package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.RollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStockField;
import fr.sncf.osrd.railjson.parser.exceptions.MissingRollingStockField;
import fr.sncf.osrd.railjson.schema.rollingstock.*;
import fr.sncf.osrd.train.TrainFeature;

import java.util.*;


public class RJSRollingStockParser {
    static RollingStock parse(RJSRollingStock rjsRollingStock) throws InvalidRollingStock {
        // parse tractive effort curves
        Map<String, RollingStock.TractiveEffortPoint[]> tractiveEffortCurves = new HashMap<>();
        for (var curve : rjsRollingStock.effortCurves.entrySet()) {
            var curveName = curve.getKey();
            var rjsCurvePoints = curve.getValue();
            var curvePoints = new RollingStock.TractiveEffortPoint[rjsCurvePoints.length];
            for (int i = 0; i < rjsCurvePoints.length; i++)
                curvePoints[i] = parseTractiveEffortPoint(rjsCurvePoints[i]);
            tractiveEffortCurves.put(curveName, curvePoints);
        }

        if (rjsRollingStock.id == null)
            throw new MissingRollingStockField("id");

        if (rjsRollingStock.source == null)
            throw new MissingRollingStockField("source");

        if (rjsRollingStock.verboseName == null)
            throw new MissingRollingStockField("verbose_name");

        if (rjsRollingStock.type == null)
            throw new MissingRollingStockField("type");

        if (rjsRollingStock.subType == null)
            throw new MissingRollingStockField("sub_type");

        if (rjsRollingStock.series == null)
            throw new MissingRollingStockField("series");

        if (rjsRollingStock.subSeries == null)
            throw new MissingRollingStockField("sub_series");

        if (rjsRollingStock.variant == null)
            throw new MissingRollingStockField("variant");

        if (rjsRollingStock.unitsCount < 0)
            throw new MissingRollingStockField("units_count");

        if (Double.isNaN(rjsRollingStock.length))
            throw new MissingRollingStockField("length");

        if (Double.isNaN(rjsRollingStock.maxSpeed))
            throw new MissingRollingStockField("max_speed");

        if (Double.isNaN(rjsRollingStock.startUpTime))
            throw new MissingRollingStockField("startup_time");

        if (Double.isNaN(rjsRollingStock.startUpAcceleration))
            throw new MissingRollingStockField("startup_acceleration");

        if (Double.isNaN(rjsRollingStock.comfortAcceleration))
            throw new MissingRollingStockField("comfort_acceleration");

        if (Double.isNaN(rjsRollingStock.gamma))
            throw new MissingRollingStockField("gamma");

        if (rjsRollingStock.gammaType == null)
            throw new MissingRollingStockField("gamma_type");

        if (Double.isNaN(rjsRollingStock.inertiaCoefficient))
            throw new MissingRollingStockField("inertia_coefficient");

        if (rjsRollingStock.powerClass < 0)
            throw new MissingRollingStockField("power_class");

        if (rjsRollingStock.features == null)
            throw new MissingRollingStockField("features");

        if (rjsRollingStock.masses == null)
            throw new MissingRollingStockField("masses");

        var masses = parseMasses(rjsRollingStock);

        // TODO: handle modes
        var firstMode = rjsRollingStock.modes[0];

        // TODO: handle effort curve profiles
        var effortCurveProfile = rjsRollingStock.effortCurvesProfiles.get(firstMode.effortCurveProfile);
        var randomCurveId = effortCurveProfile[0].effortCurve;
        var curve = tractiveEffortCurves.get(randomCurveId);

        // TODO: handle rolling resistance profiles
        var resistanceProfile = rjsRollingStock.rollingResistanceProfiles.get(firstMode.rollingResistanceProfile);
        var rollingResistance = parseRollingResistance(resistanceProfile[0].rollingResistance);

        var features = new TrainFeature[rjsRollingStock.features.length];
        for (int i = 0; i < rjsRollingStock.features.length; i++)
            features[i] = parseFeature(rjsRollingStock.features[i]);

        // TODO properly handle load states
        Double mass = masses.get(LoadState.NORMAL_LOAD);
        if (mass == null)
            mass = masses.get(LoadState.EMPTY_LOAD);

        return new RollingStock(
            rjsRollingStock.id,
            rjsRollingStock.source,
            rjsRollingStock.verboseName,
            rjsRollingStock.length,
            mass,
            rjsRollingStock.inertiaCoefficient,
            rollingResistance.A,
            rollingResistance.B,
            rollingResistance.C,
            features,
            rjsRollingStock.maxSpeed,
            rjsRollingStock.startUpTime,
            rjsRollingStock.startUpAcceleration,
            rjsRollingStock.comfortAcceleration,
            rjsRollingStock.gamma,
            rjsRollingStock.gammaType,
            curve
        );
    }

    private static Map<LoadState, Double> parseMasses(
            RJSRollingStock rjsRollingStockFamily
    ) throws InvalidRollingStock {
        Map<LoadState, Double> masses = new HashMap<>();
        for (int i = 0; i < rjsRollingStockFamily.masses.length; i++) {
            var rjsTrainMass = rjsRollingStockFamily.masses[i];
            var loadState = parseLoad(rjsTrainMass.loadState);
            masses.put(loadState, rjsTrainMass.mass);
        }
        return masses;
    }

    private static RJSRollingResistance.Davis parseRollingResistance(
            RJSRollingResistance rjsRollingResistance
    ) throws InvalidRollingStock {
        if (rjsRollingResistance.getClass() != RJSRollingResistance.Davis.class)
            throw new InvalidRollingStockField("rolling_resistance", "unsupported rolling resistance type");
        return (RJSRollingResistance.Davis) rjsRollingResistance;
    }

    // these are commented as they'll be used soon for profiles

    private static LoadState parseLoad(RJSLoadState loadState) throws InvalidRollingStock {
        switch (loadState) {
            case NORMAL_LOAD:
                return LoadState.NORMAL_LOAD;
            case EXCEPTIONAL_LOAD:
                return LoadState.EXCEPTIONAL_LOAD;
            case EMPTY_LOAD:
                return LoadState.EMPTY_LOAD;
            default:
                throw new InvalidRollingStockField(
                        "load_state",
                        "unsupported train load_state: " + loadState.toString()
                );
        }
    }

    private static TrainFeature parseFeature(RJSTrainFeature feature) throws InvalidRollingStock {
        switch (feature) {
            case TVM300:
                return TrainFeature.TVM300;
            case TVM430:
                return TrainFeature.TVM430;
            case ETCS1:
                return TrainFeature.ETCS1;
            case ETCS2:
                return TrainFeature.ETCS2;
            case KVB:
                return TrainFeature.KVB;
            default:
                throw new InvalidRollingStockField(
                        "features",
                        "unsupported train feature: " + feature.toString()
                );
        }
    }

    private static RollingStock.TractiveEffortPoint parseTractiveEffortPoint(
            float[] effortCurvePoint
    ) throws InvalidRollingStockField {
        if (effortCurvePoint.length != 2)
            throw new InvalidRollingStockField("effort_curves", "wrong tuple size");

        var speed = effortCurvePoint[0];
        var maxEffort = effortCurvePoint[1];

        if (Double.isNaN(speed))
            throw new InvalidRollingStockField("effort_curves", "missing speed");

        if (Double.isNaN(maxEffort))
            throw new InvalidRollingStockField("effort_curves", "missing max effort");

        if (speed < 0)
            throw new InvalidRollingStockField("effort_curves", "negative speed");

        if (maxEffort < 0)
            throw new InvalidRollingStockField("effort_curves", "negative max effort");

        return new RollingStock.TractiveEffortPoint(speed, maxEffort);
    }
}
