package fr.sncf.osrd.dyn_infra.implementation

import fr.sncf.osrd.dyn_infra.api.DetectionSectionState
import fr.sncf.osrd.dyn_infra.api.DynInfra
import fr.sncf.osrd.dyn_infra.api.ReservationRouteState
import fr.sncf.osrd.infra.api.reservation.DetectionSection
import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.Signal
import fr.sncf.osrd.infra.api.signaling.SignalState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.StateFlow

class DynInfraImpl private constructor(
    private val detectionSections: Map<DetectionSection, DynDetectionSection>,
    private val routes: Map<ReservationRoute, DynReservationRoute>,
    private val signals: Map<Signal<*>, DynSignal<*>>
) : DynInfra {
    override fun watch(detectionSection: DetectionSection): StateFlow<DetectionSectionState> {
        return detectionSections[detectionSection]!!.state
    }

    override fun watch(route: ReservationRoute): StateFlow<ReservationRouteState> {
        return routes[route]!!.state
    }

    override fun <StateT : SignalState> watch(signal: Signal<StateT>): StateFlow<StateT> {
        @Suppress("UNCHECKED_CAST")
        return (signals[signal]!! as DynSignal<StateT>).state
    }

    override suspend fun occupy(detectionSection: DetectionSection): DynInfra.ResourceHandle {
        return detectionSections[detectionSection]!!.occupy()
    }

    override suspend fun reserve(detectionSection: DetectionSection): DynInfra.ResourceHandle {
        return detectionSections[detectionSection]!!.reserve()
    }

    override suspend fun activate(route: ReservationRoute) {

        TODO("Not yet implemented")
    }

    override fun run(scope: CoroutineScope) {
        TODO("Not yet implemented")
    }

    companion object {
        @JvmStatic fun from(
            detectionSections: Iterable<DetectionSection>,
            routes: Iterable<ReservationRoute>,
            signals: Iterable<Signal<*>>
        ): DynInfraImpl {
            val dynSections = HashMap<DetectionSection, DynDetectionSection>()
            for (section in detectionSections)
                dynSections[section] = DynDetectionSection()

            val dynRoutes = HashMap<ReservationRoute, DynReservationRoute>()
            for (route in routes)
                dynRoutes[route] = DynReservationRoute()

            val dynSignals = HashMap<Signal<*>, DynSignal<*>>()
            for (signal in signals)
                dynSignals[signal] = signal.makeDynamic()

            return DynInfraImpl(dynSections, dynRoutes, dynSignals)
        }
    }
}
