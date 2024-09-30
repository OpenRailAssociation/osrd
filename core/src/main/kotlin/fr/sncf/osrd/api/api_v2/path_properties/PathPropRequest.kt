package fr.sncf.osrd.api.api_v2.path_properties

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.DirectionalTrackRange
import fr.sncf.osrd.utils.json.UnitAdapterFactory

class PathPropRequest(
    @Json(name = "track_section_ranges") val trackSectionRanges: List<DirectionalTrackRange>,
    val infra: String,
    /** The expected infrastructure version */
    @Json(name = "expected_version") val expectedVersion: String,
)

val pathPropRequestAdapter: JsonAdapter<PathPropRequest> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(PathPropRequest::class.java)
