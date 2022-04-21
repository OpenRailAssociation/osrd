package fr.sncf.osrd.dyn_infra.api

import fr.sncf.osrd.infra.api.reservation.DetectionSection
import fr.sncf.osrd.infra.api.reservation.ReservationRoute

interface InfraStateView {
    /** Returns the state of a reservation section  */
    fun getState(section: DetectionSection): DetectionSectionState

    /** Returns the state of a reservation route  */
    fun getState(route: ReservationRoute): ReservationRouteState
}