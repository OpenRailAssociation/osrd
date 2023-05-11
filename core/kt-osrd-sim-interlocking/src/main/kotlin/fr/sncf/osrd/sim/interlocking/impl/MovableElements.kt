package fr.sncf.osrd.sim.interlocking.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim.interlocking.api.MovableElementInitPolicy
import fr.sncf.osrd.sim.interlocking.api.MovableElementSim
import fr.sncf.osrd.utils.indexing.get
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex


fun movableElementSim(infra: TrackNetworkInfra, initPolicy: MovableElementInitPolicy): MovableElementSim {
    return MovableElementSimImpl(infra, initPolicy)
}

internal class MovableElementSimImpl(
    private val infra: TrackNetworkInfra,
    private val initPolicy: MovableElementInitPolicy,
) : MovableElementSim {
    private val states: List<MutableStateFlow<TrackNodeConfigId?>> = infra.trackNodes.map {
        MutableStateFlow(null)
    }

    private val locks = infra.trackNodes.map { Mutex() }

    override fun watchMovableElement(movable: TrackNodeId): StateFlow<TrackNodeConfigId?> {
        return states[movable.index]
    }

    override suspend fun lockMovableElement(movable: TrackNodeId) {
        locks[movable.index].lock()
    }

    override suspend fun move(movable: TrackNodeId, config: TrackNodeConfigId) {
        assert(locks[movable.index].isLocked) { "cannot move a non-locked movable element" }
        states[movable.index].update { prevConfig ->
            if (prevConfig == null) {
                if (initPolicy == MovableElementInitPolicy.PESSIMISTIC)
                    delay(infra.getTrackNodeDelay(movable))
            } else if (prevConfig != config)
                delay(infra.getTrackNodeDelay(movable))
            config
        }
    }

    override suspend fun unlockMovableElement(movable: TrackNodeId) {
        locks[movable.index].unlock()
    }
}
