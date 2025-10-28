package fr.sncf.osrd.api.pathfinding

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraProvider
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.graph.*
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeRange
import fr.sncf.osrd.pathfinding.PathfindingEdge
import fr.sncf.osrd.pathfinding.PathfindingGraph
import fr.sncf.osrd.pathfinding.RemainingDistanceEstimator
import fr.sncf.osrd.pathfinding.constraints.ConstraintCombiner
import fr.sncf.osrd.pathfinding.constraints.initConstraintsFromRSProps
import fr.sncf.osrd.pathfinding.minDistanceBetweenSteps
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.extendLookaheadUntil
import fr.sncf.osrd.stdcm.infra_exploration.initInfraExplorer
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.SpanKind
import io.opentelemetry.instrumentation.annotations.WithSpan
import java.io.File
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
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

class PathfindingBlocksEndpoint(private val infraManager: InfraProvider) : Take {
    override fun act(req: Request): Response {
        val body = RqPrint(req).printBody()
        val request =
            pathfindingRequestAdapter.fromJson(body)
                ?: return RsWithStatus(RsText("Missing request body"), 400)

        val logRequest = System.getenv("LOG_PATHFINDING_REQUESTS")
        if (logRequest?.equals("true", ignoreCase = true) == true) {
            val time = LocalDateTime.now()
            val formatted = time.format(DateTimeFormatter.ofPattern("MM-dd-HH:mm:ss:SSS"))
            val filename = "pathfinding-$formatted.json"
            Span.current()?.setAttribute("request-file", filename)
            File(filename).printWriter().use {
                it.println(pathfindingRequestAdapter.indent("    ").toJson(request))
            }
        }

        return run(request)
    }

    @WithSpan(value = "Processing pathfinding request", kind = SpanKind.SERVER)
    fun run(request: PathfindingBlockRequest): Response {
        try {
            // Load infra
            val infra = infraManager.getInfra(request.infra, request.expectedVersion)
            val res = runPathfinding(infra, request)
            pathfindingLogger.info("Success")
            return RsJson(RsWithBody(pathfindingResponseAdapter.toJson(res)))
        } catch (error: NoPathFoundException) {
            pathfindingLogger.info("No path found")
            return RsJson(RsWithBody(pathfindingResponseAdapter.toJson(error.response)))
        } catch (ex: Throwable) {
            if (ex is OSRDError && ex.osrdErrorType.isRecoverable) {
                pathfindingLogger.info("Pathfinding failed: ${ex.message}")
                val response = PathfindingFailed(ex)
                return RsJson(RsWithBody(pathfindingResponseAdapter.toJson(response)))
            }
            return ExceptionHandler.handle(ex)
        }
    }
}

/** Runs the pathfinding with the infra and request already parsed */
@Throws(OSRDError::class)
fun runPathfinding(infra: FullInfra, request: PathfindingBlockRequest): PathfindingBlockResponse {
    // Parse the waypoints
    val waypoints = ArrayList<Collection<EdgeLocation<BlockId, Block>>>()
    for (step in request.pathItems) {
        val allStarts = HashSet<EdgeLocation<BlockId, Block>>()
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

@Throws(OSRDError::class)
private fun computePaths(
    infra: FullInfra,
    waypoints: ArrayList<Collection<EdgeLocation<BlockId, Block>>>,
    constraints: List<PathfindingConstraint<Block>>,
    remainingDistanceEstimators: List<AStarHeuristic<PathfindingEdge, Block>>,
    initialRequest: PathfindingBlockRequest,
    timeout: Double?,
): ProcessedPathfindingResponse {
    val start = Instant.now()
    val mrspBuilder =
        CachedBlockMRSPBuilder(
            infra.rawInfra,
            infra.blockInfra,
            initialRequest.rollingStockMaximumSpeed,
            initialRequest.rollingStockLength,
            initialRequest.speedLimitTag,
        )
    val constraintCombiner = ConstraintCombiner(constraints.toMutableList())

    val pathFound =
        Pathfinding(PathfindingGraph())
            .setTimeout(timeout)
            .setEdgeToLength { it.length }
            .setRangeCost { getRangeCost(it, mrspBuilder, infra) }
            .setRemainingDistanceEstimator(remainingDistanceEstimators)
            .setComparisonFallback { a, b -> a.block.index.compareTo(b.block.index) }
            .runPathfinding(
                getStartLocations(
                    infra.rawInfra,
                    infra.blockInfra,
                    waypoints,
                    listOf(constraintCombiner),
                ),
                getTargetsOnEdges(waypoints),
            )

    if (pathFound != null) {
        pathfindingLogger.info("Path found, start postprocessing")
        val res = processPathfindingResponse(infra, pathFound)
        if (!hasDuplicateTracks(infra, res.path)) return res
        else pathfindingLogger.info("Path has duplicate tracks, dismissing")
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
        timeout?.minus(elapsedSeconds),
    )
}

/**
 * Return true if the path contains a duplicated track. This kind of path is not supported by OSRD
 * yet.
 */
fun hasDuplicateTracks(infra: FullInfra, path: TrainPath): Boolean {
    val tracks =
        path
            .getChunks()
            .map { it.value }
            .map { infra.rawInfra.getTrackFromChunk(it.value) }
            .withoutConsecutiveDuplicates()
    return tracks.toSet().size < tracks.size
}

const val SIGNALING_SYSTEM_COST_WEIGHTING = 1e-2

private fun getRangeCost(
    range: EdgeRange<PathfindingEdge, Block>,
    mrspBuilder: CachedBlockMRSPBuilder,
    infra: FullInfra,
): Double {
    val edgeDuration =
        mrspBuilder.getBlockTime(range.edge.block, Offset(range.end.distance)) -
            mrspBuilder.getBlockTime(range.edge.block, Offset(range.start.distance))
    val signalingSystemPenaltyFactor =
        SIGNALING_SYSTEM_COST_WEIGHTING *
            infra.signalingSimulator.sigModuleManager.getCost(
                infra.blockInfra.getBlockSignalingSystem(range.edge.block)
            )
    return (edgeDuration) * (1 + signalingSystemPenaltyFactor)
}

private fun getStartLocations(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    waypoints: ArrayList<Collection<EdgeLocation<BlockId, Block>>>,
    constraints: List<PathfindingConstraint<Block>>,
): Collection<EdgeLocation<PathfindingEdge, Block>> {
    val res = mutableListOf<EdgeLocation<PathfindingEdge, Block>>()
    val firstStep = waypoints[0]
    val steps = waypoints.map { STDCMStep(it) }
    for (location in firstStep) {
        val infraExplorers =
            initInfraExplorer(
                rawInfra,
                blockInfra,
                location,
                steps = steps,
                constraints = constraints,
            )
        val extended = infraExplorers.flatMap { extendLookaheadUntil(it, 1) }
        for (explorer in extended) {
            val edge = PathfindingEdge(explorer)
            res.add(EdgeLocation(edge, location.offset))
        }
    }
    return res
}

private fun getTargetsOnEdges(
    waypoints: ArrayList<Collection<EdgeLocation<BlockId, Block>>>
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

@WithSpan(value = "Identifying why no path was found")
private fun throwNoPathFoundException(
    infra: FullInfra,
    waypoints: ArrayList<Collection<EdgeLocation<BlockId, Block>>>,
    constraints: Collection<PathfindingConstraint<Block>>,
    mrspBuilder: CachedBlockMRSPBuilder,
    remainingDistanceEstimators: List<AStarHeuristic<PathfindingEdge, Block>>,
    initialRequest: PathfindingBlockRequest,
    timeout: Double?,
): Nothing {
    try {
        val possiblePathWithoutErrorNoConstraints =
            Pathfinding(PathfindingGraph())
                .setTimeout(timeout)
                .setEdgeToLength { it.length }
                .setRangeCost { range ->
                    mrspBuilder.getBlockTime(range.edge.block, Offset(range.end.distance)) -
                        mrspBuilder.getBlockTime(range.edge.block, Offset(range.start.distance))
                }
                .setRemainingDistanceEstimator(remainingDistanceEstimators)
                .runPathfinding(
                    getStartLocations(infra.rawInfra, infra.blockInfra, waypoints, listOf()),
                    getTargetsOnEdges(waypoints),
                )
        if (possiblePathWithoutErrorNoConstraints != null) {
            buildIncompatibleConstraintsResponse(
                    infra,
                    processPathfindingResponse(infra, possiblePathWithoutErrorNoConstraints),
                    constraints,
                    initialRequest,
                )
                ?.let { throw NoPathFoundException(it) }
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

data class ProcessedPathfindingResponse(val path: TrainPath, val offsets: List<Offset<TrainPath>>)

private fun processPathfindingResponse(
    infra: FullInfra,
    path: Pathfinding.Result<PathfindingEdge, Block>,
): ProcessedPathfindingResponse {
    val explorer = path.ranges.last().edge.infraExplorer
    val trainPath = explorer.buildFullPath(infra.rawInfra, infra.blockInfra)
    val stepOffsets = explorer.getStepTracker().getSeenSteps().map { it.travelledPathOffset }
    return ProcessedPathfindingResponse(trainPath, stepOffsets)
}

private fun makeBlockPath(
    path: Pathfinding.Result<PathfindingEdge, Block>?
): Pathfinding.Result<BlockId, Block>? {
    if (path == null) return null
    return Pathfinding.Result(
        path.ranges.map { EdgeRange(it.edge.block, it.start, it.end) },
        path.waypoints.map { EdgeLocation(it.edge.block, it.offset) },
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
): Set<EdgeLocation<BlockId, Block>> {
    val res = HashSet<EdgeLocation<BlockId, Block>>()
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
                infra,
            )
        assert(offset <= infra.blockInfra.getBlockLength(block))
        res.add(EdgeLocation(block, offset))
    }
    return res
}

private fun getTrackSectionChunkOnWaypoint(
    trackSectionId: TrackSectionId,
    waypointOffset: Offset<TrackSection>,
    rawInfra: RawSignalingInfra,
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
    infra: FullInfra,
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

@WithSpan(value = "Building heuristic")
private fun makeHeuristicsForPathfindingEdges(
    infra: FullInfra,
    waypoints: List<Collection<EdgeLocation<BlockId, Block>>>,
    rollingStockMaxSpeed: Double,
): ArrayList<AStarHeuristic<PathfindingEdge, Block>> {
    // Compute the minimum distance between steps
    val stepMinDistance = Array(waypoints.size - 1) { 0.meters }
    for (i in 0 until waypoints.size - 2) {
        stepMinDistance[i] =
            minDistanceBetweenSteps(
                infra.blockInfra,
                infra.rawInfra,
                waypoints[i + 1],
                waypoints[i + 2],
            )
    }

    // Reversed cumulative sum
    for (i in stepMinDistance.size - 2 downTo 0) {
        stepMinDistance[i] += stepMinDistance[i + 1]
    }

    // Setup estimators foreach intermediate steps
    val remainingDistanceEstimators = ArrayList<AStarHeuristic<PathfindingEdge, Block>>()
    for (i in 0 until waypoints.size - 1) {
        val remainingDistanceEstimator =
            RemainingDistanceEstimator(
                infra.blockInfra,
                infra.rawInfra,
                waypoints[i + 1],
                stepMinDistance[i],
            )

        // Now that the cost function is an approximation of the remaining time,
        // we need to return the smallest possible remaining time here
        remainingDistanceEstimators.add { edge, offset ->
            remainingDistanceEstimator.apply(edge.block, offset).meters / rollingStockMaxSpeed
        }
    }
    return remainingDistanceEstimators
}
