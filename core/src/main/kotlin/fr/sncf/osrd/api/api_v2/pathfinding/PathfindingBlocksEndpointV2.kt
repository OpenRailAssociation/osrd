package fr.sncf.osrd.api.api_v2.pathfinding

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.api_v2.TrackLocation
import fr.sncf.osrd.api.pathfinding.constraints.*
import fr.sncf.osrd.api.pathfinding.makeHeuristics
import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.graph.*
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.CachedBlockMRSPBuilder.Companion.DEFAULT_MAX_ROLLING_STOCK_SPEED
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.time.Duration
import java.time.Instant
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
            val res = runPathfinding(infra, request)
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

    // TODO: add the rolling stock global speed limit to the request
    val heuristics = makeHeuristics(infra, waypoints, DEFAULT_MAX_ROLLING_STOCK_SPEED)

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
    remainingDistanceEstimators: List<AStarHeuristicId<Block>>,
    initialRequest: PathfindingBlockRequest,
    timeout: Double?,
): PathfindingResultId<Block> {
    val start = Instant.now()
    val mrspBuilder = CachedBlockMRSPBuilder(infra.rawInfra, infra.blockInfra, null)
    val pathFound =
        Pathfinding(GraphAdapter(infra.blockInfra, infra.rawInfra))
            .setTimeout(timeout)
            .setEdgeToLength { block: BlockId -> infra.blockInfra.getBlockLength(block) }
            .setRangeCost { range ->
                mrspBuilder.getBlockTime(range.edge, range.end) -
                    mrspBuilder.getBlockTime(range.edge, range.start)
            }
            .setRemainingDistanceEstimator(remainingDistanceEstimators)
            .addBlockedRangeOnEdges(constraints)
            .runPathfinding(waypoints)
    if (pathFound != null) {
        return pathFound
    }

    // Handling errors
    // Check if pathfinding failed due to incompatible constraints
    val elapsedSeconds = Duration.between(start, Instant.now()).toSeconds()
    val incompatibleConstraintsResponse =
        buildIncompatibleConstraintsResponse(
            infra,
            waypoints,
            constraints,
            remainingDistanceEstimators,
            mrspBuilder,
            initialRequest,
            timeout?.minus(elapsedSeconds)
        )
    if (incompatibleConstraintsResponse != null) {
        throw NoPathFoundException(incompatibleConstraintsResponse)
    }
    // It didn’t fail due to an incompatible constraint, no path exists
    throw NoPathFoundException(NotFoundInBlocks(listOf(), Length(0.meters)))
}

private fun buildIncompatibleConstraintsResponse(
    infra: FullInfra,
    waypoints: ArrayList<Collection<PathfindingEdgeLocationId<Block>>>,
    constraints: List<PathfindingConstraint<Block>>,
    remainingDistanceEstimators: List<AStarHeuristicId<Block>>,
    mrspBuilder: CachedBlockMRSPBuilder,
    initialRequest: PathfindingBlockRequest,
    timeout: Double?
): IncompatibleConstraintsPathResponse? {
    val possiblePathWithoutErrorNoConstraints =
        Pathfinding(GraphAdapter(infra.blockInfra, infra.rawInfra))
            .setTimeout(timeout)
            .setEdgeToLength { block -> infra.blockInfra.getBlockLength(block) }
            .setRangeCost { range ->
                mrspBuilder.getBlockTime(range.edge, range.end) -
                    mrspBuilder.getBlockTime(range.edge, range.start)
            }
            .setRemainingDistanceEstimator(remainingDistanceEstimators)
            .runPathfinding(waypoints)

    if (
        possiblePathWithoutErrorNoConstraints == null ||
            possiblePathWithoutErrorNoConstraints.ranges.isEmpty()
    ) {
        return null
    }

    val pathRanges = possiblePathWithoutErrorNoConstraints.ranges
    val pathProps =
        makePathProps(infra.rawInfra, infra.blockInfra, pathRanges.map { it.edge }, Offset.zero())

    val elecConstraints = constraints.filterIsInstance<ElectrificationConstraints>()
    assert(elecConstraints.size < 2)
    val elecBlockedRangeValues =
        getConstraintsDistanceRange(
                infra,
                pathRanges,
                pathProps.getElectrification(),
                elecConstraints.firstOrNull()
            )
            .map { RangeValue(Pathfinding.Range(Offset(it.lower), Offset(it.upper)), it.value) }

    val gaugeConstraints = constraints.filterIsInstance<LoadingGaugeConstraints>()
    assert(gaugeConstraints.size < 2)
    val gaugeBlockedRanges =
        getConstraintsDistanceRange(
                infra,
                pathRanges,
                pathProps.getLoadingGauge(),
                gaugeConstraints.firstOrNull()
            )
            .map { RangeValue<String>(Pathfinding.Range(Offset(it.lower), Offset(it.upper)), null) }

    val signalingSystemConstraints = constraints.filterIsInstance<SignalingSystemConstraints>()
    assert(signalingSystemConstraints.size < 2)
    val blockList = pathRanges.map { it.edge }
    val pathSignalingSystem = getPathSignalingSystems(infra, blockList)
    val signalingSystemBlockedRangeValues =
        getConstraintsDistanceRange(
                infra,
                pathRanges,
                pathSignalingSystem,
                signalingSystemConstraints.firstOrNull()
            )
            .map { RangeValue(Pathfinding.Range(Offset(it.lower), Offset(it.upper)), it.value) }

    if (
        listOf(elecBlockedRangeValues, gaugeBlockedRanges, signalingSystemBlockedRangeValues).all {
            it.isEmpty()
        }
    ) {
        return null
    }

    return IncompatibleConstraintsPathResponse(
        runPathfindingPostProcessing(infra, initialRequest, possiblePathWithoutErrorNoConstraints),
        IncompatibleConstraints(
            elecBlockedRangeValues,
            gaugeBlockedRanges,
            signalingSystemBlockedRangeValues
        )
    )
}

private fun <T> getConstraintsDistanceRange(
    infra: FullInfra,
    pathRanges: List<Pathfinding.EdgeRange<BlockId, Block>>,
    pathConstrainedValues: DistanceRangeMap<T>,
    constraint: PathfindingConstraint<Block>?
): DistanceRangeMap<T> {
    if (constraint == null) {
        return distanceRangeMapOf()
    }

    val blockedRanges = getBlockedRanges(infra, pathRanges, constraint)
    val filteredRangeValues = filterIntersection(pathConstrainedValues, blockedRanges)
    val travelledPathOffset = pathRanges.first().start.distance
    filteredRangeValues.shiftPositions(-travelledPathOffset)
    return filteredRangeValues
}

private fun getBlockedRanges(
    infra: FullInfra,
    pathRanges: List<Pathfinding.EdgeRange<BlockId, Block>>,
    currentConstraint: PathfindingConstraint<Block>
): DistanceRangeMap<Boolean> {
    val blockList = pathRanges.map { it.edge }
    val blockedRanges = distanceRangeMapOf<Boolean>()
    var startBlockPathOffset = Distance.ZERO
    for (block in blockList) {
        currentConstraint.apply(block).map {
            blockedRanges.put(
                startBlockPathOffset + it.start.distance,
                startBlockPathOffset + it.end.distance,
                true
            )
        }
        startBlockPathOffset += infra.blockInfra.getBlockLength(block).distance
    }
    blockedRanges.truncate(
        pathRanges.first().start.distance,
        startBlockPathOffset - infra.blockInfra.getBlockLength(blockList.last()).distance +
            pathRanges.last().end.distance
    )
    return blockedRanges
}

private fun getPathSignalingSystems(
    infra: FullInfra,
    blockList: List<BlockId>
): DistanceRangeMap<String> {
    val pathSignalingSystem = distanceRangeMapOf<String>()
    var startBlockPathOffset = Distance.ZERO
    for (block in blockList) {
        val blockLength = infra.blockInfra.getBlockLength(block).distance
        val blockSignalingSystemIdx = infra.blockInfra.getBlockSignalingSystem(block)
        val blockSignalingSystemName =
            infra.signalingSimulator.sigModuleManager.getName(blockSignalingSystemIdx)
        pathSignalingSystem.put(
            startBlockPathOffset,
            startBlockPathOffset + blockLength,
            blockSignalingSystemName
        )
        startBlockPathOffset += blockLength
    }
    return pathSignalingSystem
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
