package fr.sncf.osrd.railjson.schema.infra.trackobjects

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection

data class RJSSign(
    override val track: String,
    override val position: Double,
    val side: String,
    val direction: EdgeDirection,
    @Json(name = "type") val signType: String,
    val value: String,
    val kp: String,
) : RJSTrackObject
