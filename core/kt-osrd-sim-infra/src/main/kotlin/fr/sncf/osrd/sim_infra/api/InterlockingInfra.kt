package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*
import kotlin.time.Duration


/* /!\ All these sealed interfaces are not meant to be implemented:
* these are used to implement type-safe numerical identifiers /!\
*/

/** Switches and crossings are movable elements */
sealed interface MovableElement
typealias MovableElementId = StaticIdx<MovableElement>

/** A possible configuration for a movable element. Each movable element has its own configuration space */
sealed interface MovableElementConfig
typealias MovableElementConfigId = StaticIdx<MovableElementConfig>


interface MovableElementsInfra {
    val movableElements: StaticIdxSpace<MovableElement>
    fun getMovableElementConfigs(movableElement: MovableElementId): StaticIdxSpace<MovableElementConfig>
    fun getMovableElementDelay(movableElement: MovableElementId): Duration
    fun getMovableElementConfigName(movableElement: MovableElementId, config: MovableElementConfigId): String
}


/** Detectors are notified when trains */
sealed interface Detector
typealias DetectorId = StaticIdx<Detector>


/** A track vacancy detection section. These rely on detectors to operate. */
sealed interface Zone
typealias ZoneId = StaticIdx<Zone>


/** A directional detector encodes a direction over a detector */
@JvmInline
value class DirDetectorId private constructor(private val data: UInt) : NumIdx {
    public constructor(detector: StaticIdx<Detector>, direction: Direction) : this(
        (detector.index shl 1) or when (direction) {
            Direction.NORMAL -> 0u
            Direction.REVERSE -> 1u
        })

    override val index: UInt get() = data

    val detector: DetectorId get() = StaticIdx(data shr 1)
    val direction: Direction get() = when ((data and 1u) != 0u) {
        false -> Direction.NORMAL
        true -> Direction.REVERSE
    }

    val opposite: DirDetectorId get() = DirDetectorId(data xor 1u)
}

val DetectorId.normal get() = DirDetectorId(this, Direction.NORMAL)
val DetectorId.reverse get() = DirDetectorId(this, Direction.REVERSE)

interface LocationInfra : MovableElementsInfra {
    val zones: StaticIdxSpace<Zone>
    fun getMovableElements(zone: ZoneId): StaticIdxSortedSet<MovableElement>
    fun getZoneBounds(zone: ZoneId): List<DirDetectorId>

    val detectors: StaticIdxSpace<Detector>
    fun getNextZone(dirDet: DirDetectorId): ZoneId?
    fun getPreviousZone(dirDet: DirDetectorId): ZoneId?
    fun getDetectorName(det: DetectorId): String?
}

fun LocationInfra.getZoneName(zone: ZoneId): String {
    return "zone.${getZoneBounds(zone).map { "${getDetectorName(it.detector)}:${it.direction}" }.minOf { it }}"
}

fun LocationInfra.isBufferStop(detector: StaticIdx<Detector>): Boolean {
    return getNextZone(detector.normal) == null || getNextZone(detector.reverse) == null
}


interface ReservationInfra : LocationInfra {
    val zonePaths: StaticIdxSpace<ZonePath>
    fun findZonePath(entry: DirDetectorId, exit: DirDetectorId,
                     movableElements: StaticIdxList<MovableElement>,
                     movableElementConfigs: StaticIdxList<MovableElementConfig>): ZonePathId?
    fun getZonePathEntry(zonePath: ZonePathId): DirDetectorId
    fun getZonePathExit(zonePath: ZonePathId): DirDetectorId
    fun getZonePathLength(zonePath: ZonePathId): Distance
    /** The movable elements in the order encountered when traversing the zone from entry to exit */
    fun getZonePathMovableElements(zonePath: ZonePathId): StaticIdxList<MovableElement>
    /** The movable element configs in the same order as movable elements */
    fun getZonePathMovableElementsConfigs(zonePath: ZonePathId): StaticIdxList<MovableElementConfig>
    /** The distances from the beginning of the zone path to its switches, in encounter order */
    fun getZonePathMovableElementsDistances(zonePath: ZonePathId): DistanceList
}

/** A zone path is a path inside a zone */
sealed interface ZonePath
typealias ZonePathId = StaticIdx<ZonePath>


/** A route is a path from detector to detector */
sealed interface Route
typealias RouteId = StaticIdx<Route>


interface RoutingInfra : ReservationInfra {
    val routes: StaticIdxSpace<Route>
    fun getRoutePath(route: RouteId): StaticIdxList<ZonePath>
    fun getRouteName(route: RouteId): String?

    /** Returns a list of indices of zones in the train path at which the reservations shall be released. */
    fun getRouteReleaseZones(route: RouteId): IntArray
}

fun ReservationInfra.findZonePath(entry: DirDetectorId, exit: DirDetectorId): ZonePathId? {
    return findZonePath(entry, exit, mutableStaticIdxArrayListOf(), mutableStaticIdxArrayListOf())
}

fun RoutingInfra.getRouteEntry(route: RouteId): DirDetectorId {
    return getZonePathEntry(getRoutePath(route).first())
}

fun RoutingInfra.getRouteExit(route: RouteId): DirDetectorId {
    return getZonePathExit(getRoutePath(route).last())
}

typealias InterlockingInfra = RoutingInfra
