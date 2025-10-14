package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.OffsetList

/* /!\ All these sealed interfaces are not meant to be implemented:
 * these are used to implement type-safe numerical identifiers /!\
 */

/** A track vacancy detection section. These rely on detectors to operate. */
sealed interface Zone

typealias ZoneId = StaticIdx<Zone>

interface LocationInfra : TrackNetworkInfra, TrackInfra, TrackProperties {
    val zones: StaticIdxSpace<Zone>

    fun getMovableElements(zone: ZoneId): StaticIdxSortedSet<TrackNode>

    fun getZoneBounds(zone: ZoneId): List<DirDetectorId>

    fun getZoneName(zone: ZoneId): String

    fun getZoneFromName(name: String): ZoneId

    val detectors: StaticIdxSpace<Detector>

    fun getNextZone(dirDet: DirDetectorId): ZoneId?

    fun getPreviousZone(dirDet: DirDetectorId): ZoneId?

    fun getDetectorName(det: DetectorId): String

    fun getTrackChunkZone(chunk: TrackChunkId): ZoneId?
}

fun LocationInfra.isBufferStop(detector: StaticIdx<Detector>): Boolean {
    return getNextZone(detector.increasing) == null || getNextZone(detector.decreasing) == null
}

interface ReservationInfra : LocationInfra {
    val zonePaths: StaticIdxSpace<ZonePath>

    fun findZonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        movableElements: List<TrackNodeId>,
        trackNodeConfigs: List<TrackNodeConfigId>,
    ): ZonePathId?

    fun getZonePathEntry(zonePath: ZonePathId): DirDetectorId

    fun getZonePathExit(zonePath: ZonePathId): DirDetectorId

    fun getZonePathLength(zonePath: ZonePathId): Length<ZonePath>

    /** The movable elements in the order encountered when traversing the zone from entry to exit */
    fun getZonePathMovableElements(zonePath: ZonePathId): List<TrackNodeId>

    /** The movable element configs in the same order as movable elements */
    fun getZonePathMovableElementsConfigs(zonePath: ZonePathId): List<TrackNodeConfigId>

    /** The distances from the beginning of the zone path to its switches, in encounter order */
    fun getZonePathMovableElementsPositions(zonePath: ZonePathId): OffsetList<ZonePath>

    /** Returns the list of track chunks on the zone path */
    fun getZonePathChunks(zonePath: ZonePathId): List<DirTrackChunkId>
}

fun ReservationInfra.getZonePathZone(zonePath: ZonePathId): ZoneId {
    return getNextZone(getZonePathEntry(zonePath))!!
}

/** A zone path is a path inside a zone */
sealed interface ZonePath

typealias ZonePathId = StaticIdx<ZonePath>

/** A route is a path from detector to detector */
sealed interface Route

typealias RouteId = StaticIdx<Route>

@Suppress("INAPPLICABLE_JVM_NAME")
interface RoutingInfra : ReservationInfra {
    val routes: StaticIdxSpace<Route>

    fun getRoutePath(route: RouteId): List<ZonePathId>

    fun getRouteName(route: RouteId): String

    fun getRouteLength(route: RouteId): Length<Route>

    fun getRouteFromName(name: String): RouteId

    /**
     * Returns a list of indices of zones in the train path at which the reservations shall be
     * released.
     */
    fun getRouteReleaseZones(route: RouteId): IntArray

    fun getChunksOnRoute(route: RouteId): List<DirTrackChunkId>

    fun getRoutesOnTrackChunk(trackChunk: DirTrackChunkId): List<RouteId>

    fun getRoutesStartingAtDet(dirDetector: DirDetectorId): List<RouteId>

    fun getRoutesEndingAtDet(dirDetector: DirDetectorId): List<RouteId>
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
