package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.utils.units.Offset

/**
 * Contains all routes used by the train. Routes are always included in full here, even if they're
 * only partially used.
 */
interface FullRoutePath {
    fun getRoutes(): List<RouteId>

    fun getRouteOffsets(): List<Offset<FullRoutePath>>
}
