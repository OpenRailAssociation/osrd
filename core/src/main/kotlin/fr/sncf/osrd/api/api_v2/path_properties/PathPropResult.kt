package fr.sncf.osrd.api.api_v2.path_properties

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.utils.json.DistanceAdapterFactory
import fr.sncf.osrd.utils.json.OffsetAdapterFactory
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

class PathPropResult(
    val slopes: RangeValues<Double>,
    val gradients: RangeValues<Double>,
    val electrifications: RangeValues<Electrification>,
    val geometry: RJSLineString,
    @Json(name = "operational_points") val operationalPoints: List<OperationalPointResult>
)

data class RangeValues<T>(val boundaries: List<Distance>, val values: List<T>)

interface Electrification

data class Electrified(val voltage: String) : Electrification

data class Neutral(@Json(name = "lower_pantograph") val lowerPantograph: Boolean) : Electrification

class NonElectrified : Electrification

class OperationalPointResult(
    val id: String,
    val part: OperationalPointPartResult,
    val extensions: OperationalPointExtensions?,
    val position: Offset<Path>
)

class OperationalPointPartResult(
    val track: String,
    val position: Double,
    val extensions: OperationalPointPartExtension?
)

class OperationalPointExtensions(
    val sncf: OperationalPointSncfExtension?,
    val identifier: OperationalPointIdentifierExtension?
)

class OperationalPointSncfExtension(
    val ci: Long,
    val ch: String,
    @Json(name = "ch_short_label") val chShortLabel: String,
    @Json(name = "ch_long_label") val chLongLabel: String,
    val trigram: String
)

class OperationalPointIdentifierExtension(val name: String, val uic: Long)

class OperationalPointPartExtension(val sncf: OperationalPointPartSncfExtension?)

class OperationalPointPartSncfExtension(val kp: String)

val polymorphicAdapter: PolymorphicJsonAdapterFactory<Electrification> =
    PolymorphicJsonAdapterFactory.of(Electrification::class.java, "type")
        .withSubtype(Electrified::class.java, "electrification")
        .withSubtype(Neutral::class.java, "neutral_section")
        .withSubtype(NonElectrified::class.java, "non_electrified")

val pathPropResultAdapter: JsonAdapter<PathPropResult> =
    Moshi.Builder()
        .add(polymorphicAdapter)
        .addLast(DistanceAdapterFactory())
        .addLast(OffsetAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(PathPropResult::class.java)
