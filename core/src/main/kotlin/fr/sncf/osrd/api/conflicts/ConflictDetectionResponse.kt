package fr.sncf.osrd.api.conflicts

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.conflicts.ConflictType
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.TimeDelta

class ConflictDetectionResponse(
    /**
     * List of all detected conflicts, if any. Conflicts are grouped by sets of conflicting
     * train/work schedule IDs. (i.e. there's only one conflict entry between trains (A, B), but
     * there may be a different one for trains (B, C), or (A, B, C)).
     */
    val conflicts: Collection<ConflictResponse>
)

/**
 * One conflict between a non-empty set of trains and a possibly empty set of work schedules. If one
 * given set of [train + work schedule] is conflicting over a continuous time range, only one
 * conflict is returned (with a longer requirement list).
 */
class ConflictResponse(
    /** List of train IDs for this given conflict. Can't be empty. */
    @Json(name = "train_ids") val trainIds: Collection<String>,
    /** List of work schedule IDs for this given conflict, if any. */
    @Json(name = "work_schedule_ids") val workScheduleIds: Collection<String>,
    /**
     * Start of the conflict time range: elapsed ms since the implicit 'request base time'.
     *
     * This is the *union* of all the conflicting time ranges.
     *
     * The implicit 'request base time' is the same over the whole request (`trains_requirements`
     * and `work_schedules`) and response. Example: `1970-01-01T00:00:00Z` for calendar timetables;
     * the timetable start for hourly timetables.
     */
    @Json(name = "start_time") val startTime: TimeDelta,
    /** Duration of the conflict. */
    @Json(name = "duration") val duration: Duration,
    /** One of "Spacing" or "Routing" depending on the kind of conflicting resource. */
    @Json(name = "conflict_type") val conflictType: ConflictType,
    /** List of all conflicting requirements. Can't be empty. */
    val requirements: Collection<ConflictRequirement>,
)

/**
 * One conflicting requirement. The zone is used by at least two of the conflicting
 * [trains / work schedules] in the given time range. This time range is the *union* and *not the
 * intersection* of the time during which it is used by at least one train, i.e. if a train uses the
 * resource from 10:00 to 11:00 and another one uses it from 10:30 to 11:30, the resulting range
 * would be 10:00 to 11:30.
 */
class ConflictRequirement(
    /** Zone name, as returned from `ZoneInfra.getZoneName` */
    @Json(name = "zone") val zone: String,
    /**
     * Start of the time range (earliest start time for any zone use in this conflict): elapsed ms
     * since the implicit 'request base time'.
     *
     * The implicit 'request base time' is the same over the whole request (`trains_requirements`
     * and `work_schedules`) and response. Example: `1970-01-01T00:00:00Z` for calendar timetables;
     * the timetable start for hourly timetables.
     */
    @Json(name = "start_time") val startTime: TimeDelta,
    /**
     * Duration of the time range (difference between the latest end time and the earliest
     * start_time for any zone use in this conflict).
     */
    @Json(name = "duration") val duration: Duration,
)

val conflictResponseAdapter: JsonAdapter<ConflictDetectionResponse> =
    Moshi.Builder()
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(ConflictDetectionResponse::class.java)
