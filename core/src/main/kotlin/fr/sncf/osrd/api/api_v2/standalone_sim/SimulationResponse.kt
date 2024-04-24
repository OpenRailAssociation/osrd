package fr.sncf.osrd.api.api_v2.standalone_sim

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.SignalSighting
import fr.sncf.osrd.api.api_v2.ZoneUpdate
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta

class SimulationResponse(
    val base: ReportTrain,
    val provisional: ReportTrain,
    @Json(name = "final_output") val finalOutput: CompleteReportTrain,
    val mrsp: MRSPResponse,
    @Json(name = "power_restrictions") val powerRestrictions: List<PowerRestriction>,
) {
    companion object {
        val adapter: JsonAdapter<SimulationResponse> =
            Moshi.Builder()
                .addLast(UnitAdapterFactory())
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(SimulationResponse::class.java)
    }
}

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

class SpacingRequirement(
    val zone: String,
    @Json(name = "begin_time") val beginTime: TimeDelta,
    @Json(name = "end_time") val endTime: TimeDelta,
)

class RoutingRequirement(
    val route: String,
    @Json(name = "begin_time") val beginTime: TimeDelta,
    val zones: List<RoutingZoneRequirement>
)

class RoutingZoneRequirement(
    val zone: String,
    @Json(name = "entry_detector") val entryDetector: String,
    @Json(name = "exit_detector") val exitDetector: String,
    val switches: Map<String, String>,
    @Json(name = "end_time") val endTime: TimeDelta,
)

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
