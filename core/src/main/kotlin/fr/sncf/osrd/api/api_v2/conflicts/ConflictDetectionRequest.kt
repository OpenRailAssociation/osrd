package fr.sncf.osrd.api.api_v2.conflicts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.RoutingRequirement
import fr.sncf.osrd.api.api_v2.SpacingRequirement
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import java.time.ZonedDateTime

class ConflictDetectionRequest(
    @Json(name = "trains_requirements") val trainsRequirements: Map<Long, TrainRequirementsRequest>,
)

class TrainRequirementsRequest(
    @Json(name = "start_time") val startTime: ZonedDateTime,
    @Json(name = "spacing_requirements") val spacingRequirements: Collection<SpacingRequirement>,
    @Json(name = "routing_requirements") val routingRequirements: Collection<RoutingRequirement>,
)

val conflictRequestAdapter: JsonAdapter<ConflictDetectionRequest> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(ConflictDetectionRequest::class.java)
