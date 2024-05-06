package fr.sncf.osrd.conflicts

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.AppendOnlyLinkedList
import fr.sncf.osrd.utils.appendOnlyLinkedListOf
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.*

class PathFragment(
    val routes: StaticIdxList<Route>,
    val blocks: StaticIdxList<Block>,
    val containsStart: Boolean,
    val containsEnd: Boolean,

    // distance from the start of this fragment's first block
    travelledPathBegin: Distance,
    // distance from the end of this fragment's last block
    travelledPathEnd: Distance,
) {
    init {
        assert(containsStart || travelledPathBegin == Distance.ZERO)
        assert(containsEnd || travelledPathEnd == Distance.ZERO)
    }

    val travelledPathBegin = travelledPathBegin
        get() {
            assert(containsStart)
            return field
        }

    val travelledPathEnd = travelledPathEnd
        get() {
            assert(containsEnd)
            return field
        }
}

/** A marker type for Offset<TravelledPath> */
sealed interface TravelledPath

interface IncrementalPath {
    fun extend(fragment: PathFragment)

    fun clone(): IncrementalPath

    val zonePathCount: Int
    val blockCount: Int
    val routeCount: Int

    val routes: AppendOnlyLinkedList<RouteId>

    fun getBlock(blockIndex: Int): BlockId

    fun getRoute(routeIndex: Int): RouteId

    fun getZonePath(zonePathIndex: Int): ZonePathId

    fun getZonePathStartOffset(zonePathIndex: Int): Offset<Path>

    fun getBlockStartOffset(blockIndex: Int): Offset<Path>

    fun getRouteStartOffset(routeIndex: Int): Offset<Path>

    fun getZonePathEndOffset(zonePathIndex: Int): Offset<Path>

    fun getBlockEndOffset(blockIndex: Int): Offset<Path>

    fun getRouteEndOffset(routeIndex: Int): Offset<Path>

    fun convertZonePathOffset(zonePathIndex: Int, offset: Offset<ZonePath>): Offset<Path>

    fun convertBlockOffset(blockIndex: Int, offset: Offset<Block>): Offset<Path>

    fun convertRouteOffset(routeIndex: Int, offset: Offset<Route>): Offset<Path>

    fun getRouteStartZone(routeIndex: Int): Int

    fun getRouteEndZone(routeIndex: Int): Int

    fun getBlockStartZone(blockIndex: Int): Int

    fun getBlockEndZone(blockIndex: Int): Int

    val pathStarted: Boolean
    /** can only be called if pathStarted */
    val travelledPathBegin: Offset<Path>

    val pathComplete: Boolean
    /** can only be called if pathComplete */
    val travelledPathEnd: Offset<Path> //

    fun toTravelledPath(offset: Offset<Path>): Offset<TravelledPath>

    fun fromTravelledPath(offset: Offset<TravelledPath>): Offset<Path>
}

fun incrementalPathOf(rawInfra: RawInfra, blockInfra: BlockInfra): IncrementalPath {
    return IncrementalPathImpl(rawInfra, blockInfra)
}

private class IncrementalPathImpl(
    private val rawInfra: RawInfra,
    private val blockInfra: BlockInfra,

    // objects
    private var zonePaths: AppendOnlyLinkedList<ZonePathId> = appendOnlyLinkedListOf(),
    override var routes: AppendOnlyLinkedList<RouteId> = appendOnlyLinkedListOf(),
    private var blocks: AppendOnlyLinkedList<BlockId> = appendOnlyLinkedListOf(),

    // lookup tables from blocks and routes to zone path bounds
    private val blockZoneBounds: AppendOnlyLinkedList<Int> = appendOnlyLinkedListOf(),
    private val routeZoneBounds: AppendOnlyLinkedList<Int> = appendOnlyLinkedListOf(0),

    // a lookup table from zone index to zone start path offset
    private var zonePathBounds: AppendOnlyLinkedList<Offset<Path>> =
        appendOnlyLinkedListOf(Offset(0.meters)),
    override var travelledPathBegin: Offset<Path> = Offset((-1).meters),
    override var travelledPathEnd: Offset<Path> = Offset((-1).meters),
) : IncrementalPath {

    override val pathStarted
        get() = travelledPathBegin != Offset<Path>((-1).meters)

    override val pathComplete
        get() = travelledPathEnd != Offset<Path>((-1).meters)

    override val zonePathCount
        get() = zonePaths.size

    override val blockCount
        get() = blocks.size

    override val routeCount
        get() = routes.size

    override fun extend(fragment: PathFragment) {
        assert(!pathComplete) { "extending a complete path" }

        // add zones and routes
        for (route in fragment.routes) {
            for (zonePath in rawInfra.getRoutePath(route)) {
                val zonePathLen = rawInfra.getZonePathLength(zonePath)
                val curEndOffset = zonePathBounds.last()
                val newEndOffset = curEndOffset + zonePathLen.distance
                zonePaths.add(zonePath)
                zonePathBounds.add(newEndOffset)
            }
            routeZoneBounds.add(zonePaths.size)
            routes.add(route)
        }

        assert(routes.isNotEmpty())
        assert(routeZoneBounds.size == routes.size + 1)

        if (fragment.blocks.size == 0) {
            assert(!fragment.containsStart)
            assert(!fragment.containsEnd)
            return
        }

        // if we're starting the path, locate the start of the first block relative to the first
        // route
        if (blockZoneBounds.isEmpty()) {
            val firstBlock = fragment.blocks[0]
            val firstBlockZonePath = blockInfra.getBlockPath(firstBlock)[0]
            var firstBlockZonePathIndex = -1
            val zonePathList = zonePaths.toList()
            for (zonePathIndex in zonePathList.indices) {
                val zonePath = zonePathList[zonePathIndex]
                if (zonePath == firstBlockZonePath) {
                    firstBlockZonePathIndex = zonePathIndex
                    break
                }
            }
            assert(firstBlockZonePathIndex != -1) {
                "block does not have any common points with routes"
            }

            // initialize block zone bounds
            blockZoneBounds.add(firstBlockZonePathIndex)
        }

        // find the index of the zone path at which this fragment's blocks start
        val fragmentBlocksStartZoneIndex = blockZoneBounds.last()

        if (fragment.containsStart) {
            assert(!pathStarted)
            val curBlockOffset = zonePathBounds[fragmentBlocksStartZoneIndex]
            travelledPathBegin = curBlockOffset + fragment.travelledPathBegin
        }

        var fragBlocksZoneCount = 0
        for (block in fragment.blocks) {
            val blockPath = blockInfra.getBlockPath(block)
            fragBlocksZoneCount += blockPath.size
            val blockEndZonePathIndex = fragmentBlocksStartZoneIndex + fragBlocksZoneCount
            assert(blockEndZonePathIndex <= zonePaths.size)
            blocks.add(block)
            blockZoneBounds.add(blockEndZonePathIndex)
        }

        if (fragment.containsEnd) {
            val blockPathEnd = zonePathBounds[blockZoneBounds.last()]
            travelledPathEnd = blockPathEnd - fragment.travelledPathEnd
        }
    }

    override fun clone(): IncrementalPath {
        return IncrementalPathImpl(
            this.rawInfra,
            this.blockInfra,
            this.zonePaths.shallowCopy(),
            this.routes.shallowCopy(),
            this.blocks.shallowCopy(),
            this.blockZoneBounds.shallowCopy(),
            this.routeZoneBounds.shallowCopy(),
            this.zonePathBounds.shallowCopy(),
            this.travelledPathBegin,
            this.travelledPathEnd
        )
    }

    override fun getBlock(blockIndex: Int): BlockId {
        return blocks[blockIndex]
    }

    override fun getRoute(routeIndex: Int): RouteId {
        return routes[routeIndex]
    }

    override fun getZonePath(zonePathIndex: Int): ZonePathId {
        return zonePaths[zonePathIndex]
    }

    override fun getZonePathStartOffset(zonePathIndex: Int): Offset<Path> {
        return zonePathBounds[zonePathIndex]
    }

    override fun getBlockStartOffset(blockIndex: Int): Offset<Path> {
        return getZonePathStartOffset(getBlockStartZone(blockIndex))
    }

    override fun getRouteStartOffset(routeIndex: Int): Offset<Path> {
        return getZonePathStartOffset(getRouteStartZone(routeIndex))
    }

    override fun getZonePathEndOffset(zonePathIndex: Int): Offset<Path> {
        return zonePathBounds[zonePathIndex + 1]
    }

    override fun getBlockEndOffset(blockIndex: Int): Offset<Path> {
        return getZonePathEndOffset(getBlockEndZone(blockIndex) - 1)
    }

    override fun getRouteEndOffset(routeIndex: Int): Offset<Path> {
        return getZonePathEndOffset(getRouteEndZone(routeIndex) - 1)
    }

    override fun convertZonePathOffset(zonePathIndex: Int, offset: Offset<ZonePath>): Offset<Path> {
        return getZonePathStartOffset(zonePathIndex) + offset.distance
    }

    override fun convertBlockOffset(blockIndex: Int, offset: Offset<Block>): Offset<Path> {
        return getBlockStartOffset(blockIndex) + offset.distance
    }

    override fun convertRouteOffset(routeIndex: Int, offset: Offset<Route>): Offset<Path> {
        return getRouteStartOffset(routeIndex) + offset.distance
    }

    override fun getRouteStartZone(routeIndex: Int): Int {
        return routeZoneBounds[routeIndex]
    }

    override fun getRouteEndZone(routeIndex: Int): Int {
        return routeZoneBounds[routeIndex + 1]
    }

    override fun getBlockStartZone(blockIndex: Int): Int {
        return blockZoneBounds[blockIndex]
    }

    override fun getBlockEndZone(blockIndex: Int): Int {
        return blockZoneBounds[blockIndex + 1]
    }

    override fun toTravelledPath(offset: Offset<Path>): Offset<TravelledPath> {
        return Offset(offset.distance - travelledPathBegin.distance)
    }

    override fun fromTravelledPath(offset: Offset<TravelledPath>): Offset<Path> {
        return Offset(offset.distance + travelledPathBegin.distance)
    }
}
