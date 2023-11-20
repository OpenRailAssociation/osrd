package fr.sncf.osrd.api.pathfinding

import fr.sncf.osrd.api.ExceptionHandler
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.InfraManager
import fr.sncf.osrd.api.pathfinding.constraints.ElectrificationConstraints
import fr.sncf.osrd.api.pathfinding.constraints.LoadingGaugeConstraints
import fr.sncf.osrd.api.pathfinding.request.PathfindingRequest
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint
import fr.sncf.osrd.api.pathfinding.response.PathWaypointResult
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.graph.AStarHeuristic
import fr.sncf.osrd.graph.EdgeToRanges
import fr.sncf.osrd.graph.GraphAdapter
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.infra.api.Direction
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.getNextTrackSections
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import org.takes.Request
import org.takes.Response
import org.takes.Take
import org.takes.rq.RqPrint
import org.takes.rs.RsJson
import org.takes.rs.RsText
import org.takes.rs.RsWithBody
import org.takes.rs.RsWithStatus
import java.util.*
import java.util.stream.Collectors
import kotlin.math.abs

class PathfindingBlocksEndpoint
    (private val infraManager: InfraManager) : Take {
    override fun act(req: Request): Response {
        val recorder = DiagnosticRecorderImpl(false)
        return try {
            val body = RqPrint(req).printBody()
            val request =
                PathfindingRequest.adapter.fromJson(body)
                    ?: return RsWithStatus(RsText("missing request body"), 400)
            val reqWaypoints = request.waypoints

            // Load infra
            val infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder)

            // Load rolling stocks
            val rollingStocks = request.rollingStocks.stream()
                .map { rjsRollingStock: RJSRollingStock? -> RJSRollingStockParser.parse(rjsRollingStock) }
                .toList()
            val path = runPathfinding(infra, reqWaypoints, rollingStocks)
            val res = convertPathfindingResult(
                infra.blockInfra, infra.rawInfra,
                path, recorder
            )
            validatePathfindingResult(res, reqWaypoints, infra.rawInfra)
            RsJson(RsWithBody(PathfindingResult.adapterResult.toJson(res)))
        } catch (ex: Throwable) {
            // TODO: include warnings in the response
            ExceptionHandler.handle(ex)
        }
    }

    companion object {
        val constraintErrors = HashMap<Class<*>, ErrorType>()

        init {
            constraintErrors[LoadingGaugeConstraints::class.java] =
                ErrorType.PathfindingGaugeError
            constraintErrors[ElectrificationConstraints::class.java] =
                ErrorType.PathfindingElectrificationError
        }
    }
}

/** Returns the list of dir track id on the route. Can contain duplicates.  */
private fun getRouteDirTracks(rawInfra: RawSignalingInfra, routeId: RouteId): DirStaticIdxList<TrackSection> {
    val res = MutableDirStaticIdxArrayList<TrackSection>()
    for (dirChunk in rawInfra.getChunksOnRoute(routeId)) {
        val currentTrack = DirStaticIdx(
            rawInfra.getTrackFromChunk(dirChunk.value),
            dirChunk.direction
        )
        res.add(currentTrack)
    }
    return res
}

private fun validatePathfindingResult(
    res: PathfindingResult, reqWaypoints: Array<Array<PathfindingWaypoint>>,
    rawInfra: RawSignalingInfra
) {
    val routeTracks = MutableDirStaticIdxArrayList<TrackSection>()
    for (routePath in res.routePaths)
        for (dirTrack in getRouteDirTracks(rawInfra, rawInfra.getRouteFromName(routePath.route)))
            if (routeTracks.isEmpty() || routeTracks[routeTracks.size - 1] != dirTrack)
                routeTracks.add(dirTrack)
    if (routeTracks.toSet().size < routeTracks.size)
        throw OSRDError(ErrorType.PathWithRepeatedTracks)
    assertPathRoutesAreAdjacent(routeTracks, rawInfra)
    val tracksOnPath = res.routePaths.stream()
        .flatMap { route: RJSRoutePath? -> route!!.trackSections.stream() }
        .toList()
    assertPathTracksAreComplete(tracksOnPath, rawInfra)
    assertRequiredWaypointsOnPathTracks(reqWaypoints, tracksOnPath, res.pathWaypoints)
}

private fun assertPathRoutesAreAdjacent(routeTracks: DirStaticIdxList<TrackSection>, rawInfra: RawSignalingInfra) {
    for (i in 0 until routeTracks.size - 1) {
        val nextTrackSections = rawInfra.getNextTrackSections(routeTracks[i])
        assert(nextTrackSections.contains(routeTracks[i + 1]))
        { "The path goes over consecutive tracks that are not adjacent" }
    }
}

private fun assertPathTracksAreComplete(tracksOnPath: List<RJSDirectionalTrackRange>, rawInfra: RawSignalingInfra) {
    var i = 0
    while (i < tracksOnPath.size) {
        val track = tracksOnPath[i]
        val trackName = track.trackSectionID
        val fullTrack = ArrayList<RJSDirectionalTrackRange?>()
        for (j in i until tracksOnPath.size) {
            if (trackName != tracksOnPath[j].trackSectionID)
                break
            fullTrack.add(tracksOnPath[j])
        }
        val fullTrackLength =
            rawInfra.getTrackSectionLength(getTrackSectionFromNameOrThrow(trackName, rawInfra)).distance.meters
        var beginEndpoint = fullTrack[0]!!.begin
        var endEndpoint = fullTrack[fullTrack.size - 1]!!.end
        var trackBegin = 0.0
        var trackEnd = fullTrackLength
        if (track.direction == EdgeDirection.STOP_TO_START) {
            beginEndpoint = fullTrack[0]!!.end
            endEndpoint = fullTrack[fullTrack.size - 1]!!.begin
            trackBegin = fullTrackLength
            trackEnd = 0.0
            fullTrack.reverse()
        }
        assert(i == 0 || beginEndpoint == trackBegin) {
            String.format(
                "The path goes through the track %s without starting at its endpoint",
                trackName
            )
        }
        i += fullTrack.size
        assert(i == tracksOnPath.size || abs(endEndpoint - trackEnd) < 1e-3) {
            String.format(
                "The path goes through the track %s without ending at its endpoint",
                trackName
            )
        }

        // The track should be whole
        for (j in 0 until fullTrack.size - 1) {
            assert(abs(fullTrack[j]!!.end - fullTrack[j + 1]!!.begin) < 1e-3) {
                String.format(
                    "The path goes through a partially incomplete track %s",
                    trackName
                )
            }
        }
    }
}

private fun assertRequiredWaypointsOnPathTracks(
    reqWaypoints: Array<Array<PathfindingWaypoint>>,
    tracksOnPath: List<RJSDirectionalTrackRange>,
    pathWaypoints: List<PathWaypointResult>
) {
    // Checks that at least one waypoint of each step is on the path
    assert(Arrays.stream(reqWaypoints).allMatch { step: Array<PathfindingWaypoint>? ->
        Arrays.stream(step)
            .anyMatch { waypoint: PathfindingWaypoint ->
                tracksOnPath.stream()
                    .anyMatch { trackOnPath: RJSDirectionalTrackRange -> isWaypointOnTrack(waypoint, trackOnPath) }
            }
    }) { "The path does not contain one of the wanted steps" }
    for (waypoint in pathWaypoints) {
        val loc = waypoint.location
        assert(tracksOnPath.stream()
            .filter { range: RJSDirectionalTrackRange -> range.trackSectionID == loc.trackSection }
            .anyMatch { range: RJSDirectionalTrackRange ->
                ((loc.offset > range.begin || TrainPhysicsIntegrator.arePositionsEqual(loc.offset, range.begin))
                        && (loc.offset < range.end || TrainPhysicsIntegrator.arePositionsEqual(
                    loc.offset,
                    range.end
                )))
            }) { "A waypoint isn't included in the track path" }
    }
}

private fun isWaypointOnTrack(waypoint: PathfindingWaypoint, track: RJSDirectionalTrackRange): Boolean {
    return (track.trackSectionID == waypoint.trackSection && track.direction == waypoint.direction
            && (track.begin <= waypoint.offset || abs(track.begin - waypoint.offset) < 1e-3)
            && (track.end >= waypoint.offset || abs(track.end - waypoint.offset) < 1e-3))
}

/**
 * Runs the pathfinding with the infra and rolling stocks already parsed
 */
@JvmName("runPathfinding")
@Throws(OSRDError::class)
fun runPathfinding(
    infra: FullInfra,
    reqWaypoints: Array<Array<PathfindingWaypoint>>,
    rollingStocks: Collection<RollingStock>?
): Pathfinding.Result<BlockId> {
    // Parse the waypoints
    val waypoints = ArrayList<Collection<EdgeLocation<BlockId>>>()
    for (step in reqWaypoints) {
        val allStarts = HashSet<EdgeLocation<BlockId>>()
        for (waypoint in step)
            allStarts.addAll(findWaypointBlocks(infra, waypoint))
        waypoints.add(allStarts)
    }

    // Initializes the constraints
    val loadingGaugeConstraints = LoadingGaugeConstraints(infra.blockInfra, infra.rawInfra, rollingStocks!!)
    val electrificationConstraints = ElectrificationConstraints(
        infra.blockInfra, infra.rawInfra,
        rollingStocks
    )
    val constraints = listOf<EdgeToRanges<BlockId>>(loadingGaugeConstraints, electrificationConstraints)
    val remainingDistanceEstimators = makeHeuristics(infra, waypoints)

    // Compute the paths from the entry waypoint to the exit waypoint
    return computePaths(infra, waypoints, constraints, remainingDistanceEstimators)
}

/** Initialize the heuristics  */
fun makeHeuristics(
    infra: FullInfra,
    waypoints: List<Collection<EdgeLocation<BlockId>>>
): ArrayList<AStarHeuristic<BlockId>> {
    // Compute the minimum distance between steps
    val stepMinDistance = DoubleArray(waypoints.size - 1)
    for (i in 0 until waypoints.size - 2) {
        stepMinDistance[i] = RemainingDistanceEstimator.minDistanceBetweenSteps(
            infra.blockInfra, infra.rawInfra, waypoints[i + 1],
            waypoints[i + 2]
        )
    }

    // Reversed cumulative sum
    for (i in stepMinDistance.size - 2 downTo 0) {
        stepMinDistance[i] += stepMinDistance[i + 1]
    }

    // Setup estimators foreach intermediate steps
    val remainingDistanceEstimators = ArrayList<AStarHeuristic<BlockId>>()
    for (i in 0 until waypoints.size - 1) {
        remainingDistanceEstimators.add(
            RemainingDistanceEstimator(
                infra.blockInfra,
                infra.rawInfra,
                waypoints[i + 1],
                stepMinDistance[i]
            )
        )
    }
    return remainingDistanceEstimators
}

@Throws(OSRDError::class)
private fun computePaths(
    infra: FullInfra,
    waypoints: ArrayList<Collection<EdgeLocation<BlockId>>>,
    constraints: List<EdgeToRanges<BlockId>>,
    remainingDistanceEstimators: List<AStarHeuristic<BlockId>>
): Pathfinding.Result<BlockId> {
    val pathFound = Pathfinding(GraphAdapter(infra.blockInfra, infra.rawInfra))
        .setEdgeToLength { block: BlockId -> infra.blockInfra.getBlockLength(block).distance }
        .setRemainingDistanceEstimator(remainingDistanceEstimators)
        .addBlockedRangeOnEdges(constraints)
        .runPathfinding(waypoints)
    if (pathFound != null) {
        return pathFound
    }

    // Handling errors
    // Check if pathfinding failed due to constraints
    val possiblePathWithoutErrorNoConstraints = Pathfinding(GraphAdapter(infra.blockInfra, infra.rawInfra))
        .setEdgeToLength { block: BlockId -> infra.blockInfra.getBlockLength(block).distance }
        .setRemainingDistanceEstimator(remainingDistanceEstimators)
        .runPathfinding(waypoints)
    if (possiblePathWithoutErrorNoConstraints != null) {
        for (currentConstraint in constraints) {
            Pathfinding(GraphAdapter(infra.blockInfra, infra.rawInfra))
                .setEdgeToLength { block: BlockId -> infra.blockInfra.getBlockLength(block).distance }
                .addBlockedRangeOnEdges(currentConstraint)
                .setRemainingDistanceEstimator(remainingDistanceEstimators)
                .runPathfinding(waypoints)
                ?: throw OSRDError(PathfindingBlocksEndpoint.constraintErrors[currentConstraint.javaClass])
        }
    }
    // It didn’t fail due to a constraint, no path exists
    throw OSRDError(ErrorType.PathfindingGenericError)
}

/**
 * Returns all the EdgeLocations of a waypoint list.
 * @param infra full infra.
 * @param waypoints corresponding waypoints.
 * @return corresponding edge locations.
 */
fun findWaypointBlocks(
    infra: FullInfra,
    waypoints: Collection<PathfindingWaypoint>
): Set<EdgeLocation<BlockId>> {
    return waypoints.stream()
        .flatMap { waypoint: PathfindingWaypoint -> findWaypointBlocks(infra, waypoint).stream() }
        .collect(Collectors.toSet())
}

/**
 * Returns all the EdgeLocations of a waypoint.
 * @param infra full infra.
 * @param waypoint corresponding waypoint.
 * @return corresponding edge location, containing a block id and its offset from the waypoint.
 */
fun findWaypointBlocks(
    infra: FullInfra,
    waypoint: PathfindingWaypoint
): Set<EdgeLocation<BlockId>> {
    val res = HashSet<EdgeLocation<BlockId>>()
    val trackSectionId = infra.rawInfra.getTrackSectionFromName(waypoint.trackSection)
        ?: throw OSRDError.newUnknownTrackSectionError(waypoint.trackSection)
    val trackChunkOnWaypoint = getTrackSectionChunkOnWaypoint(trackSectionId, waypoint.offset, infra.rawInfra)
    val waypointDirection = Direction.fromEdgeDir(waypoint.direction).toKtDirection()
    val blocksOnWaypoint =
        infra.blockInfra.getBlocksFromTrackChunk(
            trackChunkOnWaypoint,
            waypointDirection
        ).toSet()
    for (block in blocksOnWaypoint) {
        val offset = getBlockOffset(
            block, trackChunkOnWaypoint, trackSectionId, waypoint.offset,
            waypoint.direction, infra
        )
        assert(offset <= infra.blockInfra.getBlockLength(block))
        res.add(EdgeLocation(block, offset.distance))
    }
    return res
}

private fun getTrackSectionChunkOnWaypoint(
    trackSectionId: TrackSectionId, waypointOffsetMeters: Double,
    rawInfra: RawSignalingInfra
): TrackChunkId {
    val waypointOffset = fromMeters(waypointOffsetMeters)
    val trackSectionChunks = rawInfra.getTrackSectionChunks(trackSectionId)
    return trackSectionChunks.firstOrNull { chunk: TrackChunkId ->
        val startChunk = rawInfra.getTrackChunkOffset(chunk)
        val endChunk = startChunk + rawInfra.getTrackChunkLength(chunk).distance
        waypointOffset >= startChunk.distance && waypointOffset <= endChunk.distance
    } ?: throw RuntimeException(
        String.format(
            "The waypoint is not located on the track section %s",
            rawInfra.getTrackSectionName(trackSectionId)
        )
    )
}

private fun getBlockOffset(
    blockId: BlockId, trackChunkId: TrackChunkId, trackSectionId: TrackSectionId, waypointOffsetMeters: Double,
    direction: EdgeDirection, infra: FullInfra
): Offset<Block> {
    val waypointOffset = fromMeters(waypointOffsetMeters)
    val trackSectionLength = infra.rawInfra.getTrackSectionLength(trackSectionId)
    val trackChunkOffset = infra.rawInfra.getTrackChunkOffset(trackChunkId)
    val trackChunkLength = infra.rawInfra.getTrackChunkLength(trackChunkId)
    val dirTrackChunkOffset =
        if (direction == EdgeDirection.START_TO_STOP)
            trackChunkOffset.distance
        else
            trackSectionLength.distance - trackChunkOffset.distance - trackChunkLength.distance
    val dirWaypointOffset =
        if (direction == EdgeDirection.START_TO_STOP)
            waypointOffset
        else
            trackSectionLength.distance - waypointOffset
    var startBlockToStartChunk = 0.meters
    val blockTrackChunks = infra.blockInfra.getTrackChunksFromBlock(blockId)
    for (blockTrackChunkDirId in blockTrackChunks) {
        val blockTrackChunkId = blockTrackChunkDirId.value
        if (blockTrackChunkId == trackChunkId) {
            return Offset((startBlockToStartChunk + dirWaypointOffset - dirTrackChunkOffset).absoluteValue)
        }
        startBlockToStartChunk += infra.rawInfra.getTrackChunkLength(blockTrackChunkId).distance
    }
    throw AssertionError(String.format("getBlockOffset: Track chunk %s not in block %s", trackChunkId, blockId))
}

