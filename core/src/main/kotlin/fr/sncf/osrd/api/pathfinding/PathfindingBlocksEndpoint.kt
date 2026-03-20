package fr.sncf.osrd.api.pathfinding

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraProvider
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.cli.Request
import fr.sncf.osrd.cli.Response
import fr.sncf.osrd.cli.RsJson
import fr.sncf.osrd.cli.RsText
import fr.sncf.osrd.cli.RsWithBody
import fr.sncf.osrd.cli.RsWithStatus
import fr.sncf.osrd.cli.Take
import fr.sncf.osrd.cli.allNodeStats
import fr.sncf.osrd.cli.foo
import fr.sncf.osrd.graph.*
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.pathfinding.BlockLocation
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeRange
import fr.sncf.osrd.pathfinding.PathfindingEdge
import fr.sncf.osrd.pathfinding.PathfindingGraph
import fr.sncf.osrd.pathfinding.RemainingDistanceEstimator
import fr.sncf.osrd.pathfinding.constraints.ConstraintCombiner
import fr.sncf.osrd.pathfinding.constraints.initConstraintsFromRSProps
import fr.sncf.osrd.pathfinding.getStartLocations
import fr.sncf.osrd.pathfinding.getTargetsOnEdges
import fr.sncf.osrd.pathfinding.minDistanceBetweenSteps
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
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

/**
 * Exception used to wrap the response when we can't find a path. We do want to interrupt the
 * process so an exception is relevant, but it's local to this file because the response should be a
 * 200
 */
class NoPathFoundException(val response: PathfindingBlockResponse) : Exception()

val pathfindingLogger: Logger = LoggerFactory.getLogger("Pathfinding")

class PathfindingBlocksEndpoint(private val infraManager: InfraProvider) : Take {
    override fun act(req: Request): Response {
        val body = req.body()
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
    val waypoints = ArrayList<Collection<BlockLocation>>()
    val destinationTrack = request.pathItems.last()
    val destinationBlock = findWaypointBlocks(infra, destinationTrack)
    request.pathItems.forEachIndexed { stepIndex, step ->
        val allStarts = HashSet<BlockLocation>()
        for (direction in Direction.entries) {
            for (waypoint in step) {
                val waypointBlocks = findDirectedWaypointBlocks(infra, waypoint, direction)
                if (
                    request.stopsAtEndOfBlock == true &&
                        stepIndex != 0 &&
                        stepIndex != request.pathItems.size - 1
                ) {
                    allStarts.addAll(
                        waypointBlocks.map {
                            findStopPositionAtEndOfBlockConsideringRollingStock(
                                it,
                                destinationBlock,
                                request.rollingStockLength,
                                infra,
                            )
                        }
                    )
                } else {
                    allStarts.addAll(waypointBlocks)
                }
            }
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

    if (allNodeStats.isEmpty()) foo(infra.rawInfra, infra.blockInfra)
    for (zonePathRange in path.path.getZonePaths()) {
        val nodes = infra.rawInfra.getZonePathMovableElements(zonePathRange.value)
        val configs = infra.rawInfra.getZonePathMovableElementsConfigs(zonePathRange.value)
        for ((node, config) in nodes zip configs) {
            allNodeStats[node]?.register(config)
        }
    }

    return runPathfindingPostProcessing(infra, request, path)
}

@Throws(OSRDError::class)
private fun computePaths(
    infra: FullInfra,
    waypoints: ArrayList<Collection<BlockLocation>>,
    constraints: List<PathfindingConstraint<Block>>,
    remainingDistanceEstimators: List<AStarHeuristic<PathfindingEdge>>,
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
const val COST_PER_TRACK_CHANGE = 10.0

private fun getRangeCost(
    range: EdgeRange<PathfindingEdge>,
    mrspBuilder: CachedBlockMRSPBuilder,
    infra: FullInfra,
): Double {
    val trackNumbers =
        infra.blockInfra
            .getBlockZonePaths(range.edge.block)
            .flatMap { infra.rawInfra.getZonePathChunks(it) }
            .map { infra.rawInfra.getTrackChunkTrackNumber(it.value) }
            .withoutConsecutiveDuplicates()
    val trackChanges = trackNumbers.size - 1
    val edgeDuration =
        mrspBuilder.getBlockTime(range.edge.block, range.end) -
            mrspBuilder.getBlockTime(range.edge.block, range.start)
    val signalingSystemPenaltyFactor =
        SIGNALING_SYSTEM_COST_WEIGHTING *
            infra.signalingSimulator.sigModuleManager.getCost(
                infra.blockInfra.getBlockSignalingSystem(range.edge.block)
            )
    return (edgeDuration) * (1 + signalingSystemPenaltyFactor) +
        COST_PER_TRACK_CHANGE * trackChanges
}

@WithSpan(value = "Identifying why no path was found")
private fun throwNoPathFoundException(
    infra: FullInfra,
    waypoints: ArrayList<Collection<BlockLocation>>,
    constraints: Collection<PathfindingConstraint<Block>>,
    mrspBuilder: CachedBlockMRSPBuilder,
    remainingDistanceEstimators: List<AStarHeuristic<PathfindingEdge>>,
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

data class ProcessedPathfindingResponse(val path: TrainPath, val offsets: List<Offset<PhysicsPath>>)

private fun processPathfindingResponse(
    infra: FullInfra,
    path: Pathfinding.Result<PathfindingEdge>,
): ProcessedPathfindingResponse {
    val explorer = path.ranges.last().edge.infraExplorer
    val trainPath = explorer.buildFullPath(infra.rawInfra, infra.blockInfra)
    val stepOffsets = explorer.getStepTracker().getSeenSteps().map { it.travelledPathOffset }
    return ProcessedPathfindingResponse(trainPath, stepOffsets)
}

/**
 * Returns all the EdgeLocations of a waypoint.
 *
 * @param infra full infra.
 * @param waypoint corresponding waypoint.
 * @return corresponding edge location, containing a block id and its offset from the waypoint.
 */
fun findDirectedWaypointBlocks(
    infra: FullInfra,
    waypoint: TrackLocation,
    direction: Direction,
): Set<BlockLocation> {
    val res = HashSet<BlockLocation>()
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
        res.add(BlockLocation(block, offset))
    }
    return res
}

fun findWaypointBlocks(infra: FullInfra, waypoints: Collection<TrackLocation>): Set<BlockLocation> {
    val waypointBlocks = HashSet<BlockLocation>()
    for (waypoint in waypoints) {
        for (direction in Direction.entries) {
            waypointBlocks.addAll(findDirectedWaypointBlocks(infra, waypoint, direction))
        }
    }
    return waypointBlocks
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
    waypoints: List<Collection<BlockLocation>>,
    rollingStockMaxSpeed: Double,
): ArrayList<AStarHeuristic<PathfindingEdge>> {
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
    val remainingDistanceEstimators = ArrayList<AStarHeuristic<PathfindingEdge>>()
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

/**
 * Given a waypoint block (initial position of a train stop), returns the new stop position of a
 * train: end of current block, with the constraints of staying in the same block and keeping the
 * tail of the train on the initial position (waypointBlock). Note that nodes of the infra are not
 * considered.
 */
fun findStopPositionAtEndOfBlockConsideringRollingStock(
    waypointBlock: BlockLocation,
    destinationBlock: Set<BlockLocation>,
    rollingStockLength: Double,
    infra: FullInfra,
): BlockLocation {
    // To ensure that the tail of the rolling stock is not further than the initial operational
    // point (waypointBlock) position
    val maxTailOffset = waypointBlock.offset + rollingStockLength.meters

    // Can't go further than the end of the block, which is delimited by a block-delimiting signal
    val maxHeadOffset = infra.blockInfra.getBlockLength(waypointBlock.edge)

    val newWaypointOffset = Offset.min(maxTailOffset, maxHeadOffset)

    val destinationOffset =
        destinationBlock
            .filter { it.edge == waypointBlock.edge && waypointBlock.offset <= it.offset }
            .minOfOrNull { it.offset }

    // The waypoint offset does not change in the case where the stop is after the destination
    if (destinationOffset != null && destinationOffset <= newWaypointOffset)
        return BlockLocation(waypointBlock.edge, waypointBlock.offset)

    return BlockLocation(waypointBlock.edge, newWaypointOffset)
}
