package fr.sncf.osrd.api.pathfinding

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraProvider
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.api.stdcm.parseTrackSectionIds
import fr.sncf.osrd.cli.Request
import fr.sncf.osrd.cli.Response
import fr.sncf.osrd.cli.RsJson
import fr.sncf.osrd.cli.RsText
import fr.sncf.osrd.cli.RsWithBody
import fr.sncf.osrd.cli.RsWithStatus
import fr.sncf.osrd.cli.Take
import fr.sncf.osrd.graph.*
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.pathfinding.constraints.initConstraintsFromRSProps
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.toDirected
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
    override fun act(req: Request, ctx: Take.QueueContext?): Response {
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
            pathfindingLogger.info("Pathfinding failed: ${ex.message}")
            return ExceptionHandler.handle(ex)
        }
    }
}

/** Runs the pathfinding with the infra and request already parsed */
@Throws(OSRDError::class)
fun runPathfinding(infra: FullInfra, request: PathfindingBlockRequest): PathfindingBlockResponse {
    // Parse the waypoints
    val targets = ArrayList<ExplorerStep>()
    val destinationTrack = request.pathItems.last()
    val destinationBlock = findWaypointBlocks(infra, destinationTrack.locations)
    request.pathItems.forEachIndexed { stepIndex, step ->
        val allStarts = HashSet<BlockLocation>()
        for (direction in Direction.entries) {
            for (waypoint in step.locations) {
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
        targets.add(ExplorerStep(allStarts, canBacktrack = step.canBacktrack))
    }
    if (targets.size < 2) throw NoPathFoundException(NotEnoughPathItems())
    val allowedTrackSectionIds = parseTrackSectionIds(infra, request.allowedTrackSections)
    val constraints =
        initConstraintsFromRSProps(
            infra,
            request.rollingStockIsThermal,
            request.rollingStockLoadingGauge,
            request.rollingStockSupportedElectrifications,
            request.rollingStockSupportedSignalingSystems,
            allowedTrackSectionIds,
        )

    // Compute the paths from the entry waypoint to the exit waypoint
    val timeout = request.timeout ?: Pathfinding.TIMEOUT
    val path = computePaths(infra, targets, constraints, request, timeout)
    return runPathfindingPostProcessing(infra, request, path)
}

@Throws(OSRDError::class)
private fun computePaths(
    infra: FullInfra,
    targets: ArrayList<ExplorerStep>,
    constraints: List<PathfindingConstraint>,
    initialRequest: PathfindingBlockRequest,
    timeout: Double,
): ProcessedPathfindingResponse {
    val start = Instant.now()
    val pathFound =
        Pathfinding(
                infra,
                targets,
                constraints,
                initialRequest.speedLimitTag,
                initialRequest.rollingStockMaximumSpeed,
                initialRequest.rollingStockLength.meters,
            )
            .runPathfinding()

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
    throw buildNoPathFoundException(
        infra,
        targets,
        constraints,
        initialRequest,
        timeout.minus(elapsedSeconds),
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
            .map { DirTrackSectionId(infra.rawInfra.getTrackFromChunk(it.value), it.direction) }
            .withoutConsecutiveDuplicates()
    return tracks.toSet().size < tracks.size
}

@WithSpan(value = "Identifying why no path was found")
private fun buildNoPathFoundException(
    infra: FullInfra,
    targets: ArrayList<ExplorerStep>,
    constraints: Collection<PathfindingConstraint>,
    initialRequest: PathfindingBlockRequest,
    timeout: Double,
): NoPathFoundException {
    try {
        val possiblePathWithoutErrorNoConstraints =
            Pathfinding(
                    infra,
                    targets,
                    listOf(),
                    initialRequest.speedLimitTag,
                    initialRequest.rollingStockMaximumSpeed,
                    initialRequest.rollingStockLength.meters,
                )
                .runPathfinding(timeout)
        if (possiblePathWithoutErrorNoConstraints != null) {
            buildIncompatibleConstraintsResponse(
                    infra,
                    processPathfindingResponse(infra, possiblePathWithoutErrorNoConstraints),
                    constraints,
                    initialRequest,
                )
                ?.let {
                    return NoPathFoundException(it)
                }
        }
    } catch (error: OSRDError) {
        if (error.osrdErrorType == ErrorType.PathfindingTimeoutError) {
            throw OSRDError(ErrorType.PathfindingRelaxedPathTimeoutError)
        }
        throw error
    }
    // It didn’t fail due to an incompatible constraint, no path exists
    return NoPathFoundException(NotFoundInBlocks(listOf(), Length(0.meters)))
}

data class ProcessedPathfindingResponse(
    val path: TrainPath,
    val waypointOffsets: List<Offset<PhysicsPath>>,
    val backtrackIndexes: List<Int>,
)

private fun processPathfindingResponse(
    infra: FullInfra,
    explorer: InfraExplorer,
): ProcessedPathfindingResponse {
    val trainPath = explorer.buildFullPath(infra.rawInfra, infra.blockInfra)
    val seenSteps = explorer.getStepTracker().getSeenSteps().toList()
    val stepOffsets = seenSteps.map { it.travelledPathOffset }
    val backtrackIndexes =
        seenSteps.mapIndexedNotNull { index, step -> if (step.isBacktracking) index else null }
    return ProcessedPathfindingResponse(trainPath, stepOffsets, backtrackIndexes)
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

    val chunkLocationOnWaypoint =
        getChunkLocationOnWaypoint(trackSectionId, waypoint.offset, infra.rawInfra)
    val chunkLength = infra.rawInfra.getTrackChunkLength(chunkLocationOnWaypoint.chunk)
    val directedChunkOffset = chunkLocationOnWaypoint.offset.toDirected(chunkLength, direction)
    val waypointDirChunkLocation =
        DirChunkLocation(
            DirTrackChunkId(chunkLocationOnWaypoint.chunk, direction),
            directedChunkOffset,
        )

    val blocksOnWaypoint =
        infra.blockInfra.getBlocksFromTrackChunk(chunkLocationOnWaypoint.chunk, direction).toSet()
    for (block in blocksOnWaypoint) {
        val offset =
            infra.blockInfra.getBlockOffset(block, waypointDirChunkLocation, infra.rawInfra)
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

private fun getChunkLocationOnWaypoint(
    trackSectionId: TrackSectionId,
    waypointOffset: Offset<TrackSection>,
    rawInfra: RawSignalingInfra,
): ChunkLocation {
    val trackSectionChunks = rawInfra.getTrackSectionChunks(trackSectionId)
    for (chunk in trackSectionChunks) {
        val startChunk = rawInfra.getTrackChunkOffset(chunk)
        val endChunk = startChunk + rawInfra.getTrackChunkLength(chunk).distance
        if (waypointOffset in startChunk..endChunk)
            return ChunkLocation(chunk, Offset(waypointOffset - startChunk))
    }
    throw OSRDError(ErrorType.InvalidWaypointLocation)
        .withContext("track", rawInfra.getTrackSectionName(trackSectionId))
        .withContext("offset", waypointOffset)
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
