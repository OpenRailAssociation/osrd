package fr.sncf.osrd.api.api_v2.project_signals

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.DirectionalTrackRange
import fr.sncf.osrd.api.api_v2.SignalSighting
import fr.sncf.osrd.api.api_v2.ZoneUpdate
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.TimeDelta

class SignalProjectionRequest(
    val blocks: List<String>,
    @Json(name = "track_section_ranges") var trackSectionRanges: List<DirectionalTrackRange>,
    var routes: List<String>,
    @Json(name = "train_simulations") var trainSimulations: Map<Long, TrainSimulation>,
    var infra: String,
    /** The expected infrastructure version */
    @Json(name = "expected_version") var expectedVersion: String,
)

class TrainSimulation(
    @Json(name = "signal_sightings") val signalSightings: Collection<SignalSighting>,
    @Json(name = "zone_updates") val zoneUpdates: Collection<ZoneUpdate>,
    @Json(name = "simulation_end_time") val simulationEndTime: TimeDelta,
)

val signalProjectionRequestAdapter: JsonAdapter<SignalProjectionRequest> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(SignalProjectionRequest::class.java)
