package fr.sncf.osrd.dyn_infra.api

import fr.sncf.osrd.infra.api.signaling.SignalState
import fr.sncf.osrd.infra.api.signaling.Signal

interface SignalizationStateView {
    /** Returns the state of the given signal  */
    fun <T : SignalState> getSignalState(signal: Signal<T>): T
}