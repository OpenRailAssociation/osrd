package fr.sncf.osrd.api.api_v2.pathfinding

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.api_v2.TrackLocation
import fr.sncf.osrd.api.pathfinding.constraints.*
import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.graph.*
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*
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

class PathfindingBlocksEndpointV2(private val infraManager: InfraManager) : Take {
    override fun act(req: Request): Response {
        val recorder = DiagnosticRecorderImpl(false)
        return try {
            val body = RqPrint(req).printBody()
            val request =
                pathfindingRequestAdapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)
            // Load infra
            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)
            val path = runPathfinding(infra, request)
            val res = runPathfindingPostProcessing(infra, path)
            validatePathfindingResponse(infra, request, res)
            RsJson(RsWithBody(pathfindingResponseAdapter.toJson(res)))
        } catch (error: NoPathFoundException) {
            RsJson(RsWithBody(pathfindingResponseAdapter.toJson(error.response)))
        } catch (error: OSRDError) {
            if (!error.osrdErrorType.isCacheable) {
                ExceptionHandler.handle(error)
            } else {
                val response = PathfindingFailed(error)
                RsJson(RsWithBody(pathfindingResponseAdapter.toJson(response)))
            }
        } catch (ex: Throwable) {
            ExceptionHandler.handle(ex)
        }
    }
}

/** Runs the pathfinding with the infra and request already parsed */
@JvmName("runPathfinding")
@Throws(OSRDError::class)
fun runPathfinding(
    infra: FullInfra,
    request: PathfindingBlockRequest,
): PathfindingResultId<Block> {
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
    // Compute the paths from the entry waypoint to the exit waypoint
    return computePaths(infra, waypoints, constraints, listOf(), request.timeout)
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
    remainingDistanceEstimators: List<AStarHeuristicId<Block>>,
    timeout: Double?
): PathfindingResultId<Block> {
    val pathFound =
        Pathfinding(GraphAdapter(infra.blockInfra, infra.rawInfra))
            .setTimeout(timeout)
            .setEdgeToLength { block: BlockId -> infra.blockInfra.getBlockLength(block) }
            .setRemainingDistanceEstimator(remainingDistanceEstimators)
            .addBlockedRangeOnEdges(constraints)
            .runPathfinding(waypoints)
    if (pathFound != null) {
        return pathFound
    }

    // Handling errors
    // Check if pathfinding failed due to constraints
    val possiblePathWithoutErrorNoConstraints =
        Pathfinding(GraphAdapter(infra.blockInfra, infra.rawInfra))
            .setEdgeToLength { block -> infra.blockInfra.getBlockLength(block) }
            .setRemainingDistanceEstimator(remainingDistanceEstimators)
            .runPathfinding(waypoints)
    if (
        possiblePathWithoutErrorNoConstraints != null &&
            possiblePathWithoutErrorNoConstraints.ranges.isNotEmpty()
    ) {
        val elecRanges = mutableListOf<RangeValue<String>>()
        val gaugeRanges = mutableListOf<Pathfinding.Range<TravelledPath>>()
        val signalRanges = mutableListOf<RangeValue<String>>()
        var travelledPathBlockStart =
            Offset<TravelledPath>(
                -possiblePathWithoutErrorNoConstraints.ranges.first().start.distance
            )
        for (range in possiblePathWithoutErrorNoConstraints.ranges) {
            for (currentConstraint in constraints) {
                for (blockedRange in currentConstraint.apply(range.edge)) {
                    if (blockedRange.end < range.start || range.end < blockedRange.start) {
                        // The blocked range is outside the used part
                        continue
                    }
                    val range =
                        Pathfinding.Range(
                            travelledPathBlockStart +
                                Offset.max(blockedRange.start, range.start).distance,
                            travelledPathBlockStart +
                                Offset.min(blockedRange.end, range.end).distance
                        )
                    when (currentConstraint::class.java) {
                        ElectrificationConstraints::class.java -> {
                            elecRanges.add(RangeValue(range, "elec"))
                        }
                        LoadingGaugeConstraints::class.java -> {
                            gaugeRanges.add(range)
                        }
                        SignalingSystemConstraints::class.java -> {
                            signalRanges.add(RangeValue(range, "signal"))
                        }
                    }
                }
            }
            travelledPathBlockStart += infra.blockInfra.getBlockLength(range.edge).distance
        }

        if (elecRanges.isNotEmpty() || gaugeRanges.isNotEmpty() || signalRanges.isNotEmpty()) {
            val relaxedPathResponse =
                runPathfindingPostProcessing(infra, possiblePathWithoutErrorNoConstraints)
            throw NoPathFoundException(
                IncompatibleConstraintsPathResponse(
                    relaxedPathResponse,
                    IncompatibleConstraints(elecRanges, gaugeRanges, signalRanges)
                )
            )
        }
    }
    // It didn’t fail due to a RS constraint, no path exists
    throw NoPathFoundException(NotFoundInBlocks(listOf(), Length(0.meters)))
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
        ?: throw RuntimeException(
            String.format(
                "The waypoint is not located on the track section %s",
                rawInfra.getTrackSectionName(trackSectionId)
            )
        )
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

fun validatePathfindingResponse(
    infra: FullInfra,
    req: PathfindingBlockRequest,
    res: PathfindingBlockResponse
) {
    if (res !is PathfindingBlockSuccess) return

    for ((i, blockName) in res.blocks.withIndex()) {
        val block = infra.blockInfra.getBlockFromName(blockName)!!
        val stopAtBufferStop = infra.blockInfra.blockStopAtBufferStop(block)
        val isLastBlock = i == res.blocks.size - 1
        if (stopAtBufferStop && !isLastBlock) {
            val zonePath = infra.blockInfra.getBlockPath(block).last()
            val detector = infra.rawInfra.getZonePathExit(zonePath)
            val detectorName = infra.rawInfra.getDetectorName(detector.value)
            val err = OSRDError(ErrorType.MissingSignalOnRouteTransition)
            err.context["detector"] = "detector=$detectorName, dir=${detector.direction}"
            throw err
        }
    }

    val trackSet = HashSet<String>()
    for (track in res.trackSectionRanges) trackSet.add(track.trackSection)
    if (trackSet.size != res.trackSectionRanges.size)
        throw OSRDError(ErrorType.PathWithRepeatedTracks)

    if (res.pathItemPositions.size != req.pathItems.size)
        throw OSRDError(ErrorType.PathHasInvalidItemPositions)

    if (res.pathItemPositions[0].distance.millimeters != 0L)
        throw OSRDError(ErrorType.PathHasInvalidItemPositions)

    if (res.pathItemPositions[res.pathItemPositions.size - 1] != res.length)
        throw OSRDError(ErrorType.PathHasInvalidItemPositions)
}
