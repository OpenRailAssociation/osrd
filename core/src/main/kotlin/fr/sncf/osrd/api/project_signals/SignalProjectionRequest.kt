package fr.sncf.osrd.api.project_signals

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.SignalCriticalPosition
import fr.sncf.osrd.api.ZoneUpdate
import fr.sncf.osrd.path.interfaces.JsonTrainPath
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.TimeDelta

class SignalProjectionRequest(
    val path: JsonTrainPath,
    @Json(name = "train_simulations") var trainSimulations: List<TrainSimulation>,
    var infra: String,
    /** The expected infrastructure version */
    @Json(name = "expected_version") var expectedVersion: Int,
)

class TrainSimulation(
    @Json(name = "signal_critical_positions")
    val signalCriticalPositions: Collection<SignalCriticalPosition>,
    @Json(name = "zone_updates") val zoneUpdates: Collection<ZoneUpdate>,
    @Json(name = "simulation_end_time") val simulationEndTime: TimeDelta,
)

val signalProjectionRequestAdapter: JsonAdapter<SignalProjectionRequest> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(SignalProjectionRequest::class.java)
