package fr.sncf.osrd.sim

import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.Signal
import fr.sncf.osrd.infra.api.signaling.SignalState

class DynInfraImpl : DynInfra {
    override fun <T : SignalState> getDyn(signal: Signal<T>): DynSignal<T> {
        TODO("Not yet implemented")
    }

    override fun getDyn(route: ReservationRoute): DynReservationRoute {
        TODO("Not yet implemented")
    }
}