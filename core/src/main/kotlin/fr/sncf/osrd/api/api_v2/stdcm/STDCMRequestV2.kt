package fr.sncf.osrd.api.api_v2.stdcm

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.DirectionalTrackRange
import fr.sncf.osrd.api.api_v2.TrackLocation
import fr.sncf.osrd.api.api_v2.WorkSchedule
import fr.sncf.osrd.api.api_v2.conflicts.TrainRequirementsRequest
import fr.sncf.osrd.api.api_v2.standalone_sim.MarginValue
import fr.sncf.osrd.api.api_v2.standalone_sim.MarginValueAdapter
import fr.sncf.osrd.api.api_v2.standalone_sim.PhysicsRollingStockModel
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimit
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.TimeDelta
import fr.sncf.osrd.utils.units.seconds
import java.time.ZonedDateTime

class STDCMRequestV2(
    var infra: String,
    @Json(name = "expected_version") var expectedVersion: String,

    // Rolling stock
    @Json(name = "rolling_stock") val rollingStock: PhysicsRollingStockModel,

    // Pathfinding inputs
    /// List of waypoints. Each waypoint is a list of track offsets
    @Json(name = "path_items") val pathItems: List<STDCMPathItem>,
    @Json(name = "rolling_stock_loading_gauge") val rollingStockLoadingGauge: RJSLoadingGaugeType,
    @Json(name = "rolling_stock_supported_signaling_systems")
    val rollingStockSupportedSignalingSystems: List<String>,
    @Json(name = "trains_requirements") val trainsRequirements: Map<Long, TrainRequirementsRequest>,

    // Simulation inputs
    val comfort: Comfort,
    @Json(name = "speed_limit_tag") val speedLimitTag: String?,

    // STDCM search parameters
    /// Numerical integration time step. Defaults to 2s.
    @Json(name = "time_step") val timeStep: Duration? = 2.seconds,
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
    @Json(name = "work_schedules") val workSchedules: Collection<WorkSchedule> = listOf(),
    /// Temporary speed limits which are active between the train departure and arrival.
    @Json(name = "spacing_requirements") var temporarySpeedLimits: Collection<TemporarySpeedLimit>,
)

class STDCMPathItem(
    val locations: List<TrackLocation>,
    @Json(name = "stop_duration") var stopDuration: Duration?,
    @Json(name = "step_timing_data") val stepTimingData: StepTimingData?,
)

data class StepTimingData(
    @Json(name = "arrival_time") val arrivalTime: ZonedDateTime,
    @Json(name = "arrival_time_tolerance_before") val arrivalTimeToleranceBefore: Duration,
    @Json(name = "arrival_time_tolerance_after") val arrivalTimeToleranceAfter: Duration,
)

val stdcmRequestAdapter: JsonAdapter<STDCMRequestV2> =
    Moshi.Builder()
        .add(MarginValueAdapter())
        .add(RJSRollingResistance.adapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(STDCMRequestV2::class.java)
