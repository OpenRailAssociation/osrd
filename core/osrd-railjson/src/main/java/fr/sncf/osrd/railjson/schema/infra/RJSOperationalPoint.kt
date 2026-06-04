package fr.sncf.osrd.railjson.schema.infra

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.common.Identified
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSOperationalPointPart

class RJSOperationalPoint(
    override val id: String,
    val parts: List<RJSOperationalPointPart>,
    val weight: Long?,
    val name: String,
    val uic: Long?,
    val plc: String?,
    @Json(name = "country_code") val countryCode: String,
    @Json(name = "main_code") val mainCode: String,
    @Json(name = "secondary_code") val secondaryCode: String?,
    @Json(name = "is_passenger_station") val isPassengerStation: Boolean,
    @Json(name = "secondary_name") val secondaryName: String?,
) : Identified
