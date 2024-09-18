package fr.sncf.osrd.api.api_v2.conflicts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.ConflictDetectionEndpoint
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import java.time.ZonedDateTime

class ConflictDetectionResponse(
    val conflicts: Collection<Conflict>,
)

class Conflict(
    @Json(name = "train_ids") val trainIds: Collection<Long>,
    @Json(name = "work_schedule_ids") val workScheduleIds: Collection<Long>,
    @Json(name = "start_time") val startTime: ZonedDateTime,
    @Json(name = "end_time") val endTime: ZonedDateTime,
    @Json(name = "conflict_type")
    val conflictType: ConflictDetectionEndpoint.ConflictDetectionResult.Conflict.ConflictType,
    @Json(name = "requirements") val requirements: Collection<ConflictRequirement>,
)

class ConflictRequirement(
    @Json(name = "zone") val zone: String,
    @Json(name = "start_time") val startTime: ZonedDateTime,
    @Json(name = "end_time") val endTime: ZonedDateTime,
)

val conflictResponseAdapter: JsonAdapter<ConflictDetectionResponse> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(ConflictDetectionResponse::class.java)
