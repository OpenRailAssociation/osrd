package fr.sncf.osrd.trainsim

import fr.sncf.osrd.path.interfaces.ZoneRange
import fr.sncf.osrd.sim_infra.api.ZoneId

fun occupiedZones(
    zones: List<ZoneRange>,
    head: PreciseDistance,
    length: PreciseDistance,
): List<ZoneId> {
    val tail = head - length
    return zones
        .filter { it.pathEnd.toPrecise() > tail && it.pathBegin.toPrecise() < head }
        .map { it.value }
}
