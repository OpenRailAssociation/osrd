package fr.sncf.osrd.dyn_infra.implementation

import fr.sncf.osrd.dyn_infra.api.DynInfra
import fr.sncf.osrd.infra.api.signaling.SignalState
import kotlinx.coroutines.flow.StateFlow

/** For now, DynSignal is an implementation detail of DynInfra */
interface DynSignal<out SignalStateT: SignalState> {
    val state: StateFlow<SignalStateT>

    suspend fun run(infra: DynInfra)
}