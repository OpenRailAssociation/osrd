package fr.sncf.osrd.api.stdcm

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.DirectionalTrackRange
import fr.sncf.osrd.api.PathItem
import fr.sncf.osrd.api.TimetableId
import fr.sncf.osrd.api.WorkSchedule
import fr.sncf.osrd.api.standalone_sim.MarginValue
import fr.sncf.osrd.api.standalone_sim.MarginValueAdapter
import fr.sncf.osrd.api.standalone_sim.PhysicsConsistModel
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.TimeDelta
import fr.sncf.osrd.utils.units.seconds
import java.time.ZonedDateTime

val DEFAULT_TIME_STEP: Duration = 2.seconds

class STDCMRequest(
    var infra: String,
    @Json(name = "expected_version") var expectedVersion: Int,
    @Json(name = "timetable_id") var timetableId: TimetableId,

    // Rolling stocks
    @Json(name = "consist_schedule") val consistSchedule: RequestConsistSchedule,

    // Pathfinding inputs
    /// List of waypoints. Each waypoint is a list of track offsets
    @Json(name = "path_items") val pathItems: List<STDCMPathItem>,
    // TODO: migrate this to structured SupportedSignalingSystem like editoast for ETCS support of
    // brake params

    // Simulation inputs
    val comfort: Comfort,

    // STDCM search parameters
    /// Numerical integration time step. Defaults to 2s.
    @Json(name = "time_step") val timeStep: Duration? = DEFAULT_TIME_STEP,
    @Json(name = "start_time") val startTime: ZonedDateTime,
    /// Maximum departure delay. Defaults to 2h.
    @Json(name = "maximum_departure_delay")
    val maximumDepartureDelay: Duration? = (3600 * 2).seconds,
    @Json(name = "maximum_run_time") val maximumRunTime: Duration,
    /// Gap between the created train and previous trains in milliseconds.
    @Json(name = "time_gap_before") val timeGapBefore: TimeDelta,
    /// Gap between the created train and following trains in milliseconds.
    @Json(name = "time_gap_after") val timeGapAfter: TimeDelta,
    /// Margin to apply to the whole train.
    val margin: MarginValue,
    /// Temporary speed limits which are active between the train departure and arrival.
    @Json(name = "temporary_speed_limits")
    val temporarySpeedLimits: Collection<STDCMTemporarySpeedLimit>,
    @Json(name = "work_schedules") val workSchedules: Collection<WorkSchedule> = listOf(),
    @Json(name = "allowed_track_sections") val allowedTrackSections: Set<String>?,
)

data class STDCMTemporarySpeedLimit(
    @Json(name = "speed_limit") val speedLimit: Double,
    @Json(name = "track_ranges") val trackRanges: List<DirectionalTrackRange>,
)

class STDCMPathItem(
    @Json(name = "path_item") val pathItem: PathItem,
    @Json(name = "stop_duration") var stopDuration: Duration?,
    @Json(name = "step_timing_data") val stepTimingData: StepTimingData?,
)

data class StepTimingData(
    @Json(name = "arrival_time") val arrivalTime: ZonedDateTime,
    @Json(name = "arrival_time_tolerance_before") val arrivalTimeToleranceBefore: Duration,
    @Json(name = "arrival_time_tolerance_after") val arrivalTimeToleranceAfter: Duration,
)

data class RequestConsistSchedule(val boundaries: List<Int>, val values: List<ConsistConfiguration>)

data class ConsistConfiguration(
    @Json(name = "supported_signaling_systems") val supportedSignalingSystems: List<String>,
    @Json(name = "speed_limit_tag") val speedLimitTag: String?,
    @Json(name = "loading_gauge_type") val loadingGaugeType: RJSLoadingGaugeType,
    @Json(name = "physics_consist") val physicsConsist: PhysicsConsistModel,
)

val stdcmRequestAdapter: JsonAdapter<STDCMRequest> =
    Moshi.Builder()
        .add(MarginValueAdapter())
        .add(RJSRollingResistance.adapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(STDCMRequest::class.java)
