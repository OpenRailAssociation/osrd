package fr.sncf.osrd.api.standalone_sim

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.*
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.sim_infra.api.SpeedLimitSource
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta

interface SimulationResponse

class SimulationSuccess(
    /** Report where the train goes as fast as possible. */
    val base: ReportTrain,
    /** Report where the train tries to respect the margins. */
    val provisional: ReportTrain,
    /**
     * Report where the train tries to respect the margins as well as the arrival times at scheduled
     * points.
     */
    @Json(name = "final_output") val finalOutput: CompleteReportTrain,
    val mrsp: RangeValues<SpeedLimitProperty>,
    @Json(name = "electrical_profiles") val electricalProfiles: RangeValues<ElectricalProfileValue>,
) : SimulationResponse

sealed class ElectricalProfileValue {
    data class Profile(val profile: String?, val handled: Boolean) : ElectricalProfileValue()

    class NoProfile : ElectricalProfileValue() {
        override fun equals(other: Any?): Boolean {
            if (other is NoProfile) return true
            return super.equals(other)
        }

        override fun hashCode(): Int {
            return 1
        }
    }
}

class CompleteReportTrain(
    positions: List<Offset<PhysicsPath>>,
    times: List<TimeDelta>, // Times are compared to the departure time
    speeds: List<Double>,
    @Json(name = "energy_consumption") energyConsumption: Double,
    @Json(name = "path_item_times") pathItemTimes: List<TimeDelta>,
    @Json(name = "signal_critical_positions")
    val signalCriticalPositions: List<SignalCriticalPosition>,
    @Json(name = "zone_updates") val zoneUpdates: List<ZoneUpdate>,
    @Json(name = "spacing_requirements") val spacingRequirements: List<RJSSpacingRequirement>,
    @Json(name = "routing_requirements") val routingRequirements: List<RJSRoutingRequirement>,
) : ReportTrain(positions, times, speeds, energyConsumption, pathItemTimes)

/**
 * A simulation report, containing the [times] and the [speeds] for each position in [positions].
 *
 * [positions], [times] and [speeds] have the same length.
 *
 * [positions] is sorted.
 */
open class ReportTrain(
    val positions: List<Offset<PhysicsPath>>,
    /** Times are compared to departure time */
    val times: List<TimeDelta>,
    val speeds: List<Double>,
    @Json(name = "energy_consumption") val energyConsumption: Double,
    /**
     * Times at which the train *arrives* at each path item.
     *
     * If two path items have the same position, but the first one has a stop duration, the second
     * path item time will be offset by the stop duration of the first.
     *
     * For example, in a simulation going through four path items A, B, B' and C. If B and B' are at
     * the same position, then the path item time of B' will be equal to the path item time of B
     * plus the stop duration of B.
     */
    @Json(name = "path_item_times") val pathItemTimes: List<TimeDelta>,
)

class SimulationFailed(@Json(name = "core_error") val coreError: OSRDError) : SimulationResponse

val polymorphicSimulationResponseAdapter: PolymorphicJsonAdapterFactory<SimulationResponse> =
    PolymorphicJsonAdapterFactory.of(SimulationResponse::class.java, "status")
        .withSubtype(SimulationSuccess::class.java, "success")
        .withSubtype(SimulationFailed::class.java, "simulation_failed")

val polymorphicElectricalProfileAdapter: PolymorphicJsonAdapterFactory<ElectricalProfileValue> =
    PolymorphicJsonAdapterFactory.of(ElectricalProfileValue::class.java, "electrical_profile_type")
        .withSubtype(ElectricalProfileValue.NoProfile::class.java, "no_profile")
        .withSubtype(ElectricalProfileValue.Profile::class.java, "profile")

val polymorphicSpeedLimitSourceAdapter: PolymorphicJsonAdapterFactory<SpeedLimitSource> =
    PolymorphicJsonAdapterFactory.of(SpeedLimitSource::class.java, "speed_limit_source_type")
        .withSubtype(SpeedLimitSource.GivenTrainTag::class.java, "given_train_tag")
        .withSubtype(SpeedLimitSource.FallbackTag::class.java, "fallback_tag")
        .withSubtype(SpeedLimitSource.UnknownTag::class.java, "unknown_tag")

val simulationResponseAdapter: JsonAdapter<SimulationResponse> =
    Moshi.Builder()
        .add(polymorphicSimulationResponseAdapter)
        .add(polymorphicElectricalProfileAdapter)
        .add(polymorphicSpeedLimitSourceAdapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(SimulationResponse::class.java)
