package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.railjson.schema.rollingstock.RJSEffortCurves;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.train.RollingStock;
import java.util.Collection;
import java.util.HashMap;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class RJSRollingStockParser {
    static final Logger logger = LoggerFactory.getLogger(RJSRollingStockParser.class);

    /** Parse a collection of RailJSON rolling stock and gather them in a mapping by id */
    public static HashMap<String, RollingStock> parseCollection(Collection<RJSRollingStock> rjsRollingStocks) {
        var res = new HashMap<String, RollingStock>();
        for (var rjsRollingStock : rjsRollingStocks) {
            res.put(rjsRollingStock.getID(), RJSRollingStockParser.parse(rjsRollingStock));
        }
        return res;
    }

    /** Parse the RailJSON rolling stock into something the backend can work with */
    public static RollingStock parse(RJSRollingStock rjsRollingStock) throws OSRDError {
        // Check major version
        var inputMajor = rjsRollingStock.railjsonVersion.split("\\.")[0];
        var currentMajor = RJSRollingStock.CURRENT_VERSION.split("\\.")[0];
        if (!Objects.equals(inputMajor, currentMajor))
            throw OSRDError.newInvalidRollingStockError(
                    ErrorType.InvalidRollingStockMajorVersionMismatch,
                    RJSRollingStock.CURRENT_VERSION,
                    rjsRollingStock.railjsonVersion);
        else if (!rjsRollingStock.railjsonVersion.equals(RJSRollingStock.CURRENT_VERSION))
            logger.warn(
                    "Rolling stock version mismatch, expected {}, got {}",
                    RJSRollingStock.CURRENT_VERSION,
                    rjsRollingStock.railjsonVersion);

        // Parse effort_curves
        if (rjsRollingStock.effortCurves == null) throw OSRDError.newMissingRollingStockFieldError("effort_curves");
        final var rjsModes = rjsRollingStock.effortCurves.modes;

        if (rjsRollingStock.effortCurves.defaultMode == null)
            throw OSRDError.newMissingRollingStockFieldError("effort_curves.default_mode");

        if (rjsRollingStock.effortCurves.modes == null)
            throw OSRDError.newMissingRollingStockFieldError("effort_curves.modes");

        if (!rjsModes.containsKey(rjsRollingStock.effortCurves.defaultMode))
            throw OSRDError.newInvalidRollingStockError(
                    ErrorType.InvalidRollingStockDefaultModeNotFound, rjsRollingStock.effortCurves.defaultMode);

        // Parse tractive effort curves modes
        var modes = new HashMap<String, RollingStock.ModeEffortCurves>();
        for (var mode : rjsModes.entrySet()) {
            modes.put(mode.getKey(), parseModeEffortCurves(mode.getValue(), "effort_curves.modes." + mode.getKey()));
        }

        if (rjsRollingStock.name == null) throw OSRDError.newMissingRollingStockFieldError("name");

        if (Double.isNaN(rjsRollingStock.length)) throw OSRDError.newMissingRollingStockFieldError("length");

        if (Double.isNaN(rjsRollingStock.maxSpeed)) throw OSRDError.newMissingRollingStockFieldError("max_speed");

        if (Double.isNaN(rjsRollingStock.startUpTime)) throw OSRDError.newMissingRollingStockFieldError("startup_time");

        if (Double.isNaN(rjsRollingStock.startUpAcceleration))
            throw OSRDError.newMissingRollingStockFieldError("startup_acceleration");

        if (Double.isNaN(rjsRollingStock.comfortAcceleration))
            throw OSRDError.newMissingRollingStockFieldError("comfort_acceleration");

        if (rjsRollingStock.gamma == null) throw OSRDError.newMissingRollingStockFieldError("gamma");

        if (Double.isNaN(rjsRollingStock.inertiaCoefficient))
            throw OSRDError.newMissingRollingStockFieldError("inertia_coefficient");

        if (rjsRollingStock.loadingGauge == null) throw OSRDError.newMissingRollingStockFieldError("loading_gauge");

        if (Double.isNaN(rjsRollingStock.mass)) throw OSRDError.newMissingRollingStockFieldError("mass");

        var rollingResistance = parseRollingResistance(rjsRollingStock.rollingResistance);

        var gammaType =
                switch (rjsRollingStock.gamma.type) {
                    case MAX -> RollingStock.GammaType.MAX;
                    case CONST -> RollingStock.GammaType.CONST;
                };

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
                rjsRollingStock.gamma.value,
                gammaType,
                rjsRollingStock.loadingGauge,
                modes,
                rjsRollingStock.effortCurves.defaultMode,
                rjsRollingStock.basePowerClass,
                rjsRollingStock.powerRestrictions,
                rjsRollingStock.electricalPowerStartUpTime,
                rjsRollingStock.raisePantographTime,
                rjsRollingStock.supportedSignalingSystems);
    }

    public static RJSRollingResistance.Davis parseRollingResistance(RJSRollingResistance rjsRollingResistance)
            throws OSRDError {
        if (rjsRollingResistance == null) throw OSRDError.newMissingRollingStockFieldError("rolling_resistance");
        if (rjsRollingResistance.getClass() != RJSRollingResistance.Davis.class)
            throw OSRDError.newInvalidRollingStockFieldError(
                    "rolling_resistance", "unsupported rolling resistance type");
        return (RJSRollingResistance.Davis) rjsRollingResistance;
    }

    /** Parse an RJSEffortCurveConditions into a EffortCurveConditions */
    private static RollingStock.EffortCurveConditions parseEffortCurveConditions(
            RJSEffortCurves.RJSEffortCurveConditions rjsCond, String fieldKey) {
        if (rjsCond == null) throw OSRDError.newMissingRollingStockFieldError(fieldKey);
        return new RollingStock.EffortCurveConditions(
                rjsCond.comfort, rjsCond.electricalProfileLevel, rjsCond.powerRestrictionCode);
    }

    /** Parse RJSModeEffortCurve into a ModeEffortCurve */
    public static RollingStock.ModeEffortCurves parseModeEffortCurves(
            RJSEffortCurves.RJSModeEffortCurve rjsMode, String fieldKey) {
        var defaultCurve = parseEffortCurve(rjsMode.defaultCurve, fieldKey + ".default_curve");
        var curves = new RollingStock.ConditionalEffortCurve[rjsMode.curves.size()];
        for (int i = 0; i < rjsMode.curves.size(); i++) {
            var rjsCondCurve = rjsMode.curves.get(i);
            var curve = parseEffortCurve(rjsCondCurve.curve, String.format("%s.curves[%d].curve", fieldKey, i));
            var cond = parseEffortCurveConditions(rjsCondCurve.cond, String.format("%s.curves[%d].cond", fieldKey, i));
            curves[i] = new RollingStock.ConditionalEffortCurve(cond, curve);
        }
        return new RollingStock.ModeEffortCurves(rjsMode.isElectric, defaultCurve, curves);
    }

    private static RollingStock.TractiveEffortPoint[] parseEffortCurve(
            RJSEffortCurves.RJSEffortCurve rjsEffortCurve, String fieldKey) throws OSRDError {
        if (rjsEffortCurve.speeds == null) throw OSRDError.newMissingRollingStockFieldError(fieldKey + ".speeds");
        if (rjsEffortCurve.maxEfforts == null)
            throw OSRDError.newMissingRollingStockFieldError(fieldKey + ".max_efforts");
        if (rjsEffortCurve.speeds.length != rjsEffortCurve.maxEfforts.length)
            throw new OSRDError(ErrorType.InvalidRollingStockEffortCurve);

        var tractiveEffortCurve = new RollingStock.TractiveEffortPoint[rjsEffortCurve.speeds.length];
        for (int i = 0; i < rjsEffortCurve.speeds.length; i++) {
            var speed = rjsEffortCurve.speeds[i];
            if (speed < 0) throw OSRDError.newInvalidRollingStockFieldError(fieldKey, "negative speed");
            var maxEffort = rjsEffortCurve.maxEfforts[i];
            if (maxEffort < 0) throw OSRDError.newInvalidRollingStockFieldError(fieldKey, "negative max effort");
            tractiveEffortCurve[i] = new RollingStock.TractiveEffortPoint(speed, maxEffort);
            assert i == 0 || tractiveEffortCurve[i - 1].speed() < speed;
        }
        return tractiveEffortCurve;
    }
}
