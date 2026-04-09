package fr.sncf.osrd.api.pathfinding

import com.squareup.moshi.FromJson
import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.DirectionalTrackRange
import fr.sncf.osrd.path.interfaces.JsonTrainPath
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetRange
import java.util.*

interface PathfindingBlockResponse

class PathfindingBlockSuccess(
    val path: JsonTrainPath,
    val length: Length<PhysicsPath>,

    /** Offsets of the waypoints given as input */
    @Json(name = "path_item_positions") val pathItemPositions: List<Offset<PhysicsPath>>,
    @Json(name = "backtrack_positions") val backtrackPositions: List<Offset<PhysicsPath>>,
) : PathfindingBlockResponse {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is PathfindingBlockSuccess) return false

        if (path != other.path) return false
        if (length != other.length) return false
        if (pathItemPositions != other.pathItemPositions) return false
        if (backtrackPositions != other.backtrackPositions) return false

        return true
    }

    override fun hashCode(): Int {
        return Objects.hash(path, length, pathItemPositions, backtrackPositions)
    }
}

class NotFoundInBlocks(
    @Json(name = "track_section_ranges") val trackSectionRanges: List<DirectionalTrackRange>,
    val length: Length<PhysicsPath>,
) : PathfindingBlockResponse

class NotFoundInRoutes(
    @Json(name = "track_section_ranges") val trackSectionRanges: List<DirectionalTrackRange>,
    val length: Length<PhysicsPath>,
) : PathfindingBlockResponse

class NotFoundInTracks : PathfindingBlockResponse

class IncompatibleConstraintsPathResponse(
    @Json(name = "relaxed_constraints_path") val relaxedConstraintsPath: PathfindingBlockSuccess,
    @Json(name = "incompatible_constraints") val incompatibleConstraints: IncompatibleConstraints,
) : PathfindingBlockResponse

data class IncompatibleConstraints(
    @Json(name = "incompatible_electrification_ranges")
    val incompatibleElectrificationRanges: List<RangeValue<String>>,
    @Json(name = "incompatible_gauge_ranges") val incompatibleGaugeRanges: List<RangeValue<String>>,
    @Json(name = "incompatible_signaling_system_ranges")
    val incompatibleSignalingSystemRanges: List<RangeValue<String>>,
)

data class RangeValue<T>(val range: OffsetRange<TrainPath>, val value: T?) {
    @FromJson
    fun fromJson(range: OffsetRange<TrainPath>): RangeValue<T> {
        return RangeValue(range, null)
    }
}

class PathfindingFailed(@Json(name = "core_error") val coreError: OSRDError) :
    PathfindingBlockResponse

class NotEnoughPathItems : PathfindingBlockResponse

val polymorphicPathfindingResponseAdapter: PolymorphicJsonAdapterFactory<PathfindingBlockResponse> =
    PolymorphicJsonAdapterFactory.of(PathfindingBlockResponse::class.java, "status")
        .withSubtype(PathfindingBlockSuccess::class.java, "success")
        .withSubtype(NotFoundInBlocks::class.java, "not_found_in_blocks")
        .withSubtype(NotFoundInRoutes::class.java, "not_found_in_routes")
        .withSubtype(NotFoundInTracks::class.java, "not_found_in_tracks")
        .withSubtype(IncompatibleConstraintsPathResponse::class.java, "incompatible_constraints")
        .withSubtype(NotEnoughPathItems::class.java, "not_enough_path_items")
        .withSubtype(PathfindingFailed::class.java, "internal_error")

val pathfindingResponseAdapter: JsonAdapter<PathfindingBlockResponse> =
    Moshi.Builder()
        .add(polymorphicPathfindingResponseAdapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(PathfindingBlockResponse::class.java)
