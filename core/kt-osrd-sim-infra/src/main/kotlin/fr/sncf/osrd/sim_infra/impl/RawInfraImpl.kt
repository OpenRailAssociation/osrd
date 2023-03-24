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

interface RouteDescriptor {
    val name: String?
    val path: StaticIdxList<ZonePath>
    val releaseZones: IntArray
    val speedLimits: StaticIdxList<SpeedLimit>
    val speedLimitStarts: DistanceList
    val speedLimitEnds: DistanceList
}

class LogicalSignalDescriptor(
    val signalingSystemId: String,
    val nextSignalingSystemIds: List<String>,
    val rawSettings: Map<String, String>,
)

class PhysicalSignalDescriptor(
    val name: String?,
    val logicalSignals: StaticIdxList<LogicalSignal>,
    val sightDistance: Distance,
)

open class ZonePathSpec(
    val entry: DirDetectorId,
    val exit: DirDetectorId,
    val movableElements: StaticIdxList<MovableElement>,
    val movableElementsConfigs: StaticIdxList<MovableElementConfig>,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ZonePathSpec) return false
        if (entry != other.entry) return false
        if (exit != other.exit) return false
        if (movableElements != other.movableElements) return false
        if (movableElementsConfigs != other.movableElementsConfigs) return false
        return true
    }

    override fun hashCode(): Int {
        var result = entry.hashCode()
        result = 31 * result + exit.hashCode()
        return result
    }
}

class ZonePathDescriptor(
    entry: DirDetectorId,
    exit: DirDetectorId,
    val length: Distance,
    movableElements: StaticIdxList<MovableElement>,
    movableElementsConfigs: StaticIdxList<MovableElementConfig>,
    val movableElementsDistances: DistanceList,
    val signals: StaticIdxList<PhysicalSignal>,
    val signalPositions: DistanceList,
) : ZonePathSpec(entry, exit, movableElements, movableElementsConfigs)


class RawInfraImpl(
    val movableElementPool: StaticPool<MovableElement, MovableElementDescriptor>,
    val zonePool: StaticPool<Zone, ZoneDescriptor>,
    val detectorPool: StaticPool<Detector, String?>,
    val nextZones: IdxMap<DirDetectorId, ZoneId>,
    val routeDescriptors: StaticPool<Route, RouteDescriptor>,
    val logicalSignalPool: StaticPool<LogicalSignal, LogicalSignalDescriptor>,
    val physicalSignalPool: StaticPool<PhysicalSignal, PhysicalSignalDescriptor>,
    val zonePathPool: StaticPool<ZonePath, ZonePathDescriptor>,
    val zonePathMap: Map<ZonePathSpec, ZonePathId>
) : RawInfra {
    override val movableElements: StaticIdxSpace<MovableElement>
        get() = movableElementPool.space()

    private val zoneDetectors: IdxMap<ZoneId, MutableList<DirDetectorId>> = IdxMap()
    private val parentSignalMap: IdxMap<LogicalSignalId, PhysicalSignalId> = IdxMap()

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

        // initialize the physical signal to logical signal map
        for (physicalSignal in physicalSignalPool)
            for (child in physicalSignalPool[physicalSignal].logicalSignals)
                parentSignalMap[child] = physicalSignal
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

    override fun getDetectorName(det: DetectorId): String? {
        return detectorPool[det]
    }

    override fun getSignals(zonePath: ZonePathId): StaticIdxList<PhysicalSignal> {
        return zonePathPool[zonePath].signals
    }

    override fun getSignalPositions(zonePath: ZonePathId): DistanceList {
        return zonePathPool[zonePath].signalPositions
    }

    override fun getSpeedLimits(route: RouteId): StaticIdxList<SpeedLimit> {
        return routeDescriptors[route].speedLimits
    }

    override fun getSpeedLimitStarts(route: RouteId): DistanceList {
        return routeDescriptors[route].speedLimitStarts
    }

    override fun getSpeedLimitEnds(route: RouteId): DistanceList {
        return routeDescriptors[route].speedLimitEnds
    }

    override val physicalSignals: StaticIdxSpace<PhysicalSignal>
        get() = physicalSignalPool.space()
    override val logicalSignals: StaticIdxSpace<LogicalSignal>
        get() = logicalSignalPool.space()

    override fun getLogicalSignals(signal: PhysicalSignalId): StaticIdxList<LogicalSignal> {
        return physicalSignalPool[signal].logicalSignals
    }

    override fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId {
        return parentSignalMap[signal]!!
    }

    override fun getPhysicalSignalName(signal: PhysicalSignalId): String? {
        return physicalSignalPool[signal].name
    }

    override fun getSignalSightDistance(signal: PhysicalSignalId): Distance {
        return physicalSignalPool[signal].sightDistance
    }

    override fun getSignalingSystemId(signal: LogicalSignalId): String {
        return logicalSignalPool[signal].signalingSystemId
    }

    override fun getRawSettings(signal: LogicalSignalId): Map<String, String> {
        return logicalSignalPool[signal].rawSettings
    }

    override fun getNextSignalingSystemIds(signal: LogicalSignalId): List<String> {
        return logicalSignalPool[signal].nextSignalingSystemIds
    }

    override val zonePaths: StaticIdxSpace<ZonePath>
        get() = zonePathPool.space()

    override fun findZonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        movableElements: StaticIdxList<MovableElement>,
        movableElementConfigs: StaticIdxList<MovableElementConfig>
    ): ZonePathId? {
        return zonePathMap[ZonePathSpec(entry, exit, movableElements, movableElementConfigs)]
    }

    override fun getZonePathEntry(zonePath: ZonePathId): DirDetectorId {
        return zonePathPool[zonePath].entry
    }

    override fun getZonePathExit(zonePath: ZonePathId): DirDetectorId {
        return zonePathPool[zonePath].exit
    }

    override fun getZonePathLength(zonePath: ZonePathId): Distance {
        return zonePathPool[zonePath].length
    }

    override fun getZonePathMovableElements(zonePath: ZonePathId): StaticIdxList<MovableElement> {
        return zonePathPool[zonePath].movableElements
    }

    override fun getZonePathMovableElementsConfigs(zonePath: ZonePathId): StaticIdxList<MovableElementConfig> {
        return zonePathPool[zonePath].movableElementsConfigs
    }

    override fun getZonePathMovableElementsDistances(zonePath: ZonePathId): DistanceList {
        return zonePathPool[zonePath].movableElementsDistances
    }

    override val routes: StaticIdxSpace<Route>
        get() = routeDescriptors.space()


    override fun getRoutePath(route: RouteId): StaticIdxList<ZonePath> {
        return routeDescriptors[route].path
    }

    override fun getRouteName(route: RouteId): String? {
        return routeDescriptors[route].name
    }

    override fun getRouteReleaseZones(route: RouteId): IntArray {
        return routeDescriptors[route].releaseZones
    }
}
