package fr.sncf.osrd.railjson.schema.common

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection

class RJSTrackLocation(
    @Json(name = "track_section") var trackSection: ID<RJSTrackSection>,
    var offset: Double,
)
