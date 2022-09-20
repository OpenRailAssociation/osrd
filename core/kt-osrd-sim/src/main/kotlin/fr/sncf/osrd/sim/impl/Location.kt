package fr.sncf.osrd.sim.impl

import fr.sncf.osrd.sim.api.*
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update

fun locationSim(infra: LocationInfra): LocationSim {
    return LocationSimImpl(infra)
}

internal class LocationSimImpl(infra: LocationInfra) : LocationSim {
    private val states = infra.zones.map {
        MutableStateFlow(MutableDynIdxArraySet<Train>().readOnlyClone())
    }

    override fun watchZoneOccupation(zone: StaticIdx<Zone>): StateFlow<ZoneOccupation> {
        return states[zone.index]
    }

    override suspend fun enterZone(zone: StaticIdx<Zone>, train: DynIdx<Train>) {
        states[zone.index].update { lastState ->
            lastState.update {
                add(train)
            }
        }
    }

    override suspend fun leaveZone(zone: StaticIdx<Zone>, train: DynIdx<Train>) {
        states[zone.index].update { lastState ->
            lastState.update {
                remove(train)
            }
        }
    }
}
