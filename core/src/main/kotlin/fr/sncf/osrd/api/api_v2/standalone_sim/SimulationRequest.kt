package fr.sncf.osrd.api.api_v2.standalone_sim

import com.squareup.moshi.*
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.RangeValues
import fr.sncf.osrd.api.api_v2.TrackRange
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.GammaType
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.rollingstock.RJSEffortCurves.RJSModeEffortCurve
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta

class SimulationRequest(
    val infra: String,
    @Json(name = "expected_version") val expectedVersion: String,
    val path: SimulationPath,
    val schedule: List<SimulationScheduleItem>,
    val margins: RangeValues<MarginValue>,
    @Json(name = "initial_speed") val initialSpeed: Double,
    val comfort: Comfort,
    @Json(name = "constraint_distribution") val constraintDistribution: AllowanceDistribution,
    @Json(name = "speed_limit_tag") val speedLimitTag: String?,
    @Json(name = "power_restrictions") val powerRestrictions: List<SimulationPowerRestrictionItem>,
    val options: TrainScheduleOptions,
    @Json(name = "rolling_stock") val rollingStock: PhysicsRollingStockModel,
    @Json(name = "electrical_profile_set_id") val electricalProfileSetId: String?
) {
    companion object {
        val adapter: JsonAdapter<SimulationRequest> =
            Moshi.Builder()
                .add(MarginValueAdapter())
                .add(RJSRollingResistance.adapter)
                .addLast(UnitAdapterFactory())
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(SimulationRequest::class.java)
    }
}

enum class AllowanceDistribution {
    MARECO,
    STANDARD;

    fun toRJS(): RJSAllowanceDistribution {
        return when (this) {
            MARECO -> RJSAllowanceDistribution.MARECO
            STANDARD -> RJSAllowanceDistribution.LINEAR
        }
    }
}

class PhysicsRollingStockModel(
    @Json(name = "effort_curves") val effortCurves: EffortCurve,
    @Json(name = "base_power_class") val basePowerClass: String?,
    val length: Length<RollingStock>,
    @Json(name = "max_speed") val maxSpeed: Double,
    @Json(name = "startup_time") val startupTime: Duration,
    @Json(name = "startup_acceleration") val startupAcceleration: Double,
    @Json(name = "comfort_acceleration") val comfortAcceleration: Double,
    val gamma: Gamma,
    @Json(name = "inertia_coefficient") val inertiaCoefficient: Double,
    val mass: Long, // kg
    @Json(name = "rolling_resistance") val rollingResistance: RJSRollingResistance,
    @Json(name = "power_restrictions") val powerRestrictions: Map<String, String>,
    @Json(name = "electrical_power_startup_time") val electricalPowerStartupTime: Duration?,
    @Json(name = "raise_pantograph_time") val raisePantographTime: Duration?,
)

class Gamma(
    @Json(name = "type") val gammaType: GammaType,
    val value: Double,
)

class EffortCurve(
    val modes: Map<String, RJSModeEffortCurve>,
    @Json(name = "default_mode") val defaultMode: String,
)

class SimulationPath(
    val blocks: List<String>,
    val routes: List<String>,
    @Json(name = "track_section_ranges") val trackSectionRanges: List<TrackRange>,
    @Json(name = "path_item_positions") val pathItemPositions: List<Offset<Path>>
)

class SimulationScheduleItem(
    @Json(name = "path_offset") val pathOffset: Offset<TravelledPath>,
    val arrival: TimeDelta?,
    @Json(name = "stop_for") val stopFor: Duration?,
    @Json(name = "reception_signal") val receptionSignal: RJSReceptionSignal,
)

sealed class MarginValue {
    class MinPer100Km(var value: Double) : MarginValue()

    class Percentage(var percentage: Double) : MarginValue()

    class None() : MarginValue()
}

class MarginValueAdapter {
    @ToJson
    fun toJson(value: MarginValue): String {
        return when (value) {
            is MarginValue.MinPer100Km -> {
                "${value.value}min/100km"
            }
            is MarginValue.Percentage -> {
                "${value.percentage}%"
            }
            else -> {
                "none"
            }
        }
    }

    @FromJson
    fun fromJson(marginValue: String): MarginValue {
        if (marginValue == "none") {
            return MarginValue.None()
        }
        if (marginValue.endsWith("%")) {
            val percentage = marginValue.split("%")[0].toDouble()
            return MarginValue.Percentage(percentage)
        }
        if (marginValue.endsWith("min/100km")) {
            val minPer100Km = marginValue.split("min/100km")[0].toDouble()
            return MarginValue.MinPer100Km(minPer100Km)
        }
        throw JsonDataException("Margin value type not recognized $marginValue")
    }
}

class SimulationPowerRestrictionItem(
    val from: Offset<Path>,
    val to: Offset<Path>,
    val value: String,
)

class TrainScheduleOptions(
    @Json(name = "use_electrical_profiles") val useElectricalProfiles: Boolean
)
