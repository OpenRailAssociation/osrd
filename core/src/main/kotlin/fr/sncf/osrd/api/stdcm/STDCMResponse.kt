package fr.sncf.osrd.api.stdcm

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.pathfinding.PathfindingBlockResponse
import fr.sncf.osrd.api.pathfinding.polymorphicPathfindingResponseAdapter
import fr.sncf.osrd.api.standalone_sim.SimulationSuccess
import fr.sncf.osrd.api.standalone_sim.polymorphicElectricalProfileAdapter
import fr.sncf.osrd.api.standalone_sim.polymorphicSimulationResponseAdapter
import fr.sncf.osrd.api.standalone_sim.polymorphicSpeedLimitSourceAdapter
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import java.time.ZonedDateTime

interface STDCMResponse

class STDCMSuccess(
    var simulation: SimulationSuccess,
    var path: PathfindingBlockResponse,
    @Json(name = "departure_time") var departureTime: ZonedDateTime,
) : STDCMResponse

class LastReachedOperationalPoint(
    var id: String,
    var coordinates: Point,
    @Json(name = "arrival_time") var arrivalTime: ZonedDateTime,
)

class ConflictingWorkSchedule(
    var id: String,
    @Json(name = "last_op_id") var lastOPId: String,
)

class PathNotFound(
    @Json(name = "most_blocking_work_schedules")
    var mostBlockingWorkSchedules: List<ConflictingWorkSchedule>,
    @Json(name = "nearest_to_destination_work_schedules")
    var nearestToDestinationWorkSchedules: List<ConflictingWorkSchedule>,
    @Json(name = "partial_path") var partialPath: PathfindingBlockResponse? = null,
    @Json(name = "last_reached_operational_point")
    var lastReachedOperationalPoint: LastReachedOperationalPoint? = null,
) : STDCMResponse

val polymorphicSTDCMResponseAdapter: PolymorphicJsonAdapterFactory<STDCMResponse> =
    PolymorphicJsonAdapterFactory.of(STDCMResponse::class.java, "status")
        .withSubtype(STDCMSuccess::class.java, "success")
        .withSubtype(PathNotFound::class.java, "path_not_found")

val stdcmResponseAdapter: JsonAdapter<STDCMResponse> =
    Moshi.Builder()
        .addLast(polymorphicSTDCMResponseAdapter)
        .addLast(polymorphicSimulationResponseAdapter)
        .addLast(polymorphicElectricalProfileAdapter)
        .addLast(polymorphicSpeedLimitSourceAdapter)
        .addLast(polymorphicPathfindingResponseAdapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(STDCMResponse::class.java)
