package fr.sncf.osrd.api.api_v2.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.api_v2.TrackRange
import fr.sncf.osrd.api.pathfinding.makeRoutePath
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.graph.PathfindingResultId
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Offset.Companion.max
import fr.sncf.osrd.utils.units.Offset.Companion.min
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.sumDistances

fun runPathfindingPostProcessing(
    infra: FullInfra,
    initialRequest: PathfindingBlockRequest,
    rawPath: PathfindingResultId<Block>
): PathfindingBlockSuccess {
    val res = runPathfindingBlockPostProcessing(infra, rawPath)
    validatePathfindingResponse(infra, initialRequest, res)
    return res
}

fun runPathfindingBlockPostProcessing(
    infra: FullInfra,
    rawPath: PathfindingResultId<Block>
): PathfindingBlockSuccess {
    // We reuse some of the old function of pathfindingResultConverter,
    // there will be some cleanup to be made when the old version is removed
    val oldRoutePath = makeRoutePath(infra.blockInfra, infra.rawInfra, rawPath.ranges)
    val routeList = oldRoutePath.map { it.route }
    val blockList = makeBlocks(infra, rawPath.ranges)

    val trackRanges = makeTrackRanges(oldRoutePath)
    return PathfindingBlockSuccess(
        blockList,
        routeList,
        trackRanges,
        Length(rawPath.ranges.map { it.end - it.start }.sumDistances()),
        makePathItemPositions(rawPath)
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

fun makePathItemPositions(path: Pathfinding.Result<StaticIdx<Block>, Block>): List<Offset<Path>> {
    val pathItemLocations = mutableMapOf<BlockId, MutableList<PathfindingEdgeLocationId<Block>>>()
    for (waypoint in path.waypoints) {
        val edgeWaypoints = pathItemLocations.computeIfAbsent(waypoint.edge) { mutableListOf() }
        edgeWaypoints.add(waypoint)
    }
    var offsetSinceStart = Offset<Path>(0.meters)
    val res = mutableListOf<Offset<Path>>()
    for (range in path.ranges) {
        for (waypoint in pathItemLocations[range.edge] ?: listOf()) {
            res.add(offsetSinceStart + waypoint.offset.distance - range.start.distance)
        }
        offsetSinceStart += range.end - range.start
    }
    return res
}

fun makeTrackRanges(oldRoutePath: List<RJSRoutePath>): List<TrackRange> {
    val res = mutableListOf<TrackRange>()
    for (routeRange in oldRoutePath) {
        for (trackRange in routeRange.trackSections) {
            if (res.isEmpty() || res[res.size - 1].trackSection != trackRange.trackSectionID) {
                res.add(
                    TrackRange(
                        trackRange.trackSectionID,
                        Offset(trackRange.begin.meters),
                        Offset(trackRange.end.meters),
                        trackRange.direction
                    )
                )
            } else {
                val last = res[res.size - 1]
                last.end = max(last.end, Offset(trackRange.end.meters))
                last.begin = min(last.begin, Offset(trackRange.begin.meters))
            }
        }
    }
    return res
}

fun makeBlocks(
    infra: FullInfra,
    ranges: List<Pathfinding.EdgeRange<StaticIdx<Block>, Block>>
): List<String> {
    val res = mutableListOf<String>()
    for (range in ranges) {
        val name = infra.blockInfra.getBlockName(range.edge)
        if (res.isEmpty() || res[res.size - 1] != name) res.add(name)
    }
    return res
}
