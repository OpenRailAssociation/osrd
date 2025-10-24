package fr.sncf.osrd.api

import fr.sncf.osrd.api.standalone_sim.PhysicsConsistModel
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.TractiveEffortPoint
import fr.sncf.osrd.railjson.schema.rollingstock.RJSEffortCurves.*
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance.Davis
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.*

/** Parse the rolling stock model into something the backend can work with */
fun parseRawRollingStock(
    rawPhysicsConsist: PhysicsConsistModel,
    loadingGaugeType: RJSLoadingGaugeType = RJSLoadingGaugeType.G1,
    rollingStockSupportedSignalingSystems: List<String> = listOf(),
): RollingStock {
    // Parse effort_curves
    val rawModes = rawPhysicsConsist.effortCurves.modes

    if (!rawModes.containsKey(rawPhysicsConsist.effortCurves.defaultMode))
        throw OSRDError.newInvalidRollingStockError(
            ErrorType.InvalidRollingStockDefaultModeNotFound,
            rawPhysicsConsist.effortCurves.defaultMode,
        )

    // Parse tractive effort curves modes
    val modes = HashMap<String, ModeEffortCurves>()
    for ((key, value) in rawModes) {
        modes[key] = parseModeEffortCurves(value, "effort_curves.modes.$key")
    }

    val rollingResistance = parseRollingResistance(rawPhysicsConsist.rollingResistance)

    return RollingStock(
        "placeholder_name",
        rawPhysicsConsist.length.meters,
        rawPhysicsConsist.mass.toDouble(),
        rawPhysicsConsist.inertiaCoefficient,
        rollingResistance.A,
        rollingResistance.B,
        rollingResistance.C,
        rawPhysicsConsist.maxSpeed,
        rawPhysicsConsist.startupTime.seconds,
        rawPhysicsConsist.startupAcceleration,
        rawPhysicsConsist.comfortAcceleration,
        rawPhysicsConsist.constGamma,
        rawPhysicsConsist.etcsBrakeParams,
        loadingGaugeType,
        modes,
        rawPhysicsConsist.effortCurves.defaultMode,
        rawPhysicsConsist.basePowerClass,
        rawPhysicsConsist.powerRestrictions,
        rawPhysicsConsist.electricalPowerStartupTime?.seconds,
        rawPhysicsConsist.raisePantographTime?.seconds,
        rollingStockSupportedSignalingSystems.toTypedArray(),
    )
}

private fun parseRollingResistance(rjsRollingResistance: RJSRollingResistance?): Davis {
    if (rjsRollingResistance == null)
        throw OSRDError.newMissingRollingStockFieldError("rolling_resistance")
    if (rjsRollingResistance.javaClass != Davis::class.java)
        throw OSRDError.newInvalidRollingStockFieldError(
            "rolling_resistance",
            "unsupported rolling resistance type",
        )
    return rjsRollingResistance as Davis
}

/** Parse an RJSEffortCurveConditions into a EffortCurveConditions */
private fun parseEffortCurveConditions(
    rjsCond: RJSEffortCurveConditions?,
    fieldKey: String,
): EffortCurveConditions {
    if (rjsCond == null) throw OSRDError.newMissingRollingStockFieldError(fieldKey)
    return EffortCurveConditions(
        rjsCond.comfort,
        rjsCond.electricalProfileLevel,
        rjsCond.powerRestrictionCode,
    )
}

/** Parse RJSModeEffortCurve into a ModeEffortCurve */
private fun parseModeEffortCurves(rjsMode: RJSModeEffortCurve, fieldKey: String): ModeEffortCurves {
    val defaultCurve = parseEffortCurve(rjsMode.defaultCurve, "$fieldKey.default_curve")
    val curves = arrayOfNulls<ConditionalEffortCurve>(rjsMode.curves.size)
    for (i in rjsMode.curves.indices) {
        val rjsCondCurve = rjsMode.curves[i]
        val curve =
            parseEffortCurve(rjsCondCurve.curve, String.format("%s.curves[%d].curve", fieldKey, i))
        val cond =
            parseEffortCurveConditions(
                rjsCondCurve.cond,
                String.format("%s.curves[%d].cond", fieldKey, i),
            )
        curves[i] = ConditionalEffortCurve(cond, curve)
    }
    return ModeEffortCurves(rjsMode.isElectric, defaultCurve, curves)
}

private fun parseEffortCurve(
    rjsEffortCurve: RJSEffortCurve,
    fieldKey: String,
): Array<TractiveEffortPoint?> {
    if (rjsEffortCurve.speeds == null)
        throw OSRDError.newMissingRollingStockFieldError("$fieldKey.speeds")
    if (rjsEffortCurve.maxEfforts == null)
        throw OSRDError.newMissingRollingStockFieldError("$fieldKey.max_efforts")
    if (rjsEffortCurve.speeds.size != rjsEffortCurve.maxEfforts.size)
        throw OSRDError(ErrorType.InvalidRollingStockEffortCurve)

    val tractiveEffortCurve = arrayOfNulls<TractiveEffortPoint>(rjsEffortCurve.speeds.size)
    for (i in rjsEffortCurve.speeds.indices) {
        val speed = rjsEffortCurve.speeds[i]
        if (speed < 0) throw OSRDError.newInvalidRollingStockFieldError(fieldKey, "negative speed")
        val maxEffort = rjsEffortCurve.maxEfforts[i]
        if (maxEffort < 0)
            throw OSRDError.newInvalidRollingStockFieldError(fieldKey, "negative max effort")
        tractiveEffortCurve[i] = TractiveEffortPoint(speed, maxEffort)
        assert(i == 0 || tractiveEffortCurve[i - 1]!!.speed < speed)
    }
    return tractiveEffortCurve
}
