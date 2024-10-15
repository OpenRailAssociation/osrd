package fr.sncf.osrd.api.api_v2.pathfinding

import com.squareup.moshi.FromJson
import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.DirectionalTrackRange
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.graph.Pathfinding.Range
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import java.util.*

interface PathfindingBlockResponse

class PathfindingBlockSuccess(
    // Block ids
    val blocks: List<String>,

    // Route ids
    val routes: List<String>,
    @Json(name = "track_section_ranges") val trackSectionRanges: List<DirectionalTrackRange>,
    val length: Length<Path>,

    /** Offsets of the waypoints given as input */
    @Json(name = "path_item_positions") val pathItemPositions: List<Offset<Path>>
) : PathfindingBlockResponse {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is PathfindingBlockSuccess) return false

        if (blocks != other.blocks) return false
        if (routes != other.routes) return false
        if (trackSectionRanges != other.trackSectionRanges) return false
        if (length != other.length) return false
        if (pathItemPositions != other.pathItemPositions) return false

        return true
    }

    override fun hashCode(): Int {
        return Objects.hash(blocks, routes, trackSectionRanges, length, pathItemPositions)
    }
}

class NotFoundInBlocks(
    @Json(name = "track_section_ranges") val trackSectionRanges: List<DirectionalTrackRange>,
    val length: Length<Path>,
) : PathfindingBlockResponse

class NotFoundInRoutes(
    @Json(name = "track_section_ranges") val trackSectionRanges: List<DirectionalTrackRange>,
    val length: Length<Path>,
) : PathfindingBlockResponse

class NotFoundInTracks : PathfindingBlockResponse

class IncompatibleConstraintsPathResponse(
    @Json(name = "relaxed_constraints_path") val relaxedConstraintsPath: PathfindingBlockSuccess,
    @Json(name = "incompatible_constraints") val incompatibleConstraints: IncompatibleConstraints
) : PathfindingBlockResponse

data class IncompatibleConstraints(
    @Json(name = "incompatible_electrification_ranges")
    val incompatibleElectrificationRanges: List<RangeValue<String>>,
    @Json(name = "incompatible_gauge_ranges") val incompatibleGaugeRanges: List<RangeValue<String>>,
    @Json(name = "incompatible_signaling_system_ranges")
    val incompatibleSignalingSystemRanges: List<RangeValue<String>>
)

data class RangeValue<T>(val range: Range<TravelledPath>, val value: T?) {
    @FromJson
    fun fromJson(range: Range<TravelledPath>): RangeValue<T> {
        return RangeValue(range, null)
    }
}

class PathfindingFailed(
    @Json(name = "core_error") val coreError: OSRDError,
) : PathfindingBlockResponse

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
