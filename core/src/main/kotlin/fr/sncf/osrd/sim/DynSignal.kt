package fr.sncf.osrd.sim

import fr.sncf.osrd.infra.api.signaling.SignalState
import kotlinx.coroutines.flow.StateFlow

interface DynSignal<out SignalStateT: SignalState> {
    val state: StateFlow<SignalStateT>

    suspend fun evaluate(infra: DynInfra)
}