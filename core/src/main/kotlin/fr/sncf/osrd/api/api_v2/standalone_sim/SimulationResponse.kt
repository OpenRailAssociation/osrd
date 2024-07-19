package fr.sncf.osrd.api.api_v2.standalone_sim

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.*
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta

interface SimulationResponse

class SimulationSuccess(
    val base: ReportTrain,
    val provisional: ReportTrain,
    @Json(name = "final_output") val finalOutput: CompleteReportTrain,
    val mrsp: MRSPResponse,
    @Json(name = "electrical_profiles") val electricalProfiles: RangeValues<ElectricalProfileValue>,
) : SimulationResponse

sealed class ElectricalProfileValue {
    data class Profile(val profile: String?, val handled: Boolean) : ElectricalProfileValue()

    class NoProfile : ElectricalProfileValue() {
        override fun equals(other: Any?): Boolean {
            if (other is NoProfile) return true
            return super.equals(other)
        }
    }
}

class MRSPResponse(
    val positions: List<Offset<Path>>,
    val speeds: List<Double>,
)

class CompleteReportTrain(
    positions: List<Offset<TravelledPath>>,
    times: List<TimeDelta>, // Times are compared to the departure time
    speeds: List<Double>,
    @Json(name = "energy_consumption") energyConsumption: Double,
    @Json(name = "path_item_times") pathItemTimes: List<TimeDelta>,
    @Json(name = "signal_sightings") val signalSightings: List<SignalSighting>,
    @Json(name = "zone_updates") val zoneUpdates: List<ZoneUpdate>,
    @Json(name = "spacing_requirements") val spacingRequirements: List<SpacingRequirement>,
    @Json(name = "routing_requirements") val routingRequirements: List<RoutingRequirement>
) : ReportTrain(positions, times, speeds, energyConsumption, pathItemTimes)

open class ReportTrain(
    val positions: List<Offset<TravelledPath>>,
    val times: List<TimeDelta>, // Times are compared to the departure time
    val speeds: List<Double>,
    @Json(name = "energy_consumption") val energyConsumption: Double,
    @Json(name = "path_item_times") val pathItemTimes: List<TimeDelta>,
)

class SimulationFailed(
    @Json(name = "core_error") val coreError: OSRDError,
) : SimulationResponse

val polymorphicSimulationResponseAdapter: PolymorphicJsonAdapterFactory<SimulationResponse> =
    PolymorphicJsonAdapterFactory.of(SimulationResponse::class.java, "status")
        .withSubtype(SimulationSuccess::class.java, "success")
        .withSubtype(SimulationFailed::class.java, "simulation_failed")

val polymorphicElectricalProfileAdapter: PolymorphicJsonAdapterFactory<ElectricalProfileValue> =
    PolymorphicJsonAdapterFactory.of(ElectricalProfileValue::class.java, "electrical_profile_type")
        .withSubtype(ElectricalProfileValue.NoProfile::class.java, "no_profile")
        .withSubtype(ElectricalProfileValue.Profile::class.java, "profile")

val simulationResponseAdapter: JsonAdapter<SimulationResponse> =
    Moshi.Builder()
        .add(polymorphicSimulationResponseAdapter)
        .add(polymorphicElectricalProfileAdapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(SimulationResponse::class.java)
