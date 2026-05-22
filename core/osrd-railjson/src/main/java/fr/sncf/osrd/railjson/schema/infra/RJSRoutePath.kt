package fr.sncf.osrd.railjson.schema.infra

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange
import java.util.*

data class RJSRoutePath(
    val route: String,
    @Json(name = "track_sections") val trackSections: MutableList<RJSDirectionalTrackRange>,
)
