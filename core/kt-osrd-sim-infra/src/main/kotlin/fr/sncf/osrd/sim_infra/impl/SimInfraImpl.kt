package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*
import kotlin.time.Duration


@JvmInline
value class MovableElementConfigDescriptor(val name: String)

class MovableElementDescriptor(
    val delay: Duration,
    val configs: StaticPool<MovableElementConfig, MovableElementConfigDescriptor>,
)

@JvmInline
value class ZoneDescriptor(val movableElements: StaticIdxSortedSet<MovableElement>)

class RouteDescriptor(val path: List<ZonePath>, val releaseZones: IntArray)

@JvmInline
value class RouteEntryDescriptor(
    val detector: DirDetectorId,
)

class BlockDescriptor(val path: List<ZonePath>, val type: BlockTypeId)

@JvmInline
value class BlockTypeDescriptor(val name: String)

class SimInfraImpl(
    val movableElementPool: StaticPool<MovableElement, MovableElementDescriptor>,
    val zonePool: StaticPool<Zone, ZoneDescriptor>,
    val detectorPool: VirtualStaticPool<Detector>,
    val nextZones: IdxMap<DirDetectorId, ZoneId>,
    val routePool: StaticPool<Route, RouteDescriptor>,
    val blockPool: StaticPool<Block, BlockDescriptor>,
    val blockPerEntry: StaticIdxMap<BlockType, IdxMap<DirDetectorId, StaticIdxList<Block>>>,
    val blockTypePool: StaticPool<BlockType, BlockTypeDescriptor>,
) : SimInfra {
    override val movableElements: StaticIdxSpace<MovableElement>
        get() = movableElementPool.space()

    private val zoneDetectors: IdxMap<ZoneId, MutableList<DirDetectorId>> = IdxMap()

    init {
        // initialize the zone detector map
        for (zone in zonePool)
            zoneDetectors[zone] = mutableListOf()
        for (detector in detectorPool) {
            val nextZone = getNextZone(detector.normal)
            if (nextZone != null)
                zoneDetectors[nextZone]!!.add(detector.normal)
            val prevZone = getNextZone(detector.reverse)
            if (prevZone != null)
                zoneDetectors[prevZone]!!.add(detector.reverse)
        }
    }

    override fun getMovableElementConfigs(movableElement: MovableElementId): StaticIdxSpace<MovableElementConfig> {
        return movableElementPool[movableElement].configs.space()
    }

    override fun getMovableElementDelay(movableElement: MovableElementId): Duration {
        return movableElementPool[movableElement].delay
    }

    override fun getMovableElementConfigName(
        movableElement: MovableElementId,
        config: MovableElementConfigId
    ): String {
        return movableElementPool[movableElement].configs[config].name
    }

    override val zones: StaticIdxSpace<Zone>
        get() = zonePool.space()

    override fun getMovableElements(zone: ZoneId): StaticIdxSortedSet<MovableElement> {
        return zonePool[zone].movableElements
    }

    override fun getZoneBounds(zone: ZoneId): List<DirDetectorId> {
        return zoneDetectors[zone]!!
    }

    override val detectors: StaticIdxSpace<Detector>
        get() = detectorPool.space()

    override fun getNextZone(dirDet: DirDetectorId): ZoneId? {
        return nextZones[dirDet]
    }

    override fun getPreviousZone(dirDet: DirDetectorId): ZoneId? {
        return nextZones[dirDet.opposite]
    }

    override val routes: StaticIdxSpace<Route>
        get() = routePool.space()


    override fun getRoutePath(route: RouteId): List<ZonePath> {
        return routePool[route].path
    }

    override fun getRouteReleaseZones(route: RouteId): IntArray {
        return routePool[route].releaseZones
    }

    override val blocks: StaticIdxSpace<Block>
        get() = blockPool.space()
    override val blockTypes: StaticIdxSpace<BlockType>
        get() = blockTypePool.space()

    override fun getBlockPath(block: BlockId): List<ZonePath> {
        return blockPool[block].path
    }

    override fun getBlockType(block: BlockId): BlockTypeId {
        return blockPool[block].type
    }

    override fun getBlocksAt(detector: DirDetectorId, type: BlockTypeId): StaticIdxList<Block> {
        return blockPerEntry[type]!![detector]!!
    }
}
