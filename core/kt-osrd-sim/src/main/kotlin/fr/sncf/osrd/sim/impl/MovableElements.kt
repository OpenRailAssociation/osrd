package fr.sncf.osrd.sim.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim.api.MovableElementSim
import fr.sncf.osrd.utils.indexing.get
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex


fun movableElementSim(infra: MovableElementsInfra): MovableElementSim {
    return MovableElementSimImpl(infra)
}

internal class MovableElementSimImpl(private val infra: MovableElementsInfra) : MovableElementSim {
    private val states = infra.movableElements.map { id ->
        MutableStateFlow(infra.getMovableElementDefaultConfig(id))
    }

    private val locks = infra.movableElements.map { Mutex() }

    override fun watchMovableElement(movable: MovableElementId): StateFlow<MovableElementConfigId> {
        return states[movable.index]
    }

    override suspend fun lockMovableElement(movable: MovableElementId) {
        locks[movable.index].lock()
    }

    override suspend fun move(movable: MovableElementId, config: MovableElementConfigId) {
        assert(locks[movable.index].isLocked) { "cannot move a non-locked movable element" }
        states[movable.index].update { prevConfig ->
            if (prevConfig != config)
                delay(infra.getMovableElementDelay(movable))
            config
        }
    }

    override suspend fun unlockMovableElement(movable: MovableElementId) {
        locks[movable.index].unlock()
    }
}
