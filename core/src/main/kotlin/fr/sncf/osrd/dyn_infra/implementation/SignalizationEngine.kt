package fr.sncf.osrd.dyn_infra.implementation

import fr.sncf.osrd.dyn_infra.api.InfraStateView
import fr.sncf.osrd.infra.api.signaling.SignalState
import com.google.common.collect.ImmutableMultimap
import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.dyn_infra.api.SignalizationState
import java.util.HashSet
import fr.sncf.osrd.exceptions.OSRDError
import fr.sncf.osrd.exceptions.ErrorContext
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import java.util.HashMap
import fr.sncf.osrd.exceptions.OSRDError.ErrorCause
import fr.sncf.osrd.infra.api.signaling.Signal

class SignalizationEngine(
    private val infraState: InfraStateView,
    private val signalStates: MutableMap<Signal<*>, SignalState>,
    private val signalSubscribers: ImmutableMultimap<Signal<*>, Signal<*>>,
    private val routeSubscribers: ImmutableMultimap<ReservationRoute, Signal<*>>
) : SignalizationState {
    // We know the types match, but we lose that information when going through the map
    override fun <T : SignalState> getSignalState(signal: Signal<T>): T {
        @Suppress("UNCHECKED_CAST")
        return signalStates[signal] as T
    }

    override fun notifyUpdate(route: ReservationRoute): Set<Signal<*>> {
        val res = HashSet<Signal<*>>()
        val subscribedSignals = routeSubscribers[route]
        for (signal in subscribedSignals)
            updateSignal(signal, HashSet(), res)
        return res
    }

    /** Updates a signal, then all of its subscribers.
     * On infinite loop, throws a `SignalizationError` with a "stack trace" of the processed signals  */
    private fun updateSignal(
        signal: Signal<*>,
        modifiedSignalsInCurrentUpdate: HashSet<Signal<*>>,
        updated: HashSet<Signal<*>>
    ) {
        try {
            val newSignalState = signal.processDependencyUpdate(infraState, this)
            if (newSignalState != signalStates[signal]) {
                if (modifiedSignalsInCurrentUpdate.contains(signal)) throw SignalizationError(
                    "Infinite loop in signal dependency updates",
                    ErrorCause.USER // This would be caused by invalid infrastructures
                )
                modifiedSignalsInCurrentUpdate.add(signal)
                updated.add(signal)
                signalStates[signal] = newSignalState
                for (otherSignal in signalSubscribers[signal]) updateSignal(
                    otherSignal,
                    modifiedSignalsInCurrentUpdate,
                    updated
                )
            }
        } catch (e: OSRDError) {
            throw e.withContext(ErrorContext.Signal(signal.id))
        }
    }

    companion object {
        /** Creates a SignalizationEngine from a signaling infra and an infra state view  */
        @JvmStatic fun from(
            infra: SignalingInfra,
            infraState: InfraStateView
        ): SignalizationEngine {
            val signalStates: Map<Signal<*>, SignalState> = initSignalStates(infra)
            return SignalizationEngine(
                infraState,
                initSignalStates(infra),
                initSignalSubscribers(signalStates.keys),
                initRouteSubscribers(signalStates.keys)
            )
        }

        /** Initializes the map of signal dependencies (values are signals to be updated when the key signal is updated)  */
        private fun initSignalSubscribers(
            signalStates: Collection<Signal<*>>
        ): ImmutableMultimap<Signal<*>, Signal<*>> {
            val res = ImmutableMultimap.builder<Signal<*>, Signal<*>>()
            for (signal in signalStates)
                for (otherSignal in signal.signalDependencies)
                    res.put(otherSignal, signal)
            return res.build()
        }

        /** Initializes the map of route dependencies (values are signals to be updated when the key route is updated)  */
        private fun initRouteSubscribers(
            signalStates: Collection<Signal<*>>
        ): ImmutableMultimap<ReservationRoute, Signal<*>> {
            val res = ImmutableMultimap.builder<ReservationRoute, Signal<*>>()
            for (signal in signalStates)
                for (route in signal.routeDependencies)
                    res.put(route, signal)
            return res.build()
        }

        /** Initializes the map of signal -> signalState  */
        private fun initSignalStates(infra: SignalingInfra): MutableMap<Signal<*>, SignalState> {
            val res = HashMap<Signal<*>, SignalState>()
            for (signal in infra.signalMap.values())
                res[signal] = signal.initialState
            return res
        }
    }
}