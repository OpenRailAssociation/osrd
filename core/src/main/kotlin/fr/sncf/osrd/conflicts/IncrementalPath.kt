package fr.sncf.osrd.conflicts.tmp

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

// Used to type offsets that use as reference the start of the first block on a given path fragment
sealed interface FragmentBlocks

data class FragmentStop(
    val fragmentOffset: Offset<FragmentBlocks>,
    val receptionSignal: RJSReceptionSignal,
)

data class PathFragment(
    val routes: List<RouteRange>,
    val blocks: List<BlockRange>,
    val stops: List<FragmentStop>,
    val containsEnd: Boolean,
) {
    init {
        assert(routes.isNotEmpty())
        assert(blocks.isNotEmpty())
    }
}

fun incrementalPathOf(rawInfra: RawInfra, blockInfra: BlockInfra): IncrementalPath {
    return IncrementalPath(rawInfra, blockInfra)
}

class IncrementalStop(val offset: Offset<TrainPath>, val receptionSignal: RJSReceptionSignal)

class IncrementalPath
internal constructor(
    private val rawInfra: RawInfra,
    private val blockInfra: BlockInfra,

    // objects
    var routes: AppendOnlyLinkedList<RouteRange> = appendOnlyLinkedListOf(),
    var blocks: AppendOnlyLinkedList<BlockRange> = appendOnlyLinkedListOf(),
    var stops: AppendOnlyLinkedList<IncrementalStop> = appendOnlyLinkedListOf(),
    var zones: AppendOnlyLinkedList<ZoneRange> = appendOnlyLinkedListOf(),
    var routeZoneBounds: AppendOnlyLinkedList<ZoneBounds> = appendOnlyLinkedListOf(),
    var blockZoneBounds: AppendOnlyLinkedList<ZoneBounds> = appendOnlyLinkedListOf(),
) {
    var pathStarted = false
        private set

    var pathComplete = false
        private set

    val length: Length<TrainPath>
        get() = blocks.lastOrNull()?.pathEnd ?: Length.zero()

    data class ZoneBounds(val firstZoneIndex: Int, val lastZoneIndex: Int)

    fun extend(
        newPathRange: TrainPath,
        fragmentPathOffset: Offset<TrainPath>,
        containsEnd: Boolean,
        stops: List<FragmentStop>,
    ) {
        fun <T, U> translateRange(range: GenericLinearRange<T, U>): GenericLinearRange<T, U> {
            return range.copy(
                pathBegin = range.pathBegin + fragmentPathOffset.distance,
                pathEnd = range.pathEnd + fragmentPathOffset.distance,
            )
        }
        fun <T, U> translateRanges(
            ranges: List<GenericLinearRange<T, U>>
        ): List<GenericLinearRange<T, U>> {
            return ranges.map { translateRange(it) }
        }
        val fragment =
            PathFragment(
                routes = translateRanges(newPathRange.getRoutes()),
                blocks = translateRanges(newPathRange.getBlocks()),
                stops = stops,
                containsEnd = containsEnd,
            )
        extend(fragment)
    }

    fun extend(fragment: PathFragment) {
        val fragmentStartOffset = blocks.lastOrNull()?.pathEnd ?: Offset.zero()
        assert(!pathComplete) { "extending a complete path" }
        pathStarted = true

        // add zones and routes
        for (routeRange in fragment.routes) {
            val route = routeRange.value
            assert(
                routes.isEmpty() ||
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
            blocks = addLinearObjects(blocks, fragment.blocks)
            routes = addLinearObjects(routes, fragment.routes)
        }

        for (stop in fragment.stops) {
            val offset = fragmentStartOffset + stop.fragmentOffset.distance
            stops.add(IncrementalStop(offset, stop.receptionSignal))
        }

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

    fun getRouteStartZone(routeIndex: Int): Int {
        return routeZoneBounds[routeIndex].firstZoneIndex
    }

    fun getRouteEndZone(routeIndex: Int): Int {
        return routeZoneBounds[routeIndex].lastZoneIndex
    }

    fun getBlockStartZone(blockIndex: Int): Int {
        return blockZoneBounds[blockIndex].firstZoneIndex
    }

    fun getBlockEndZone(blockIndex: Int): Int {
        return blockZoneBounds[blockIndex].lastZoneIndex
    }

    fun getStopOffset(stopIndex: Int): Offset<TrainPath> {
        return stops[stopIndex].offset
    }

    fun isStopOnClosedSignal(stopIndex: Int): Boolean {
        return stops[stopIndex].receptionSignal.isStopOnClosedSignal
    }
}
