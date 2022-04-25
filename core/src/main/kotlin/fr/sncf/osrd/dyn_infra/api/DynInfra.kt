package fr.sncf.osrd.dyn_infra.api

import fr.sncf.osrd.infra.api.reservation.DetectionSection
import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.Signal
import fr.sncf.osrd.infra.api.signaling.SignalState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.StateFlow

interface DynInfra {
    /** Watch changes of the given detection section */
    fun watch(detectionSection: DetectionSection): StateFlow<DetectionSectionState>

    /** Occupies a detection section */
    suspend fun occupy(detectionSection: DetectionSection): ResourceHandle

    /** Reserves a detection section */
    suspend fun reserve(detectionSection: DetectionSection): ResourceHandle

    /** Watch changes of a given route */
    fun watch(route: ReservationRoute): StateFlow<ReservationRouteState>

    /**
     * The route will be reserved until a train starts occupying the route.
     * Then, it will become OCCUPIED, then FREE, then the coroutine will return.
     */
    suspend fun activate(route: ReservationRoute)

    /** Watch the changes of a given signal */
    fun <StateT: SignalState> watch(signal: Signal<StateT>): StateFlow<StateT>

    /** Runs passive dynamic infrastructure elements inside the given scope, like signals */
    fun run(scope: CoroutineScope)

    interface ResourceHandle {
        /** Releases the resource */
        suspend fun release()
    }
}

