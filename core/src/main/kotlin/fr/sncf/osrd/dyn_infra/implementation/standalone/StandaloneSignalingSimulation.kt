package fr.sncf.osrd.dyn_infra.implementation.standalone

import fr.sncf.osrd.dyn_infra.api.TrainPath
import fr.sncf.osrd.dyn_infra.api.SignalizationState
import java.util.HashSet
import fr.sncf.osrd.envelope.Envelope
import java.util.stream.Collectors
import fr.sncf.osrd.infra.api.signaling.SignalState
import fr.sncf.osrd.infra.api.signaling.Signal
import java.util.ArrayList

/** This class connects a StandaloneState to a SignalizationState, calling the right updates  */
object StandaloneSignalingSimulation {
    data class SignalEvent<T : SignalState>(
        @JvmField val position: Double,
        @JvmField val signal: Signal<*>,
        @JvmField val state: T
    )

    data class SignalTimedEvent<T : SignalState>(
        @JvmField val position: Double,
        @JvmField val time: Double,
        @JvmField val signal: Signal<*>,
        @JvmField val state: T
    )

    /** Runs a complete standalone signaling simulation, returning a sequence of signal events.
     * This overload without TrainEnvelope returns events without time, just a train position.  */
    @JvmStatic
    fun runWithoutEnvelope(
        @Suppress("UNUSED_PARAMETER") path: TrainPath,
        state: StandaloneState,
        signalizationState: SignalizationState
    ): List<SignalEvent<*>> {
        val res = ArrayList<SignalEvent<*>>()
        for (position in state.updatePositions) {
            state.moveTrain(position!!)
            val updatedSignals = HashSet<Signal<*>>()
            for (route in state.routeUpdatePositions[position]) {
                updatedSignals.addAll(signalizationState.notifyUpdate(route))
                for (conflictingRoute in route.conflictingRoutes)
                    updatedSignals.addAll(signalizationState.notifyUpdate(conflictingRoute))
            }
            for (signal in updatedSignals)
                res.add(SignalEvent(position, signal, signalizationState.getSignalState(signal)))
        }
        return res
    }

    /** Runs a complete standalone signaling simulation, returning a sequence of signal events  */
    @JvmStatic
    fun run(
        path: TrainPath,
        state: StandaloneState,
        signalizationState: SignalizationState,
        trainEnvelope: Envelope
    ): List<SignalTimedEvent<*>> {
        return runWithoutEnvelope(path, state, signalizationState).stream()
            .map { event: SignalEvent<*> -> addTimeToEvent(trainEnvelope, event) }
            .collect(Collectors.toList())
    }

    private fun <T : SignalState> addTimeToEvent(
        trainEnvelope: Envelope,
        event: SignalEvent<T>
    ): SignalTimedEvent<T> {
        return SignalTimedEvent(
            event.position,
            trainEnvelope.interpolateTotalTime(event.position.coerceAtMost(trainEnvelope.endPos)),
            event.signal,
            event.state
        )
    }
}