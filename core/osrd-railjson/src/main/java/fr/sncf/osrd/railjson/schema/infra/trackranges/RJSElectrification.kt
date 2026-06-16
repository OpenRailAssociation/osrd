package fr.sncf.osrd.railjson.schema.infra.trackranges

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.common.Identified

data class RJSElectrification(
    override val id: String,
    val voltage: String,
    // the direction is ignored, deprecated
    @Json(name = "track_ranges") val trackRanges: Collection<RJSApplicableDirectionsTrackRange>,
) : Identified
