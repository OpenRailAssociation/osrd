package fr.sncf.osrd.api.path_properties

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.RangeValues
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.railjson.schema.geom.RJSMultiLineString
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset

class PathPropResponse(
    val slopes: RangeValues<Double>,
    val curves: RangeValues<Double>,
    val electrifications: RangeValues<Electrification>,
    val geometry: RJSMultiLineString,
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
    val position: Offset<PhysicsPath>,
    val weight: Long?,
    val name: String,
    val uic: Long?,
    val plc: String?,
    @Json(name = "country_code") val countryCode: String,
    @Json(name = "main_code") val mainCode: String,
    @Json(name = "secondary_code") val secondaryCode: String?,
    @Json(name = "is_passenger_station") val isPassengerStation: Boolean,
    @Json(name = "secondary_name") val secondaryName: String?,
)

data class OperationalPointPartResponse(
    val track: String,
    val position: Double,
    @Json(name = "local_track_name") val localTrackName: String,
    val extensions: OperationalPointPartExtension?,
)

data class OperationalPointPartExtension(val sncf: OperationalPointPartSncfExtension?)

data class OperationalPointPartSncfExtension(val kp: String)

val polymorphicElectrificationAdapter: PolymorphicJsonAdapterFactory<Electrification> =
    PolymorphicJsonAdapterFactory.of(Electrification::class.java, "type")
        .withSubtype(Electrified::class.java, "electrification")
        .withSubtype(Neutral::class.java, "neutral_section")
        .withSubtype(NonElectrified::class.java, "non_electrified")

val pathPropResponseAdapter: JsonAdapter<PathPropResponse> =
    Moshi.Builder()
        .add(polymorphicElectrificationAdapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(PathPropResponse::class.java)
