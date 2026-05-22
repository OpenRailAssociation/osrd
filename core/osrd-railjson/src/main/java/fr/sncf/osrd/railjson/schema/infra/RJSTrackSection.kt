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
) : Identified {
    constructor(
        id: String,
        length: Double,
        geo: RJSLineString,
    ) : this(id, length, listOf(), listOf(), listOf(), geo)

    override fun toString(): String {
        return "RJSTrackSection(id='$id', length=$length)"
    }
}
