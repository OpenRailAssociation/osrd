package fr.sncf.osrd.api.api_v2.pathfinding

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.TrackRange
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

interface PathfindingBlockResponse

class PathfindingBlockSuccess(
    // Block ids
    val blocks: List<String>,

    // Route ids
    val routes: List<String>,
    @Json(name = "track_section_ranges") val trackSectionRanges: List<TrackRange>,
    val length: Length<Path>,

    /** Offsets of the waypoints given as input */
    @Json(name = "path_item_positions") val pathItemPositions: List<Offset<Path>>
) : PathfindingBlockResponse

class NotFoundInBlocks(
    @Json(name = "track_section_ranges") val trackSectionRanges: List<TrackRange>,
    val length: Length<Path>,
) : PathfindingBlockResponse

class NotFoundInRoutes(
    @Json(name = "track_section_ranges") val trackSectionRanges: List<TrackRange>,
    val length: Length<Path>,
) : PathfindingBlockResponse

class NotFoundInTracks : PathfindingBlockResponse

open class IncompatibleConstraint(
    val blocks: List<String>,
    val routes: List<String>,
    @Json(name = "track_section_ranges") val trackSectionRanges: List<TrackRange>,
    val length: Length<Path>,
    @Json(name = "incompatible_ranges")
    val incompatibleRanges: List<List<Offset<Path>>>, // List of pairs
) : PathfindingBlockResponse

class IncompatibleElectrification(
    blocks: List<String>,
    routes: List<String>,
    @Json(name = "track_section_ranges") trackSectionRanges: List<TrackRange>,
    length: Length<Path>,
    @Json(name = "incompatible_ranges")
    incompatibleRanges: List<List<Offset<Path>>> // List of pairs
) : IncompatibleConstraint(blocks, routes, trackSectionRanges, length, incompatibleRanges)

class IncompatibleLoadingGauge(
    blocks: List<String>,
    routes: List<String>,
    @Json(name = "track_section_ranges") trackSectionRanges: List<TrackRange>,
    length: Length<Path>,
    @Json(name = "incompatible_ranges")
    incompatibleRanges: List<List<Offset<Path>>> // List of pairs
) : IncompatibleConstraint(blocks, routes, trackSectionRanges, length, incompatibleRanges)

class IncompatibleSignalingSystem(
    blocks: List<String>,
    routes: List<String>,
    @Json(name = "track_section_ranges") trackSectionRanges: List<TrackRange>,
    length: Length<Path>,
    @Json(name = "incompatible_ranges")
    incompatibleRanges: List<List<Offset<Path>>> // List of pairs
) : IncompatibleConstraint(blocks, routes, trackSectionRanges, length, incompatibleRanges)

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
        .withSubtype(IncompatibleElectrification::class.java, "incompatible_electrification")
        .withSubtype(IncompatibleLoadingGauge::class.java, "incompatible_loading_gauge")
        .withSubtype(IncompatibleSignalingSystem::class.java, "incompatible_signaling_system")
        .withSubtype(NotEnoughPathItems::class.java, "not_enough_path_items")
        .withSubtype(PathfindingFailed::class.java, "pathfinding_failed")

val pathfindingResponseAdapter: JsonAdapter<PathfindingBlockResponse> =
    Moshi.Builder()
        .add(polymorphicPathfindingResponseAdapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(PathfindingBlockResponse::class.java)
