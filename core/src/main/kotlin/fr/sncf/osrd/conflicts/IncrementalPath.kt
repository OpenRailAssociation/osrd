package fr.sncf.osrd.conflicts

import fr.sncf.osrd.path.implementations.PartialBlockRange
import fr.sncf.osrd.path.implementations.PartialRouteRange
import fr.sncf.osrd.path.implementations.buildRangeList
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.GenericLinearRange
import fr.sncf.osrd.path.interfaces.RouteRange
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.ZoneRange
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

data class PathStop(val pathOffset: Offset<TrainPath>, val receptionSignal: RJSReceptionSignal)

/**
 * Path fragment to add to the incremental path.
 *
 * Object ranges are "partial" ranges, meaning without path offset. The path offset will be added to
 * the ranges as they're added to the path.
 */
data class PathFragment(
    val routes: List<PartialRouteRange>,
    val blocks: List<PartialBlockRange>,
    val stops: List<PathStop>,
    val containsEnd: Boolean,
) {
    init {
        assert(routes.isNotEmpty())
        assert(blocks.isNotEmpty())
    }
}

fun TrainPath.generatePathFragment(stops: List<PathStop>, containsEnd: Boolean): PathFragment {
    return PathFragment(
        getRoutes().map { it.withoutPathOffsets() },
        getBlocks().map { it.withoutPathOffsets() },
        stops,
        containsEnd,
    )
}

fun incrementalPathOf(rawInfra: RawInfra, blockInfra: BlockInfra): IncrementalPath {
    return IncrementalPath(rawInfra, blockInfra)
}

class IncrementalPath
internal constructor(
    private val rawInfra: RawInfra,
    private val blockInfra: BlockInfra,

    // objects
    var routes: AppendOnlyLinkedList<RouteRange> = appendOnlyLinkedListOf(),
    var blocks: AppendOnlyLinkedList<BlockRange> = appendOnlyLinkedListOf(),
    var stops: AppendOnlyLinkedList<PathStop> = appendOnlyLinkedListOf(),
    var zones: AppendOnlyLinkedList<ZoneRange> = appendOnlyLinkedListOf(),
    var blockZoneBounds: AppendOnlyLinkedList<ZoneBounds> = appendOnlyLinkedListOf(),
) {
    var pathStarted = false
        private set

    var pathComplete = false
        private set

    val length: Length<TrainPath>
        get() = blocks.lastOrNull()?.pathEnd ?: Length.zero()

    data class ZoneBounds(val firstZoneIndex: Int, val lastZoneIndex: Int)

    fun extend(fragment: PathFragment) {
        val fragmentStartOffset = blocks.lastOrNull()?.pathEnd ?: Offset.zero()
        assert(!pathComplete) { "extending a complete path" }
        pathStarted = true

        val routeRanges = buildRangeList(fragment.routes, fragmentStartOffset)
        val blockRanges = buildRangeList(fragment.blocks, fragmentStartOffset)

        // add zones and routes
        for (routeRange in routeRanges) {
            val route = routeRange.value
            assert(
                routes.isEmpty() ||
                    route == routes.last().value ||
                    rawInfra.getRouteEntry(route) == rawInfra.getRouteExit(routes.last().value)
            )
            val zonePathRanges =
                routeRange.mapSubObject(rawInfra.getRoutePath(route).toList()) {
                    rawInfra.getZonePathLength(it)
                }
            val zoneRanges =
                zonePathRanges.map {
                    GenericLinearRange(
                        rawInfra.getZonePathZone(it.value),
                        it.objectBegin.cast<Zone>(),
                        it.objectEnd.cast(),
                        it.pathBegin,
                        it.pathEnd,
                    )
                }
            zones = addLinearObjects(zones, zoneRanges)
            blocks = addLinearObjects(blocks, blockRanges)
            routes = addLinearObjects(routes, routeRanges)
        }
        stops.addAll(fragment.stops)

        if (fragment.containsEnd) {
            pathComplete = true
        }
    }

    private fun <ValueType, OffsetType> addLinearObjects(
        list: AppendOnlyLinkedList<GenericLinearRange<ValueType, OffsetType>>,
        elements: List<GenericLinearRange<ValueType, OffsetType>>,
    ): AppendOnlyLinkedList<GenericLinearRange<ValueType, OffsetType>> {
        var res = list
        for (element in elements) {
            val prevElement = res.lastOrNull()
            if (element.value == prevElement?.value) {
                assert(element.pathEnd >= prevElement.pathEnd)
                res = list.shallowCopy()
                res.dropLast()
                res.add(
                    GenericLinearRange(
                        prevElement.value,
                        prevElement.objectBegin,
                        element.objectEnd,
                        prevElement.pathBegin,
                        element.pathEnd,
                    )
                )
            } else {
                res.add(element)
            }
        }
        return res
    }

    fun clone(): IncrementalPath {
        return IncrementalPath(
            this.rawInfra,
            this.blockInfra,
            this.routes.shallowCopy(),
            this.blocks.shallowCopy(),
            this.stops.shallowCopy(),
            this.zones.shallowCopy(),
        )
    }

    fun getBlockStartZone(blockIndex: Int): Int {
        return blockZoneBounds[blockIndex].firstZoneIndex
    }

    fun getBlockEndZone(blockIndex: Int): Int {
        return blockZoneBounds[blockIndex].lastZoneIndex
    }

    fun getStopOffset(stopIndex: Int): Offset<TrainPath> {
        return stops[stopIndex].pathOffset
    }

    fun isStopOnClosedSignal(stopIndex: Int): Boolean {
        return stops[stopIndex].receptionSignal.isStopOnClosedSignal
    }
}
