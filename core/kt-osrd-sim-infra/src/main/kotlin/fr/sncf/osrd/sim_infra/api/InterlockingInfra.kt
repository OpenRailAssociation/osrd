package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*


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

    val detectors: StaticIdxSpace<Detector>
    fun getNextZone(dirDet: DirDetectorId): ZoneId?
    fun getPreviousZone(dirDet: DirDetectorId): ZoneId?
    fun getDetectorName(det: DetectorId): String?
}

fun LocationInfra.getZoneName(zone: ZoneId): String {
    return "zone.${getZoneBounds(zone).map { "${getDetectorName(it.value)}:${it.direction}" }.minOf { it }}"
}

fun LocationInfra.isBufferStop(detector: StaticIdx<Detector>): Boolean {
    return getNextZone(detector.increasing) == null || getNextZone(detector.decreasing) == null
}


@Suppress("INAPPLICABLE_JVM_NAME")
interface ReservationInfra : LocationInfra {
    val zonePaths: StaticIdxSpace<ZonePath>
    fun findZonePath(entry: DirDetectorId, exit: DirDetectorId,
                     movableElements: StaticIdxList<TrackNode>,
                     trackNodeConfigs: StaticIdxList<TrackNodeConfig>): ZonePathId?
    fun getZonePathEntry(zonePath: ZonePathId): DirDetectorId
    fun getZonePathExit(zonePath: ZonePathId): DirDetectorId
    @JvmName("getZonePathLength")
    fun getZonePathLength(zonePath: ZonePathId): Distance
    /** The movable elements in the order encountered when traversing the zone from entry to exit */
    fun getZonePathMovableElements(zonePath: ZonePathId): StaticIdxList<TrackNode>
    /** The movable element configs in the same order as movable elements */
    fun getZonePathMovableElementsConfigs(zonePath: ZonePathId): StaticIdxList<TrackNodeConfig>
    /** The distances from the beginning of the zone path to its switches, in encounter order */
    fun getZonePathMovableElementsDistances(zonePath: ZonePathId): DistanceList
    /** Returns the list of track chunks on the zone path */
    @JvmName("getZonePathChunks")
    fun getZonePathChunks(zonePath: ZonePathId): DirStaticIdxList<TrackChunk>
}

/** A zone path is a path inside a zone */
sealed interface ZonePath
typealias ZonePathId = StaticIdx<ZonePath>


/** A route is a path from detector to detector */
sealed interface Route
typealias RouteId = StaticIdx<Route>


@Suppress("INAPPLICABLE_JVM_NAME")
interface RoutingInfra : ReservationInfra {
    @get:JvmName("getRoutes")
    val routes: StaticIdxSpace<Route>
    @JvmName("getRoutePath")
    fun getRoutePath(route: RouteId): StaticIdxList<ZonePath>
    @JvmName("getRouteName")
    fun getRouteName(route: RouteId): String?

    /** Returns a list of indices of zones in the train path at which the reservations shall be released. */
    fun getRouteReleaseZones(route: RouteId): IntArray
    @JvmName("getChunksOnRoute")
    fun getChunksOnRoute(route: RouteId): DirStaticIdxList<TrackChunk>
    @JvmName("getRoutesOnTrackChunk")
    fun getRoutesOnTrackChunk(trackChunk: DirTrackChunkId): StaticIdxList<Route>
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
