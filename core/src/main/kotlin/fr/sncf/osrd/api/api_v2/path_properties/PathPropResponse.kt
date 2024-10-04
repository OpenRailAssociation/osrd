package fr.sncf.osrd.api.api_v2.path_properties

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.RangeValues
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset

class PathPropResponse(
    val slopes: RangeValues<Double>,
    val curves: RangeValues<Double>,
    val electrifications: RangeValues<Electrification>,
    val geometry: RJSLineString,
    @Json(name = "operational_points") val operationalPoints: List<OperationalPointResponse>,
    val zones: RangeValues<String>,
)

interface Electrification

data class Electrified(val voltage: String) : Electrification

data class Neutral(@Json(name = "lower_pantograph") val lowerPantograph: Boolean) : Electrification

class NonElectrified : Electrification

data class OperationalPointResponse(
    val id: String,
    val part: OperationalPointPartResponse,
    val extensions: OperationalPointExtensions?,
    val position: Offset<Path>
)

data class OperationalPointPartResponse(
    val track: String,
    val position: Double,
    val extensions: OperationalPointPartExtension?
)

data class OperationalPointExtensions(
    val sncf: OperationalPointSncfExtension?,
    val identifier: OperationalPointIdentifierExtension?
)

data class OperationalPointSncfExtension(
    val ci: Long,
    val ch: String,
    @Json(name = "ch_short_label") val chShortLabel: String,
    @Json(name = "ch_long_label") val chLongLabel: String,
    val trigram: String
)

data class OperationalPointIdentifierExtension(val name: String, val uic: Long)

data class OperationalPointPartExtension(val sncf: OperationalPointPartSncfExtension?)

data class OperationalPointPartSncfExtension(val kp: String)

val polymorphicAdapter: PolymorphicJsonAdapterFactory<Electrification> =
    PolymorphicJsonAdapterFactory.of(Electrification::class.java, "type")
        .withSubtype(Electrified::class.java, "electrification")
        .withSubtype(Neutral::class.java, "neutral_section")
        .withSubtype(NonElectrified::class.java, "non_electrified")

val pathPropResponseAdapter: JsonAdapter<PathPropResponse> =
    Moshi.Builder()
        .add(polymorphicAdapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(PathPropResponse::class.java)
