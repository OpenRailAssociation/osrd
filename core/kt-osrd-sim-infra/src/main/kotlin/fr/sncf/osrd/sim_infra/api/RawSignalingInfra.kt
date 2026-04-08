package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxSpace
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetList

/** A fixed size signaling block */
sealed interface Block

typealias BlockId = StaticIdx<Block>

/** A speed limit */
sealed interface SpeedLimit

typealias SpeedLimitId = StaticIdx<SpeedLimit>

sealed interface PhysicalSignal

typealias PhysicalSignalId = StaticIdx<PhysicalSignal>

sealed interface LogicalSignal

typealias LogicalSignalId = StaticIdx<LogicalSignal>

data class RawSignalParameters(
    val default: Map<String, String>,
    val conditional: Map<RouteId, Map<String, String>>,
)

interface RawSignalingInfra : RoutingInfra {
    fun getSignals(zonePath: ZonePathId): List<PhysicalSignalId>

    fun getSignalPositions(zonePath: ZonePathId): OffsetList<ZonePath>

    fun getSpeedLimits(route: RouteId): List<SpeedLimitId>

    fun getSpeedLimitStarts(route: RouteId): OffsetList<Route>

    fun getSpeedLimitEnds(route: RouteId): OffsetList<Route>

    val physicalSignals: StaticIdxSpace<PhysicalSignal>
    val logicalSignals: StaticIdxSpace<LogicalSignal>

    fun getLogicalSignals(signal: PhysicalSignalId): List<LogicalSignalId>

    fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId

    fun getPhysicalSignalTrack(signal: PhysicalSignalId): TrackSectionId

    /** This offset is undirected */
    fun getPhysicalSignalTrackOffset(signal: PhysicalSignalId): Offset<TrackSection>

    fun getPhysicalSignalName(signal: PhysicalSignalId): String?

    fun getSignalSightDistance(signal: PhysicalSignalId): Distance

    fun getSignalingSystemId(signal: LogicalSignalId): String

    fun getRawSettings(signal: LogicalSignalId): Map<String, String>

    fun getRawParameters(signal: LogicalSignalId): RawSignalParameters

    fun getNextSignalingSystemIds(signal: LogicalSignalId): List<String>

    fun findDetector(detectorName: String): DetectorId?
}

fun RawSignalingInfra.getLogicalSignalName(signal: LogicalSignalId): String? {
    return getPhysicalSignalName(getPhysicalSignal(signal))
}

/**
 * From a given sorted list of consecutive directed chunks
 *
 * Return all route-paths (consecutive routes) that cover all the chunks (without interruption and
 * in order)
 */
fun RawSignalingInfra.chunksToRoutePaths(
    consecutiveChunksToCover: List<DirTrackChunkId>
): Set<List<RouteId>> {
    val firstRoutes = getRoutesOnTrackChunk(consecutiveChunksToCover.first())
    return firstRoutes
        .flatMap { firstRoute ->
            getRoutePathsCoveringAllChunks(consecutiveChunksToCover, firstRoute, false)
        }
        .toSet()
}

/**
 * Recursive function
 *
 * From:
 * - a given sorted list of consecutive directed chunks to be covered by a path (multiple routes)
 * - a starting route for those paths (route covers at least the start of the chunk list)
 * - a boolean allowing to skip first chunks of the route (the first route can start with extra
 *   chunks, but not the next ones)
 *
 * Return each route-path that covers all the chunks (without interruption and in order):
 * - a route-path is a sorted list of routes
 * - wrap route-paths into a set
 */
private fun RawSignalingInfra.getRoutePathsCoveringAllChunks(
    consecutiveChunksToCover: List<DirTrackChunkId>,
    currentRoute: RouteId,
    alreadyStartedToCover: Boolean,
): Set<List<RouteId>> {
    val chunksOnCurrentRoute = getChunksOnRoute(currentRoute)
    var idxNextChunkToCover = 0
    var startedToCover = alreadyStartedToCover
    for (chunk in chunksOnCurrentRoute) {
        // Different chunk on route than expected: no valid route-path will be found using current
        // route
        if (startedToCover && consecutiveChunksToCover[idxNextChunkToCover] != chunk) return setOf()

        if (consecutiveChunksToCover[idxNextChunkToCover] == chunk) {
            startedToCover = true
            idxNextChunkToCover++

            // Coverage finished: the current route covers all
            if (idxNextChunkToCover == consecutiveChunksToCover.size)
                return setOf(listOf(currentRoute))
        }
    }
    require(startedToCover)
    require(idxNextChunkToCover > 0)

    // Ongoing coverage:
    // - retrieve sub-route-paths that cover the end of the chunk list (if any)
    // - for each sub-route-path:
    //   - add [current-route + sub-route-path] to the result set
    val currentRouteExit = getRouteExit(currentRoute)
    val nextPossibleRoutes = getRoutesStartingAtDet(currentRouteExit)

    val result = mutableSetOf<List<RouteId>>()
    for (nextRoute in nextPossibleRoutes) {
        val nextRoutePaths =
            getRoutePathsCoveringAllChunks(
                consecutiveChunksToCover.subList(
                    idxNextChunkToCover,
                    consecutiveChunksToCover.size,
                ),
                nextRoute,
                true,
            )
        val completedRoutePaths = nextRoutePaths.map { listOf(currentRoute) + it }
        result.addAll(completedRoutePaths)
    }
    return result
}

typealias RawInfra = RawSignalingInfra
