package fr.sncf.osrd.api.api_v2.standalone_sim

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.RoutingRequirement
import fr.sncf.osrd.api.api_v2.SignalSighting
import fr.sncf.osrd.api.api_v2.SpacingRequirement
import fr.sncf.osrd.api.api_v2.ZoneUpdate
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
    @Json(name = "power_restrictions") val powerRestrictions: List<PowerRestriction>,
) : SimulationResponse

class MRSPResponse(
    val positions: List<Offset<Path>>,
    val speeds: List<Double>,
)

class CompleteReportTrain(
    positions: List<Offset<Path>>,
    times: List<TimeDelta>, // Times are compared to the departure time
    speeds: List<Double>,
    @Json(name = "energy_consumption") energyConsumption: Double,
    @Json(name = "signal_sightings") val signalSightings: List<SignalSighting>,
    @Json(name = "zone_updates") val zoneUpdates: List<ZoneUpdate>,
    @Json(name = "spacing_requirements") val spacingRequirements: List<SpacingRequirement>,
    @Json(name = "routing_requirements") val routingRequirements: List<RoutingRequirement>
) : ReportTrain(positions, times, speeds, energyConsumption)

open class ReportTrain(
    val positions: List<Offset<Path>>,
    val times: List<TimeDelta>, // Times are compared to the departure time
    val speeds: List<Double>,
    @Json(name = "energy_consumption") val energyConsumption: Double,
)

class PowerRestriction(
    val begin: Offset<Path>,
    val end: Offset<Path>,
    val code: String,
    val handled: Boolean
)

class SimulationFailed(
    @Json(name = "core_error") val coreError: OSRDError,
) : SimulationResponse

val polymorphicAdapter: PolymorphicJsonAdapterFactory<SimulationResponse> =
    PolymorphicJsonAdapterFactory.of(SimulationResponse::class.java, "status")
        .withSubtype(SimulationSuccess::class.java, "success")
        .withSubtype(SimulationFailed::class.java, "simulation_failed")

val simulationResponseAdapter: JsonAdapter<SimulationResponse> =
    Moshi.Builder()
        .add(polymorphicAdapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(SimulationResponse::class.java)
