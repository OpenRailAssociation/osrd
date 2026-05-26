package fr.sncf.osrd.railjson.schema.infra.trackobjects

import com.squareup.moshi.Json
import java.util.Objects
import kotlin.Any
import kotlin.Boolean
import kotlin.Int
import kotlin.String

class RJSOperationalPointPart(
    override val track: String,
    override val position: Double,
    @Json(name = "local_track_name") val localTrackName: String?,
    val extensions: RJSOperationalPointPartExtensions?,
) : RJSTrackObject {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is RJSOperationalPointPart) return false
        return position.compareTo(other.position) == 0 && track == other.track
    }

    override fun hashCode(): Int {
        return Objects.hash(position, track)
    }
}

class RJSOperationalPointPartExtensions(val sncf: RJSOperationalPointPartSncfExtension?)

class RJSOperationalPointPartSncfExtension(val kp: String)
