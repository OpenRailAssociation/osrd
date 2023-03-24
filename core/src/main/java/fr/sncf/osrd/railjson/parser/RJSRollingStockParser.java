package fr.sncf.osrd.railjson.parser;

import fr.sncf.osrd.envelope_sim.Utils.*;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStockField;
import fr.sncf.osrd.railjson.parser.exceptions.MissingRollingStockField;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSComfortType;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSEffortCurves;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.train.RollingStock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.HashMap;
import java.util.Objects;


public class RJSRollingStockParser {
    static final Logger logger = LoggerFactory.getLogger(RJSRollingStockParser.class);

    /** Parse the RailJSON  rolling stock into something the backend can work with */
    public static RollingStock parse(RJSRollingStock rjsRollingStock) throws InvalidRollingStock {
        // Check major version
        var inputMajor = rjsRollingStock.version.split("\\.")[0];
        var currentMajor = RJSRollingStock.CURRENT_VERSION.split("\\.")[0];
        if (!Objects.equals(inputMajor, currentMajor))
            throw new InvalidRollingStock(
                    String.format("Invalid rolling stock: major version mismatch, expected %s, got %s",
                            RJSRollingStock.CURRENT_VERSION, rjsRollingStock.version));
        else if (!rjsRollingStock.version.equals(RJSRollingStock.CURRENT_VERSION))
            logger.warn("Rolling stock version mismatch, expected {}, got {}", RJSRollingStock.CURRENT_VERSION,
                    rjsRollingStock.version);

        // Parse effort_curves
        if (rjsRollingStock.effortCurves == null)
            throw new MissingRollingStockField("effort_curves");
        final var rjsModes = rjsRollingStock.effortCurves.modes;

        if (rjsRollingStock.effortCurves.defaultMode == null)
            throw new MissingRollingStockField("effort_curves.default_mode");

        if (rjsRollingStock.effortCurves.modes == null)
            throw new MissingRollingStockField("effort_curves.modes");

        if (!rjsModes.containsKey(rjsRollingStock.effortCurves.defaultMode))
            throw new InvalidRollingStock(String.format("Invalid rolling stock: didn't found default mode '%s'",
                            rjsRollingStock.effortCurves.defaultMode));

        // Parse tractive effort curves modes
        var modes = new HashMap<String, RollingStock.ModeEffortCurves>();
        for (var mode: rjsModes.entrySet()) {
            modes.put(mode.getKey(), parseModeEffortCurves(mode.getValue(), "effort_curves.modes." + mode.getKey()));
        }

        if (rjsRollingStock.name == null)
            throw new MissingRollingStockField("name");

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

        if (rjsRollingStock.gamma == null)
            throw new MissingRollingStockField("gamma");

        if (Double.isNaN(rjsRollingStock.inertiaCoefficient))
            throw new MissingRollingStockField("inertia_coefficient");

        if (rjsRollingStock.features == null)
            throw new MissingRollingStockField("features");

        if (rjsRollingStock.loadingGauge == null)
            throw new MissingRollingStockField("loading_gauge");

        if (Double.isNaN(rjsRollingStock.mass))
            throw new MissingRollingStockField("mass");

        if (rjsRollingStock.energySources == null)
            throw new MissingRollingStockField("energy_source");

        var rollingResistance = parseRollingResistance(rjsRollingStock.rollingResistance);

        var gammaType = switch (rjsRollingStock.gamma.type) {
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
                //TODO: convert type from RJSEnergySource to EnergySource
                rjsRollingStock.energySources
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

    /** Parse an RJSEffortCurveConditions into a EffortCurveConditions */
    private static RollingStock.EffortCurveConditions parseEffortCurveConditions(
            RJSEffortCurves.RJSEffortCurveConditions rjsCond,
            String fieldKey
    ) {
        if (rjsCond == null)
            throw new MissingRollingStockField(fieldKey);
        return new RollingStock.EffortCurveConditions(parseComfort(rjsCond.comfort), rjsCond.electricalProfileLevel);
    }

    /** Parse rjsComfort into a RollingStock comfort */
    public static RollingStock.Comfort parseComfort(RJSComfortType rjsComfort) {
        if (rjsComfort == null)
            return null;
        if (rjsComfort == RJSComfortType.AC)
            return RollingStock.Comfort.AC;
        if (rjsComfort == RJSComfortType.HEATING)
            return RollingStock.Comfort.HEATING;
        return RollingStock.Comfort.STANDARD;
    }

    /** Parse RJSModeEffortCurve into a ModeEffortCurve */
    private static RollingStock.ModeEffortCurves parseModeEffortCurves(
            RJSEffortCurves.RJSModeEffortCurve rjsMode,
            String fieldKey
    ) {
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

    private static CurvePoint[] parseEffortCurve(
            RJSEffortCurves.RJSEffortCurve rjsEffortCurve,
            String fieldKey
    ) throws InvalidRollingStockField {
        if (rjsEffortCurve.speeds == null)
            throw new MissingRollingStockField(fieldKey + ".speeds");
        if (rjsEffortCurve.maxEfforts == null)
            throw new MissingRollingStockField(fieldKey + ".max_efforts");
        if (rjsEffortCurve.speeds.length != rjsEffortCurve.maxEfforts.length)
            throw new InvalidRollingStock(
                    "Invalid rolling stock effort curve, speeds and max_efforts should be same length");

        var tractiveEffortCurve  = new CurvePoint[rjsEffortCurve.speeds.length];
        for (int i = 0; i < rjsEffortCurve.speeds.length; i++) {
            var speed = rjsEffortCurve.speeds[i];
            if (speed < 0)
                throw new InvalidRollingStockField(fieldKey, "negative speed");
            var maxEffort = rjsEffortCurve.maxEfforts[i];
            if (maxEffort < 0)
                throw new InvalidRollingStockField(fieldKey, "negative max effort");
            tractiveEffortCurve[i] = new CurvePoint(speed, maxEffort);
            assert i == 0 || tractiveEffortCurve[i - 1].x() < speed;
        }
        return tractiveEffortCurve;
    }
}
