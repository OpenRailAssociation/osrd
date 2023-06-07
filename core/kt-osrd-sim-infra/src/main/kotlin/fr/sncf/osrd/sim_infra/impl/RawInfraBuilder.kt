package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*
import kotlin.time.Duration


interface MovableElementDescriptorBuilder {
    fun config(name: String): MovableElementConfigId
}

class MovableElementDescriptorBuilderImpl(
    private val delay: Duration,
    private val configs: StaticPool<MovableElementConfig, MovableElementConfigDescriptor>,
) : MovableElementDescriptorBuilder {
    override fun config(name: String): MovableElementConfigId {
        return configs.add(MovableElementConfigDescriptor(name))
    }

    fun build(): MovableElementDescriptor {
        return MovableElementDescriptor(delay, configs)
    }
}

interface PhysicalSignalBuilder {
    fun logicalSignal(
        signalingSystem: String,
        nextSignalingSystems: List<String>,
        settings: Map<String, String>
    ): LogicalSignalId
}

class PhysicalSignalBuilderImpl(
    private val name: String?,
    private val sightDistance: Distance,
    private val globalPool: StaticPool<LogicalSignal, LogicalSignalDescriptor>,
) : PhysicalSignalBuilder {
    private val children: MutableStaticIdxList<LogicalSignal> = MutableStaticIdxArrayList()

    override fun logicalSignal(
        signalingSystem: String,
        nextSignalingSystems: List<String>,
        settings: Map<String, String>
    ): LogicalSignalId {
        val logicalSignalId = globalPool.add(LogicalSignalDescriptor(signalingSystem, nextSignalingSystems, settings))
        children.add(logicalSignalId)
        return logicalSignalId
    }

    fun build(): PhysicalSignalDescriptor {
        return PhysicalSignalDescriptor(name, children, sightDistance)
    }
}


interface ZonePathBuilder {
    fun movableElement(movableElement: MovableElementId, config: MovableElementConfigId, zonePathOffset: Distance)
    fun signal(signal: PhysicalSignalId, position: Distance)
}

class ZonePathBuilderImpl(val entry: DirDetectorId, val exit: DirDetectorId, val length: Distance) : ZonePathBuilder {
    private val movableElements = MutableStaticIdxArrayList<MovableElement>()
    private val movableElementsConfigs = MutableStaticIdxArrayList<MovableElementConfig>()
    private val movableElementsDistances = MutableDistanceArrayList()
    private val signals = MutableStaticIdxArrayList<PhysicalSignal>()
    private val signalPositions = MutableDistanceArrayList()


    override fun movableElement(
        movableElement: MovableElementId,
        config: MovableElementConfigId,
        zonePathOffset: Distance
    ) {
        movableElements.add(movableElement)
        movableElementsConfigs.add(config)
        movableElementsDistances.add(zonePathOffset)
    }

    override fun signal(signal: PhysicalSignalId, position: Distance) {
        signals.add(signal)
        signalPositions.add(position)
    }

    fun build(): ZonePathDescriptor {
        return ZonePathDescriptor(
            entry, exit, length,
            movableElements,
            movableElementsConfigs,
            movableElementsDistances,
            signals,
            signalPositions,
        )
    }
}

interface RouteBuilder {
    fun zonePath(zonePath: StaticIdx<ZonePath>)
    fun releaseZone(index: Int)
    fun speedLimit(limit: SpeedLimitId, start: Distance, end: Distance)
}

class RouteBuilderImpl(private val name: String?) : RouteBuilder {
    private val path: MutableStaticIdxList<ZonePath> = mutableStaticIdxArrayListOf()
    private val releaseZones: MutableList<Int> = mutableListOf()
    private val speedLimits: MutableStaticIdxList<SpeedLimit> = mutableStaticIdxArrayListOf()
    private val speedLimitStarts: MutableDistanceList = mutableDistanceArrayListOf()
    private val speedLimitEnds: MutableDistanceList = mutableDistanceArrayListOf()

    override fun zonePath(zonePath: StaticIdx<ZonePath>) {
        path.add(zonePath)
    }

    override fun releaseZone(index: Int) {
        assert(releaseZones.isEmpty() || releaseZones.last() < index)
        releaseZones.add(index)
    }

    override fun speedLimit(limit: SpeedLimitId, start: Distance, end: Distance) {
        speedLimits.add(limit)
        speedLimitStarts.add(start)
        speedLimitEnds.add(end)
    }

    fun build(): RouteDescriptorImpl {
        return RouteDescriptorImpl(
            name,
            path,
            releaseZones.toIntArray(),
            speedLimits,
            speedLimitStarts,
            speedLimitEnds
        )
    }
}

class RouteDescriptorImpl(
    override val name: String?,
    override val path: StaticIdxList<ZonePath>,
    override val releaseZones: IntArray,
    override val speedLimits: StaticIdxList<SpeedLimit>,
    override val speedLimitStarts: DistanceList,
    override val speedLimitEnds: DistanceList,
) : RouteDescriptor

interface RestrictedRawInfraBuilder {
    fun movableElement(delay: Duration, init: MovableElementDescriptorBuilder.() -> Unit): MovableElementId
    fun detector(name: String?): DetectorId
    fun linkZones(zoneA: ZoneId, zoneB: ZoneId): DetectorId
    fun linkZones(detector: DetectorId, zoneA: ZoneId, zoneB: ZoneId)
    fun setNextZone(detector: DirDetectorId, zone: ZoneId)
    fun zone(movableElements: StaticIdxSortedSet<MovableElement>): ZoneId
    fun zone(movableElements: List<MovableElementId>): ZoneId
    fun zone(movableElements: StaticIdxSortedSet<MovableElement>, bounds: List<DirDetectorId>): ZoneId
    fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Distance, init: ZonePathBuilder.() -> Unit): ZonePathId
    fun zonePath(
        entry: DirDetectorId, exit: DirDetectorId,
        length: Distance,
        movableElements: StaticIdxList<MovableElement>,
        movableElementsConfigs: StaticIdxList<MovableElementConfig>,
        movableElementsDistances: DistanceList,
        signals: StaticIdxList<PhysicalSignal>,
        signalPositions: DistanceList,
    ): ZonePathId
    fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Distance): ZonePathId
    fun route(name: String?, init: RouteBuilder.() -> Unit): RouteId
    fun physicalSignal(name: String?, sightDistance: Distance, init: PhysicalSignalBuilder.() -> Unit): PhysicalSignalId
}

interface RawInfraBuilder : RestrictedRawInfraBuilder {
    fun build(): RawInfra
}

class RawInfraBuilderImpl : RawInfraBuilder {
    private val movableElementPool = StaticPool<MovableElement, MovableElementDescriptor>()
    private val zonePool = StaticPool<Zone, ZoneDescriptor>()
    private val detectorPool = StaticPool<Detector, String?>()
    private val nextZones = IdxMap<DirDetectorId, ZoneId>()
    private val routePool = StaticPool<Route, RouteDescriptor>()
    private val logicalSignalPool = StaticPool<LogicalSignal, LogicalSignalDescriptor>()
    private val physicalSignalPool = StaticPool<PhysicalSignal, PhysicalSignalDescriptor>()
    private val zonePathPool = StaticPool<ZonePath, ZonePathDescriptor>()
    private val zonePathMap = mutableMapOf<ZonePathSpec, ZonePathId>()

    override fun movableElement(delay: Duration, init: MovableElementDescriptorBuilder.() -> Unit): MovableElementId {
        val movableElementBuilder = MovableElementDescriptorBuilderImpl(delay, StaticPool())
        movableElementBuilder.init()
        val movableElement = movableElementBuilder.build()
        return movableElementPool.add(movableElement)
    }

    override fun detector(name: String?): DetectorId {
        return detectorPool.add(name)
    }

    override fun linkZones(zoneA: ZoneId, zoneB: ZoneId): DetectorId {
        val det = detector(null)
        linkZones(det, zoneA, zoneB)
        return det
    }

    override fun linkZones(detector: DetectorId, zoneA: ZoneId, zoneB: ZoneId) {
        nextZones[detector.normal] = zoneA
        nextZones[detector.reverse] = zoneB
    }

    override fun setNextZone(detector: DirDetectorId, zone: ZoneId) {
        nextZones[detector] = zone
    }

    override fun zone(movableElements: StaticIdxSortedSet<MovableElement>): ZoneId {
        return zonePool.add(ZoneDescriptor(movableElements))
    }

    override fun zone(movableElements: List<MovableElementId>): ZoneId {
        val set = MutableStaticIdxArraySet<MovableElement>()
        for (item in movableElements)
            set.add(item)
        return zonePool.add(ZoneDescriptor(set))
    }

    override fun zone(movableElements: StaticIdxSortedSet<MovableElement>, bounds: List<DirDetectorId>): ZoneId {
        val zone = zonePool.add(ZoneDescriptor(movableElements))
        for (detectorDir in bounds)
            setNextZone(detectorDir, zone)
        return zone
    }

    override fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Distance, init: ZonePathBuilder.() -> Unit): ZonePathId {
        val builder = ZonePathBuilderImpl(entry, exit, length)
        builder.init()
        val zonePathDesc = builder.build()
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    override fun zonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        length: Distance,
        movableElements: StaticIdxList<MovableElement>,
        movableElementsConfigs: StaticIdxList<MovableElementConfig>,
        movableElementsDistances: DistanceList,
        signals: StaticIdxList<PhysicalSignal>,
        signalPositions: DistanceList,
    ): ZonePathId {
        val zonePathDesc = ZonePathDescriptor(
            entry, exit, length,
            movableElements, movableElementsConfigs, movableElementsDistances,
            signals, signalPositions
        )
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    override fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Distance): ZonePathId {
        val builder = ZonePathBuilderImpl(entry, exit, length)
        val zonePathDesc = builder.build()
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    override fun route(name: String?, init: RouteBuilder.() -> Unit): RouteId {
        val builder = RouteBuilderImpl(name)
        builder.init()
        return routePool.add(builder.build())
    }

    override fun physicalSignal(name: String?, sightDistance: Distance, init: PhysicalSignalBuilder.() -> Unit): PhysicalSignalId {
        val builder = PhysicalSignalBuilderImpl(name, sightDistance, logicalSignalPool)
        builder.init()
        return physicalSignalPool.add(builder.build())
    }

    override fun build(): RawInfra {
        return RawInfraImpl(
            movableElementPool,
            zonePool,
            detectorPool,
            nextZones,
            routePool,
            logicalSignalPool,
            physicalSignalPool,
            zonePathPool,
            zonePathMap,
        )
    }
}

fun RawInfraBuilder(): RawInfraBuilder {
    return RawInfraBuilderImpl()
}

inline fun rawInfra(init: RestrictedRawInfraBuilder.() -> Unit): RawInfra {
    val infraBuilder = RawInfraBuilderImpl()
    infraBuilder.init()
    return infraBuilder.build()
}
