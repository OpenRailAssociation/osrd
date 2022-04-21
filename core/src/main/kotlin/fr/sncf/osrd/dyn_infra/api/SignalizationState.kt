package fr.sncf.osrd.dyn_infra.api

import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.Signal

interface SignalizationState : SignalizationStateView {
    /** Notify that the route state has changed. Returns a set of updated signals  */
    fun notifyUpdate(route: ReservationRoute): Set<Signal<*>>
}