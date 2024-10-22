package fr.sncf.osrd.api.api_v2.pathfinding

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.api_v2.TrackLocation
import fr.sncf.osrd.api.pathfinding.*
import fr.sncf.osrd.api.pathfinding.constraints.*
import fr.sncf.osrd.graph.*
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.graph.Pathfinding.EdgeRange
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.stdcm.graph.extendLookaheadUntil
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorer
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.time.Duration
import java.time.Instant
import java.util.*
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus

/**
 * Exception used to wrap the response when we can't find a path. We do want to interrupt the
 * process so an exception is relevant, but it's local to this file because the response should be a
 * 200
 */
class NoPathFoundException(val response: PathfindingBlockResponse) : Exception()

val pathfindingLogger: Logger = LoggerFactory.getLogger("Pathfinding")

class PathfindingBlocksEndpointV2(private val infraManager: InfraManager) : Take {

    override fun act(req: Request): Response {
        val recorder = DiagnosticRecorderImpl(false)
        return try {
            val body = RqPrint(req).printBody()
            val request =
                pathfindingRequestAdapter.fromJson(body)
                    ?: return RsWithStatus(RsText("Missing request body"), 400)
            // Load infra
            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)
            val res = runPathfinding(infra, request)
            pathfindingLogger.info("Success")
            RsJson(RsWithBody(pathfindingResponseAdapter.toJson(res)))
        } catch (error: NoPathFoundException) {
            pathfindingLogger.info("No path found")
            RsJson(RsWithBody(pathfindingResponseAdapter.toJson(error.response)))
        } catch (ex: Throwable) {
            if (ex is OSRDError && ex.osrdErrorType.isCacheable) {
                pathfindingLogger.info("Pathfinding failed: ${ex.message}")
                val response = PathfindingFailed(ex)
                RsJson(RsWithBody(pathfindingResponseAdapter.toJson(response)))
            }
            ExceptionHandler.handle(ex)
        }
    }
}

/** Runs the pathfinding with the infra and request already parsed */
@Throws(OSRDError::class)
fun runPathfinding(
    infra: FullInfra,
    request: PathfindingBlockRequest,
): PathfindingBlockResponse {
    // Parse the waypoints
    val waypoints = ArrayList<Collection<PathfindingEdgeLocationId<Block>>>()
    for (step in request.pathItems) {
        val allStarts = HashSet<PathfindingEdgeLocationId<Block>>()
        for (direction in Direction.entries) {
            for (waypoint in step) allStarts.addAll(findWaypointBlocks(infra, waypoint, direction))
        }
        waypoints.add(allStarts)
    }
    if (waypoints.size < 2) throw NoPathFoundException(NotEnoughPathItems())
    val constraints =
        initConstraintsFromRSProps(
            infra,
            request.rollingStockIsThermal,
            request.rollingStockLoadingGauge,
            request.rollingStockSupportedElectrifications,
            request.rollingStockSupportedSignalingSystems,
        )

    val heuristics =
        makeHeuristicsForPathfindingEdges(infra, waypoints, request.rollingStockMaximumSpeed)

    // Compute the paths from the entry waypoint to the exit waypoint
    val path = computePaths(infra, waypoints, constraints, heuristics, request, request.timeout)
    return runPathfindingPostProcessing(infra, request, path)
}

private fun initConstraintsFromRSProps(
    infra: FullInfra,
    rollingStockIsThermal: Boolean,
    rollingStockLoadingGauge: RJSLoadingGaugeType,
    rollingStockSupportedElectrification: List<String>,
    rollingStockSupportedSignalingSystems: List<String>
): List<PathfindingConstraint<Block>> {
    val res = mutableListOf<PathfindingConstraint<Block>>()
    if (!rollingStockIsThermal) {
        res.add(
            ElectrificationConstraints(
                infra.blockInfra,
                infra.rawInfra,
                rollingStockSupportedElectrification
            )
        )
    }
    res.add(LoadingGaugeConstraints(infra.blockInfra, infra.rawInfra, rollingStockLoadingGauge))
    val sigSystemIds =
        rollingStockSupportedSignalingSystems.mapNotNull {
            infra.signalingSimulator.sigModuleManager.findSignalingSystem(it)
        }
    res.add(SignalingSystemConstraints(infra.blockInfra, listOf(sigSystemIds)))
    return res
}

@Throws(OSRDError::class)
private fun computePaths(
    infra: FullInfra,
    waypoints: ArrayList<Collection<PathfindingEdgeLocationId<Block>>>,
    constraints: List<PathfindingConstraint<Block>>,
    remainingDistanceEstimators: List<AStarHeuristic<PathfindingEdge, Block>>,
    initialRequest: PathfindingBlockRequest,
    timeout: Double?,
): PathfindingResultId<Block> {
    val start = Instant.now()
    val mrspBuilder =
        CachedBlockMRSPBuilder(
            infra.rawInfra,
            infra.blockInfra,
            initialRequest.rollingStockMaximumSpeed,
            initialRequest.rollingStockLength
        )
    val constraintCombiner = ConstraintCombiner(constraints.toMutableList())
    val pathFound =
        Pathfinding(PathfindingGraph())
            .setTimeout(timeout)
            .setEdgeToLength { edge -> Offset(edge.length.distance) }
            .setRangeCost { range ->
                mrspBuilder.getBlockTime(range.edge.block, Offset(range.end.distance)) -
                    mrspBuilder.getBlockTime(range.edge.block, Offset(range.start.distance))
            }
            .setRemainingDistanceEstimator(remainingDistanceEstimators)
            .runPathfinding(
                getStartLocations(
                    infra.rawInfra,
                    infra.blockInfra,
                    waypoints,
                    listOf(constraintCombiner)
                ),
                getTargetsOnEdges(waypoints)
            )

    if (pathFound != null) {
        pathfindingLogger.info("Path found, start postprocessing")
        return makeBlockPath(pathFound)!!
    }

    // Handling errors
    // Check if pathfinding failed due to incompatible constraints
    pathfindingLogger.info("No path found, identifying issues")
    val elapsedSeconds = Duration.between(start, Instant.now()).toSeconds()
    throwNoPathFoundException(
        infra,
        waypoints,
        constraints,
        mrspBuilder,
        remainingDistanceEstimators,
        initialRequest,
        timeout?.minus(elapsedSeconds)
    )
}

private fun getStartLocations(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    waypoints: ArrayList<Collection<PathfindingEdgeLocationId<Block>>>,
    constraints: List<PathfindingConstraint<Block>>,
): Collection<EdgeLocation<PathfindingEdge, Block>> {
    val res = mutableListOf<EdgeLocation<PathfindingEdge, Block>>()
    val firstStep = waypoints[0]
    val stops = listOf(waypoints.last())
    for (location in firstStep) {
        val infraExplorers = initInfraExplorer(rawInfra, blockInfra, location, stops, constraints)
        val extended = infraExplorers.flatMap { extendLookaheadUntil(it, 1) }
        for (explorer in extended) {
            val edge = PathfindingEdge(explorer)
            res.add(EdgeLocation(edge, location.offset))
        }
    }
    return res
}

private fun getTargetsOnEdges(
    waypoints: ArrayList<Collection<PathfindingEdgeLocationId<Block>>>,
): List<TargetsOnEdge<PathfindingEdge, Block>> {
    val targetsOnEdges = ArrayList<TargetsOnEdge<PathfindingEdge, Block>>()
    for (i in 1 until waypoints.size) {
        targetsOnEdges.add { edge: PathfindingEdge ->
            val res = HashSet<EdgeLocation<PathfindingEdge, Block>>()
            for (target in waypoints[i]) {
                if (target.edge == edge.block) res.add(EdgeLocation(edge, target.offset))
            }
            res
        }
    }
    return targetsOnEdges
}

private fun throwNoPathFoundException(
    infra: FullInfra,
    waypoints: ArrayList<Collection<PathfindingEdgeLocationId<Block>>>,
    constraints: Collection<PathfindingConstraint<Block>>,
    mrspBuilder: CachedBlockMRSPBuilder,
    remainingDistanceEstimators: List<AStarHeuristic<PathfindingEdge, Block>>,
    initialRequest: PathfindingBlockRequest,
    timeout: Double?
): Nothing {
    try {
        val possiblePathWithoutErrorNoConstraints =
            Pathfinding(PathfindingGraph())
                .setTimeout(timeout)
                .setEdgeToLength { edge -> Offset(edge.length.distance) }
                .setRangeCost { range ->
                    mrspBuilder.getBlockTime(range.edge.block, Offset(range.end.distance)) -
                        mrspBuilder.getBlockTime(range.edge.block, Offset(range.start.distance))
                }
                .setRemainingDistanceEstimator(remainingDistanceEstimators)
                .runPathfinding(
                    getStartLocations(infra.rawInfra, infra.blockInfra, waypoints, listOf()),
                    getTargetsOnEdges(waypoints)
                )
        val incompatibleConstraintsResponse =
            buildIncompatibleConstraintsResponse(
                infra,
                makeBlockPath(possiblePathWithoutErrorNoConstraints),
                constraints,
                initialRequest
            )
        if (incompatibleConstraintsResponse != null) {
            throw NoPathFoundException(incompatibleConstraintsResponse)
        }
    } catch (error: OSRDError) {
        if (error.osrdErrorType == ErrorType.PathfindingTimeoutError) {
            throw OSRDError(ErrorType.PathfindingRelaxedPathTimeoutError)
        }
        throw error
    }
    // It didn’t fail due to an incompatible constraint, no path exists
    throw NoPathFoundException(NotFoundInBlocks(listOf(), Length(0.meters)))
}

private fun makeBlockPath(
    path: Pathfinding.Result<PathfindingEdge, Block>?
): PathfindingResultId<Block>? {
    if (path == null) return null
    return Pathfinding.Result(
        path.ranges.map { EdgeRange(it.edge.block, it.start, it.end) },
        path.waypoints.map { EdgeLocation(it.edge.block, it.offset) }
    )
}

/**
 * Returns all the EdgeLocations of a waypoint.
 *
 * @param infra full infra.
 * @param waypoint corresponding waypoint.
 * @return corresponding edge location, containing a block id and its offset from the waypoint.
 */
fun findWaypointBlocks(
    infra: FullInfra,
    waypoint: TrackLocation,
    direction: Direction,
): Set<PathfindingEdgeLocationId<Block>> {
    val res = HashSet<PathfindingEdgeLocationId<Block>>()
    val trackSectionId =
        infra.rawInfra.getTrackSectionFromName(waypoint.track)
            ?: throw OSRDError.newUnknownTrackSectionError(waypoint.track)
    val trackChunkOnWaypoint =
        getTrackSectionChunkOnWaypoint(trackSectionId, waypoint.offset, infra.rawInfra)
    val blocksOnWaypoint =
        infra.blockInfra.getBlocksFromTrackChunk(trackChunkOnWaypoint, direction).toSet()
    for (block in blocksOnWaypoint) {
        val offset =
            getBlockOffset(
                block,
                trackChunkOnWaypoint,
                trackSectionId,
                waypoint.offset,
                direction,
                infra
            )
        assert(offset <= infra.blockInfra.getBlockLength(block))
        res.add(EdgeLocation(block, offset))
    }
    return res
}

private fun getTrackSectionChunkOnWaypoint(
    trackSectionId: TrackSectionId,
    waypointOffset: Offset<TrackSection>,
    rawInfra: RawSignalingInfra
): TrackChunkId {
    val trackSectionChunks = rawInfra.getTrackSectionChunks(trackSectionId)
    return trackSectionChunks.firstOrNull { chunk: TrackChunkId ->
        val startChunk = rawInfra.getTrackChunkOffset(chunk)
        val endChunk = startChunk + rawInfra.getTrackChunkLength(chunk).distance
        waypointOffset in startChunk..endChunk
    }
        ?: throw OSRDError(ErrorType.InvalidWaypointLocation)
            .withContext("track", rawInfra.getTrackSectionName(trackSectionId))
            .withContext("offset", waypointOffset)
}

private fun getBlockOffset(
    blockId: BlockId,
    trackChunkId: TrackChunkId,
    trackSectionId: TrackSectionId,
    waypointOffset: Offset<TrackSection>,
    direction: Direction,
    infra: FullInfra
): Offset<Block> {
    val trackSectionLength = infra.rawInfra.getTrackSectionLength(trackSectionId)
    val trackChunkOffset = infra.rawInfra.getTrackChunkOffset(trackChunkId)
    val trackChunkLength = infra.rawInfra.getTrackChunkLength(trackChunkId)
    val dirTrackChunkOffset =
        if (direction == Direction.INCREASING) trackChunkOffset.distance
        else trackSectionLength.distance - trackChunkOffset.distance - trackChunkLength.distance
    val dirWaypointOffset =
        if (direction == Direction.INCREASING) waypointOffset
        else Offset(trackSectionLength - waypointOffset)
    var startBlockToStartChunk = 0.meters
    val blockTrackChunks = infra.blockInfra.getTrackChunksFromBlock(blockId)
    for (blockTrackChunkDirId in blockTrackChunks) {
        val blockTrackChunkId = blockTrackChunkDirId.value
        if (blockTrackChunkId == trackChunkId) {
            return Offset(
                (startBlockToStartChunk + dirWaypointOffset.distance - dirTrackChunkOffset)
                    .absoluteValue
            )
        }
        startBlockToStartChunk += infra.rawInfra.getTrackChunkLength(blockTrackChunkId).distance
    }
    throw AssertionError(
        String.format("getBlockOffset: Track chunk %s not in block %s", trackChunkId, blockId)
    )
}
