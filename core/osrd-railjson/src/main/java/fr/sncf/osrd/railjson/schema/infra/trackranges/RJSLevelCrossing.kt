package fr.sncf.osrd.railjson.schema.infra.trackranges

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.common.Identified

data class RJSLevelCrossing(
    override val id: String,
    val name: String,
    @Json(name = "short_zone_length") val shortZoneLength: Long,
    val parts: Collection<RJSLevelCrossingPart>,
) : Identified

data class RJSLevelCrossingPart(
    val track: String,
    val position: Double,
    @Json(name = "pedal_upstream") val pedalUpstream: Long,
    @Json(name = "pedal_downstream") val pedalDownstream: Long,
)
