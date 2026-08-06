package fr.sncf.osrd.trainsim

import fr.sncf.osrd.conflicts.RoutingZoneConfig
import fr.sncf.osrd.sim_infra.api.ZoneId

class ReservationTable {
    private val reservations = mutableMapOf<ZoneId, MutableList<Reservation>>()

    private data class Reservation(val train: Int, val config: RoutingZoneConfig)

    // Returns whether the train holds the zone afterwards.
    fun request(zone: ZoneId, config: RoutingZoneConfig, train: Int): Boolean {
        val held = reservations.getOrPut(zone) { mutableListOf() }

        if (held.any { it.config != config }) {
            return false
        }

        if (held.none { it.train == train }) {
            held.add(Reservation(train, config))
        }

        return true
    }

    fun release(zone: ZoneId, train: Int) {
        val held = reservations[zone] ?: return
        held.removeAll { it.train == train }
        if (held.isEmpty()) {
            reservations.remove(zone)
        }
    }

    fun holders(zone: ZoneId): List<Int> = reservations[zone]?.map { it.train } ?: listOf()

    fun holds(zone: ZoneId, train: Int): Boolean =
        reservations[zone]?.any { it.train == train } == true
}
