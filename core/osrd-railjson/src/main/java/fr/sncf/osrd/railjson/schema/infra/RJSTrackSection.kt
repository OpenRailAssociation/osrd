package fr.sncf.osrd.railjson.schema.infra

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.common.Identified
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSCurve
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLoadingGaugeLimit
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope
import kotlin.collections.listOf

data class RJSTrackSection(
    override val id: String,
    val length: Double,
    val slopes: List<RJSSlope>,
    val curves: List<RJSCurve>,
    @Json(name = "loading_gauge_limits") val loadingGaugeLimits: List<RJSLoadingGaugeLimit>,
    val geo: RJSLineString,
    val extensions: RJSTrackSectionExtensions,
) : Identified {
    constructor(
        id: String,
        length: Double,
        geo: RJSLineString,
    ) : this(id, length, listOf(), listOf(), listOf(), geo, RJSTrackSectionExtensions(null, null))

    override fun toString(): String {
        return "RJSTrackSection(id='$id', length=$length)"
    }
}

data class RJSTrackSectionExtensions(
    val sncf: RJSTrackSectionSncfExtension?,
    val source: RJSTrackSectionSourceExtension?,
)

data class RJSTrackSectionSncfExtension(
    @Json(name = "line_code") val lineCode: Int,
    @Json(name = "line_name") val lineName: String,
    @Json(name = "track_number") val trackNumber: Int,
    @Json(name = "track_name") val trackName: String,
)

data class RJSTrackSectionSourceExtension(val name: String, val id: String)
