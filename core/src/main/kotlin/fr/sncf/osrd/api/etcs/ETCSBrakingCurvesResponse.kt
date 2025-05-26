package fr.sncf.osrd.api.etcs

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.sim_infra.api.TravelledPath
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta

class ETCSBrakingCurvesResponse(
    slowdowns: List<ETCSCurves>,
    stops: List<ETCSCurves>,
    signals: List<ETCSCurves>,
)

class ETCSCurves(
    indication: SimpleEnvelope?, // null for open-signal stops
    permittedSpeed: SimpleEnvelope,
    guidance: SimpleEnvelope
)

class SimpleEnvelope(
    positions: List<Offset<TravelledPath>>,
    times: List<TimeDelta>, // Times are compared to the departure time
    speeds: List<Double>,
)

val etcsBrakingCurvesResponseAdapter: JsonAdapter<ETCSBrakingCurvesResponse> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(ETCSBrakingCurvesResponse::class.java)
