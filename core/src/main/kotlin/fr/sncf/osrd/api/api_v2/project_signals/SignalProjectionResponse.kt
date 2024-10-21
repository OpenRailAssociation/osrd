package fr.sncf.osrd.api.api_v2.project_signals

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta

class SignalProjectionResponse(
    @Json(name = "signal_updates") val signalUpdates: Map<Long, Collection<SignalUpdate>>
)

class SignalUpdate(
    @Json(name = "signal_id") val signalID: String,
    @Json(name = "signaling_system") val signalingSystem: String,
    @Json(name = "time_start") val timeStart: TimeDelta,
    @Json(name = "time_end") val timeEnd: TimeDelta,
    @Json(name = "position_start") val positionStart: Offset<TravelledPath>,
    @Json(name = "position_end") val positionEnd: Offset<TravelledPath>,
    val color: Int,
    val blinking: Boolean,
    @Json(name = "aspect_label") val aspectLabel: String,
)

val signalProjectionResponseAdapter: JsonAdapter<SignalProjectionResponse> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(SignalProjectionResponse::class.java)
