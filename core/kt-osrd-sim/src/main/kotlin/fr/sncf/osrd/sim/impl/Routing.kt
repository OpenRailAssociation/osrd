package fr.sncf.osrd.sim.impl

import fr.sncf.osrd.sim.api.*
import fr.sncf.osrd.sim_infra.api.LocationInfra
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.RoutingInfra
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.utils.indexing.DynIdx
import fr.sncf.osrd.utils.indexing.mutableArenaMap
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import mu.KotlinLogging


private val logger = KotlinLogging.logger {}


fun <InfraT> routingSim(
    infra: InfraT,
    movableElementSim: MovableElementSim,
    reservationSim: ReservationSim,
    scope: CoroutineScope,
): RoutingSim where InfraT: LocationInfra, InfraT: RoutingInfra {
    return RoutingSimImpl(infra, movableElementSim, reservationSim, scope)
}

internal class RoutingSimImpl<InfraT>(
    private val infra: InfraT,
    private val movableElementSim: MovableElementSim,
    private val reservationSim: ReservationSim,
    private val scope: CoroutineScope,
    ) : RoutingSim where InfraT: LocationInfra, InfraT: RoutingInfra {
    private val destructionProcesses = mutableArenaMap<RouteCallHandle, Job>()

    private fun destructionJob(route: RouteId, pathZones: Array<ZoneId>, handles: List<ZoneReservationId>): Job = scope.launch {
        val releaseZones = infra.getRouteReleaseZones(route)
        var lastReleasedZone = -1
        for (zoneIndex in releaseZones) {
            // wait for the release zone to be pending release
            reservationSim.awaitPendingRelease(pathZones[zoneIndex], handles[zoneIndex])

            // release all zones before and including this one
            for (releasedZone in lastReleasedZone + 1 until zoneIndex + 1)
                reservationSim.release(pathZones[releasedZone], handles[releasedZone])
            lastReleasedZone = zoneIndex
        }
    }

    override suspend fun call(route: RouteId, train: TrainId): DynIdx<RouteCallHandle> {
        val path = infra.getRoutePath(route)
        // the zones as encountered by the route
        val pathZones = Array(path.size) { i -> infra.getNextZone(path[i].entry)!! }
        // a lookup table sorted by zone lock order
        val zoneLockOrder = IntArray(path.size) { it }.sortedBy { pathZones[it].index }

        // lock zones in order
        logger.debug { "locking zones of route $route for train $train" }
        for (zoneIndex in zoneLockOrder)
            reservationSim.lockZone(pathZones[zoneIndex])

        // for each zone, start a pre-reservation process
        val reservationHandles =  pathZones.indices.map { zoneIndex ->
            scope.async {
                val zone = pathZones[zoneIndex]
                val zonePath = path[zoneIndex]
                // wait for the current reservations to be compatible
                logger.debug { "waiting for zone $zone to be compatible with route $route" }
                val newRequirements = zonePath.toRequirements()
                reservationSim.watchZoneConfig(zone).filter {
                    // this function returns whether we found a compatible configuration
                    it.requirements()?.compatibleWith(newRequirements) ?: true
                }.first()

                for (i in 0 until zonePath.movableElements.size) {
                    val movableElement = zonePath.movableElements[i]
                    val movableElementConfig = zonePath.movableElementConfigs[i]
                    movableElementSim.withLock(movableElement) {
                        movableElementSim.move(movableElement, movableElementConfig)
                    }
                }

                val handle = reservationSim.preReserve(zone, path[zoneIndex], train)
                logger.debug { "unlocking zone $zone" }
                reservationSim.unlockZone(zone)
                handle
            }
        }.awaitAll()

        logger.debug { "confirming reservations of route $route for train $train" }
        for (zoneIndex in pathZones.indices.reversed()) {
            val zone = pathZones[zoneIndex]
            val handle = reservationHandles[zoneIndex]
            reservationSim.confirm(zone, handle)
        }

        logger.debug { "starting the destruction job for route $route for train $train" }
        val destructionJob = destructionJob(route, pathZones, reservationHandles)
        return destructionProcesses.allocate(destructionJob)
    }

    override suspend fun waitDestroyed(routeHandle: DynIdx<RouteCallHandle>) {
        destructionProcesses[routeHandle].join()
    }
}
