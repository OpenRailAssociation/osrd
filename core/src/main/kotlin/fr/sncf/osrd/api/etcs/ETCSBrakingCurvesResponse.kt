package fr.sncf.osrd.api.etcs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.SimpleEnvelope
import fr.sncf.osrd.utils.json.UnitAdapterFactory

data class ETCSBrakingCurvesResponse(
    val slowdowns: List<ETCSCurves>,
    val stops: List<ETCSCurves>,
    val signals: List<ETCSCurves>,
)

data class ETCSCurves(
    val indication: SimpleEnvelope?, // null for open-signal stops
    @Json(name = "permitted_speed") val permittedSpeed: SimpleEnvelope,
    val guidance: SimpleEnvelope
)

val etcsBrakingCurvesResponseAdapter: JsonAdapter<ETCSBrakingCurvesResponse> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(ETCSBrakingCurvesResponse::class.java)
