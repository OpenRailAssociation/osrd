package fr.sncf.osrd.utils

import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf

/**
 * Java can't handle generics with value classes, it's impossible to extract the underlying speed
 * from a `RangeMapEntry` in pure java. This method handles this specific case.
 */
fun rangeMapEntryToSpeedLimitProperty(
    entry: DistanceRangeMap.RangeMapEntry<SpeedLimitProperty>
): SpeedLimitProperty {
    return entry.value
}

fun toRouteIdList(entry: List<Int?>): StaticIdxList<Route> {
    val res = mutableStaticIdxArrayListOf<Route>()
    for (route in entry) res.add(RouteId(route!!.toUInt()))
    return res
}
