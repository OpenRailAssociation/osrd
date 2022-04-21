package fr.sncf.osrd.sim

import fr.sncf.osrd.infra.api.signaling.Signal
import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.SignalState

interface DynInfra {
    fun <T: SignalState> getDyn(signal: Signal<T>): DynSignal<T>
    fun getDyn(route: ReservationRoute): DynReservationRoute
}