package fr.sncf.osrd.api.etcs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.conflicts.ConflictType
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta

data class ETCSBrakingCurvesResponse(
    val slowdowns: List<ETCSCurves>,
    val stops: List<ETCSCurves>,
    val conflicts: List<ETCSConflictCurves>,
)

data class ETCSCurves(
    val indication: SimpleEnvelope?, // null for open-signal stops
    @Json(name = "permitted_speed") val permittedSpeed: SimpleEnvelope,
    val guidance: SimpleEnvelope,
)

data class ETCSConflictCurves(
    val indication: SimpleEnvelope,
    @Json(name = "permitted_speed") val permittedSpeed: SimpleEnvelope,
    val guidance: SimpleEnvelope,
    @Json(name = "conflict_type") val conflictType: ConflictType,
)

data class SimpleEnvelope(
    val positions: List<Offset<TravelledPath>>,
    val times: List<TimeDelta>, // Times are compared to the departure time
    val speeds: List<Double>,
)

val etcsBrakingCurvesResponseAdapter: JsonAdapter<ETCSBrakingCurvesResponse> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(ETCSBrakingCurvesResponse::class.java)
