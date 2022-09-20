package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*
import kotlin.time.Duration


class MovableElementDescriptorBuilder @PublishedApi internal constructor (
    private val delay: Duration,
    private val configs: StaticPool<MovableElementConfig, MovableElementConfigDescriptor>,
    var defaultConfig: MovableElementConfigId?
) {
    fun config(name: String): MovableElementConfigId {
        return configs.add(MovableElementConfigDescriptor(name))
    }

    @PublishedApi internal fun build(): MovableElementDescriptor {
        if (defaultConfig == null)
            throw RuntimeException("invalid MovableElement: there must be a default config")
        return MovableElementDescriptor(delay, configs, defaultConfig!!)
    }
}

class SimInfraBuilder @PublishedApi internal constructor(
    @PublishedApi internal val movableElementPool: StaticPool<MovableElement, MovableElementDescriptor>,
    @PublishedApi internal val zonePool: StaticPool<Zone, ZoneDescriptor>,
    @PublishedApi internal val detectorPool: VirtualStaticPool<Detector>,
    @PublishedApi internal val nextZones: IdxMap<DirDetectorId, ZoneId>,
    @PublishedApi internal val routePool: StaticPool<Route, RouteDescriptor>,
    @PublishedApi internal val blockPool: StaticPool<Block, BlockDescriptor>,
    @PublishedApi internal val blockPerEntry: StaticIdxMap<BlockType, IdxMap<DirDetectorId, StaticIdxList<Block>>>,
    @PublishedApi internal val blockTypePool: StaticPool<BlockType, BlockTypeDescriptor>
) {
    constructor() : this(
        StaticPool(),
        StaticPool(),
        VirtualStaticPool(),
        IdxMap(),
        StaticPool(),
        StaticPool(),
        IdxMap(),
        StaticPool(),
    )

    inline fun movableElement(delay: Duration, init: MovableElementDescriptorBuilder.() -> Unit): MovableElementId {
        val movableElementBuilder = MovableElementDescriptorBuilder(delay, StaticPool(), null)
        movableElementBuilder.init()
        val movableElement = movableElementBuilder.build()
        return movableElementPool.add(movableElement)
    }

    fun detector(): DetectorId {
        return detectorPool.next()
    }

    fun linkZones(zoneA: ZoneId, zoneB: ZoneId): DetectorId {
        val det = detector()
        linkZones(det, zoneA, zoneB)
        return det
    }

    fun linkZones(detector: DetectorId, zoneA: ZoneId, zoneB: ZoneId) {
        nextZones[detector.normal] = zoneA
        nextZones[detector.reverse] = zoneB
    }

    fun setNextZone(detector: DirDetectorId, zone: ZoneId) {
        nextZones[detector] = zone
    }

    fun zone(movableElements: StaticIdxSortedSet<MovableElement>): ZoneId {
        return zonePool.add(ZoneDescriptor(movableElements))
    }

    fun zone(movableElements: List<MovableElementId>): ZoneId {
        val set = MutableStaticIdxArraySet<MovableElement>()
        for (item in movableElements)
            set.add(item)
        return zonePool.add(ZoneDescriptor(set))
    }

    fun zone(movableElements: StaticIdxSortedSet<MovableElement>, bounds: List<DirDetectorId>): ZoneId {
        val zone = zonePool.add(ZoneDescriptor(movableElements))
        for (detectorDir in bounds)
            setNextZone(detectorDir, zone)
        return zone
    }

    fun route(path: List<ZonePath>, releaseZones: IntArray): RouteId {
        return routePool.add(RouteDescriptor(path, releaseZones))
    }

    fun build(): SimInfra {
        return SimInfraImpl(
            movableElementPool,
            zonePool,
            detectorPool,
            nextZones,
            routePool,
            blockPool,
            blockPerEntry,
            blockTypePool
        )
    }
}

inline fun simInfra(init: SimInfraBuilder.() -> Unit): SimInfra {
    val infraBuilder = SimInfraBuilder()
    infraBuilder.init()
    return infraBuilder.build()
}
