package fr.sncf.osrd.api.api_v2.pathfinding

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.api_v2.TrackRange
import fr.sncf.osrd.api.pathfinding.makeRoutePath
import fr.sncf.osrd.graph.Pathfinding
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.graph.PathfindingResultId
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath
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
